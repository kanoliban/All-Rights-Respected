import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);

type CliJson = {
  ok: boolean;
  command: string;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
};

async function runCli(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync(
      "node",
      ["packages/arr-cli/dist/index.js", ...args],
      { cwd },
    );

    return { stdout, stderr, code: 0 };
  } catch (error) {
    const typed = error as {
      stdout?: string;
      stderr?: string;
      code?: number;
    };

    return {
      stdout: typed.stdout ?? "",
      stderr: typed.stderr ?? "",
      code: typed.code ?? 1,
    };
  }
}

function parseJson(stdout: string): CliJson {
  return JSON.parse(stdout) as CliJson;
}

describe("arr cli integration", () => {
  const repoRoot = process.cwd();

  test("shows top-level help", async () => {
    const result = await runCli(["--help"], repoRoot);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("ARR CLI (M1)");
    expect(result.stdout).toContain("arr <command> [options]");
  });

  test("shows command-specific help", async () => {
    const result = await runCli(["attest", "--help"], repoRoot);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("arr attest <file|dir>");
    expect(result.stdout).toContain("--mode <auto|sidecar|metadata>");
  });

  test("keygen writes valid PEM files", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "arr-cli-keygen-"));

    const result = await runCli(["keygen", "--out-dir", tempDir, "--json"], repoRoot);
    expect(result.code).toBe(0);

    const payload = parseJson(result.stdout);
    expect(payload.ok).toBe(true);
    expect(payload.command).toBe("keygen");

    const privateKeyPath = payload.data?.privateKeyPath as string;
    const publicKeyPath = payload.data?.publicKeyPath as string;

    const [privatePem, publicPem] = await Promise.all([
      readFile(privateKeyPath, "utf8"),
      readFile(publicKeyPath, "utf8"),
    ]);

    expect(privatePem.includes("BEGIN PRIVATE KEY")).toBe(true);
    expect(publicPem.includes("BEGIN PUBLIC KEY")).toBe(true);
  });

  test("attest -> verify -> extract sidecar flow", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "arr-cli-sidecar-"));
    const artifactPath = path.join(tempDir, "artifact.bin");
    await writeFile(artifactPath, "hello arr", "utf8");

    const keygen = parseJson((await runCli(["keygen", "--out-dir", tempDir, "--json"], repoRoot)).stdout);
    const privateKeyPath = keygen.data?.privateKeyPath as string;
    const publicKeyPath = keygen.data?.publicKeyPath as string;
    const creator = keygen.data?.creator as string;

    const attestResult = await runCli(
      [
        "attest",
        artifactPath,
        "--creator",
        creator,
        "--private-key",
        privateKeyPath,
        "--mode",
        "sidecar",
        "--json",
      ],
      repoRoot,
    );

    expect(attestResult.code).toBe(0);
    const attestJson = parseJson(attestResult.stdout);
    expect(attestJson.ok).toBe(true);
    expect(attestJson.data?.mode).toBe("sidecar");

    const verifyResult = await runCli(
      ["verify", artifactPath, "--public-key", publicKeyPath, "--json"],
      repoRoot,
    );

    expect(verifyResult.code).toBe(0);
    const verifyJson = parseJson(verifyResult.stdout);
    expect(verifyJson.data?.result).toMatchObject({ valid: true, expired: false });

    const extractResult = await runCli(["extract", artifactPath, "--json"], repoRoot);
    expect(extractResult.code).toBe(0);

    const extractJson = parseJson(extractResult.stdout);
    expect(extractJson.data?.signed).toBeDefined();
  });

  test("auto mode uses metadata for png and sidecar for unknown files", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "arr-cli-auto-"));
    const pngPath = path.join(tempDir, "sample.png");
    const txtPath = path.join(tempDir, "sample.txt");

    await Promise.all([
      readFile(path.join(repoRoot, "fixtures/conformance/v0.1/sample.png")).then((buffer) => writeFile(pngPath, buffer)),
      writeFile(txtPath, "fallback sidecar", "utf8"),
    ]);

    const keygen = parseJson((await runCli(["keygen", "--out-dir", tempDir, "--json"], repoRoot)).stdout);
    const privateKeyPath = keygen.data?.privateKeyPath as string;
    const creator = keygen.data?.creator as string;

    const attestPng = parseJson(
      (
        await runCli(
          ["attest", pngPath, "--creator", creator, "--private-key", privateKeyPath, "--mode", "auto", "--json"],
          repoRoot,
        )
      ).stdout,
    );

    expect(attestPng.data?.mode).toBe("metadata");
    expect(attestPng.data?.format).toBe("png");

    const metadataOut = attestPng.data?.outputPath as string;
    const verifyWithCreatorKey = parseJson((await runCli(["verify", metadataOut, "--json"], repoRoot)).stdout);
    expect(verifyWithCreatorKey.data?.result).toMatchObject({ valid: true });

    const attestTxt = parseJson(
      (
        await runCli(
          ["attest", txtPath, "--creator", creator, "--private-key", privateKeyPath, "--mode", "auto", "--json"],
          repoRoot,
        )
      ).stdout,
    );

    expect(attestTxt.data?.mode).toBe("sidecar");
    expect((attestTxt.data?.outputPath as string).endsWith(".arr")).toBe(true);
  });

  test("verify --json returns stable envelope shape", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "arr-cli-schema-"));
    const artifactPath = path.join(tempDir, "artifact.txt");
    await writeFile(artifactPath, "schema", "utf8");

    const keygen = parseJson((await runCli(["keygen", "--out-dir", tempDir, "--json"], repoRoot)).stdout);

    await runCli(
      [
        "attest",
        artifactPath,
        "--creator",
        keygen.data?.creator as string,
        "--private-key",
        keygen.data?.privateKeyPath as string,
        "--mode",
        "sidecar",
        "--json",
      ],
      repoRoot,
    );

    const verify = parseJson((await runCli(["verify", artifactPath, "--json"], repoRoot)).stdout);

    expect(Object.keys(verify).sort()).toEqual(["command", "data", "ok"]);
    expect(verify.command).toBe("verify");
    expect((verify.data as Record<string, unknown>).result).toBeDefined();
  });

  test("metadata mode returns structured error for unsupported formats", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "arr-cli-errors-"));
    const artifactPath = path.join(tempDir, "artifact.txt");
    await writeFile(artifactPath, "unsupported", "utf8");

    const keygen = parseJson((await runCli(["keygen", "--out-dir", tempDir, "--json"], repoRoot)).stdout);
    const result = await runCli(
      [
        "attest",
        artifactPath,
        "--creator",
        keygen.data?.creator as string,
        "--private-key",
        keygen.data?.privateKeyPath as string,
        "--mode",
        "metadata",
        "--json",
      ],
      repoRoot,
    );

    expect(result.code).toBe(1);
    const errorPayload = parseJson(result.stderr);
    expect(errorPayload.ok).toBe(false);
    expect(errorPayload.error).toMatchObject({ code: "unsupported_format" });
  });
});
