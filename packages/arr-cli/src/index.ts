#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { watch } from "node:fs";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ArrError,
  detectFileFormat,
  embedAttestationInMetadata,
  extractAttestationFromMetadata,
  generateKeyPair,
  parseSignedAttestationJson,
  readSidecar,
  signAttestation,
  verifyAttestation,
  writeSidecar,
  type Attestation,
  type SignedAttestation,
} from "@allrightsrespected/sdk";

type Command = "keygen" | "attest" | "verify" | "extract" | "watch";

type ParsedArgs = {
  command: Command | undefined;
  positionals: string[];
  options: Record<string, string | boolean>;
  wantsJson: boolean;
};

type ExtractionResult = {
  signed: SignedAttestation;
  source: "metadata" | "sidecar";
  filePath: string;
  format?: "png" | "jpeg";
};

class CliError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CliError";
    this.code = code;
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  let command: Command | undefined;
  let tokens = argv;

  const firstToken = argv[0];

  if (
    firstToken === "keygen" ||
    firstToken === "attest" ||
    firstToken === "verify" ||
    firstToken === "extract" ||
    firstToken === "watch"
  ) {
    command = firstToken;
    tokens = argv.slice(1);
  }

  const positionals: string[] = [];
  const options: Record<string, string | boolean> = {};

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) {
      continue;
    }

    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = tokens[index + 1];

    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return {
    command,
    positionals,
    options,
    wantsJson: options.json === true,
  };
}

function getHelp(command?: Command): string {
  if (!command) {
    return [
      "ARR CLI (M1)",
      "",
      "Usage:",
      "  arr <command> [options]",
      "",
      "Commands:",
      "  keygen   Generate an Ed25519 keypair",
      "  attest   Sign and attach an ARR attestation",
      "  verify   Verify ARR metadata or sidecar",
      "  extract  Print ARR payload from metadata or sidecar",
      "  watch    Auto-attest files dropped into a folder",
      "",
      "Global options:",
      "  --json   Emit stable JSON envelopes",
      "  --help   Show command help",
      "",
      "Run `arr <command> --help` for detailed usage.",
      "",
    ].join("\n");
  }

  if (command === "keygen") {
    return [
      "Usage:",
      "  arr keygen --out-dir <dir> [--json]",
      "",
      "Options:",
      "  --out-dir <dir>   Directory for generated key files",
      "  --json            Emit JSON output",
      "",
    ].join("\n");
  }

  if (command === "attest") {
    return [
      "Usage:",
      "  arr attest <file> --creator <id> --private-key <pemPath> [options]",
      "",
      "Options:",
      "  --intent <text>           Creative intent",
      "  --tool <name/version>     Tool marker",
      "  --expires <YYYY-MM-DD>    Expiry date",
      "  --mode <auto|sidecar|metadata>",
      "  --out <path>              Output file path",
      "  --json                    Emit JSON output",
      "",
    ].join("\n");
  }

  if (command === "verify") {
    return [
      "Usage:",
      "  arr verify <file> [--public-key <pemPath>] [--json]",
      "",
      "Options:",
      "  --public-key <pemPath>    Explicit PEM public key",
      "  --json                    Emit JSON output",
      "",
    ].join("\n");
  }

  if (command === "watch") {
    return [
      "Usage:",
      "  arr watch --in <dir> --creator <id> --private-key <pemPath> [options]",
      "",
      "Options:",
      "  --out-dir <dir>          Output directory (defaults to input dir)",
      "  --intent <text>           Creative intent",
      "  --tool <name/version>     Tool marker",
      "  --expires <YYYY-MM-DD>    Expiry date",
      "  --mode <auto|sidecar|metadata>",
      "  --json                    Emit JSON output",
      "",
      "Tip:",
      "  Drag files into the watched folder to auto-attest them.",
      "",
    ].join("\n");
  }

  return [
    "Usage:",
    "  arr extract <file> [--json]",
    "",
    "Options:",
    "  --json                    Emit JSON output",
    "",
  ].join("\n");
}

function getStringOption(parsed: ParsedArgs, key: string): string | undefined {
  const value = parsed.options[key];
  return typeof value === "string" ? value : undefined;
}

function getRequiredStringOption(parsed: ParsedArgs, key: string): string {
  const value = getStringOption(parsed, key);

  if (!value) {
    throw new CliError("missing_flag", `Missing required option --${key}.`);
  }

  return value;
}

async function ensureFileExists(filePath: string): Promise<void> {
  try {
    await access(filePath);
  } catch {
    throw new CliError("file_not_found", `File not found: ${filePath}`);
  }
}

async function ensureDirExists(dirPath: string): Promise<void> {
  try {
    const stats = await stat(dirPath);
    if (!stats.isDirectory()) {
      throw new CliError("not_a_directory", `Not a directory: ${dirPath}`);
    }
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new CliError("dir_not_found", `Directory not found: ${dirPath}`);
    }
    throw error;
  }
}

function defaultMetadataOutputPath(inputPath: string): string {
  const parsed = path.parse(inputPath);

  if (!parsed.ext) {
    return path.join(parsed.dir, `${parsed.name}.attested`);
  }

  return path.join(parsed.dir, `${parsed.name}.attested${parsed.ext}`);
}

function metadataOutputPathAt(inputPath: string, outputDir: string): string {
  const parsed = path.parse(inputPath);

  if (!parsed.ext) {
    return path.join(outputDir, `${parsed.name}.attested`);
  }

  return path.join(outputDir, `${parsed.name}.attested${parsed.ext}`);
}

function sidecarOutputPathAt(inputPath: string, outputDir: string): string {
  const parsed = path.parse(inputPath);
  return path.join(outputDir, `${parsed.base}.arr`);
}

function isSkippableFilename(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  if (lower.startsWith(".")) return true;
  if (lower.endsWith("~")) return true;
  if (lower === "thumbs.db" || lower === ".ds_store") return true;
  if (lower.endsWith(".arr")) return true;
  if (lower.includes(".attested")) return true;
  return false;
}

function toJson(command: Command, data: Record<string, unknown>): string {
  return `${JSON.stringify({ ok: true, command, data }, null, 2)}\n`;
}

function toJsonError(command: Command | undefined, error: { code: string; message: string }): string {
  return `${JSON.stringify({ ok: false, command: command ?? null, error }, null, 2)}\n`;
}

async function loadSignedAttestation(filePath: string): Promise<ExtractionResult> {
  if (filePath.endsWith(".arr")) {
    const raw = await readFile(filePath, "utf8");

    return {
      signed: parseSignedAttestationJson(raw),
      source: "sidecar",
      filePath,
    };
  }

  const originalBytes = await readFile(filePath);
  const metadata = extractAttestationFromMetadata(originalBytes);

  if (metadata) {
    return {
      signed: metadata.signed,
      source: "metadata",
      filePath,
      format: metadata.format,
    };
  }

  try {
    const sidecar = await readSidecar(filePath);

    return {
      signed: sidecar.signed,
      source: "sidecar",
      filePath: sidecar.path,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new CliError(
        "attestation_not_found",
        "No ARR attestation found in metadata and no sidecar file was found.",
      );
    }

    throw error;
  }
}

async function handleKeygen(parsed: ParsedArgs): Promise<void> {
  if (parsed.options.help === true) {
    process.stdout.write(getHelp("keygen"));
    return;
  }

  const outDir = getRequiredStringOption(parsed, "out-dir");
  await mkdir(outDir, { recursive: true });

  const { privateKeyPem, publicKeyPem, creator } = generateKeyPair();
  const privateKeyPath = path.join(outDir, "arr-ed25519-private.pem");
  const publicKeyPath = path.join(outDir, "arr-ed25519-public.pem");

  await writeFile(privateKeyPath, privateKeyPem, { encoding: "utf8", mode: 0o600 });
  await writeFile(publicKeyPath, publicKeyPem, "utf8");

  if (parsed.wantsJson) {
    process.stdout.write(
      toJson("keygen", {
        privateKeyPath,
        publicKeyPath,
        creator,
      }),
    );

    return;
  }

  process.stdout.write(
    [
      "Generated Ed25519 keypair.",
      `Private key: ${privateKeyPath}`,
      `Public key: ${publicKeyPath}`,
      `Creator ID: ${creator}`,
      "",
    ].join("\n"),
  );
}

function buildAttestation(parsed: ParsedArgs): Attestation {
  const creator = getRequiredStringOption(parsed, "creator");
  const expires = getStringOption(parsed, "expires");

  if (expires) {
    const parsedDate = new Date(expires);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new CliError("invalid_expires", "The --expires value must be a valid date.");
    }
  }

  const attestation: Attestation = {
    version: "arr/0.1",
    id: randomUUID(),
    created: new Date().toISOString(),
    creator,
    revocable: true,
  };

  const intent = getStringOption(parsed, "intent");

  if (intent) {
    attestation.intent = intent;
  }

  const tool = getStringOption(parsed, "tool");

  if (tool) {
    attestation.tool = tool;
  }

  if (expires) {
    attestation.expires = expires;
  }

  return attestation;
}

type AttestPaths = {
  metadata?: string;
  sidecar?: string;
};

type AttestOutcome = {
  mode: "metadata" | "sidecar";
  outputPath: string;
  format?: "png" | "jpeg";
};

async function attestSigned(
  inputPath: string,
  signed: SignedAttestation,
  modeOption: "auto" | "sidecar" | "metadata",
  paths: AttestPaths = {},
): Promise<AttestOutcome> {
  if (modeOption === "sidecar") {
    const writtenPath = await writeSidecar(inputPath, signed, paths.sidecar);
    return { mode: "sidecar", outputPath: writtenPath };
  }

  const bytes = await readFile(inputPath);
  const detectedFormat = detectFileFormat(bytes);

  if (modeOption === "metadata" && detectedFormat === "unknown") {
    throw new CliError(
      "unsupported_format",
      "Metadata mode currently supports only PNG and JPEG files. Use --mode sidecar instead.",
    );
  }

  if (detectedFormat === "unknown") {
    const writtenPath = await writeSidecar(inputPath, signed, paths.sidecar);
    return { mode: "sidecar", outputPath: writtenPath };
  }

  const embedded = embedAttestationInMetadata(bytes, signed, detectedFormat);
  const targetPath = paths.metadata ?? defaultMetadataOutputPath(inputPath);
  await writeFile(targetPath, embedded);

  return {
    mode: "metadata",
    outputPath: targetPath,
    format: detectedFormat,
  };
}

async function handleAttest(parsed: ParsedArgs): Promise<void> {
  if (parsed.options.help === true) {
    process.stdout.write(getHelp("attest"));
    return;
  }

  const [inputPath] = parsed.positionals;

  if (!inputPath) {
    throw new CliError("missing_file", "Usage: arr attest <file> ...");
  }

  await ensureFileExists(inputPath);

  const privateKeyPath = getRequiredStringOption(parsed, "private-key");
  await ensureFileExists(privateKeyPath);

  const privateKeyPem = await readFile(privateKeyPath, "utf8");
  const attestation = buildAttestation(parsed);
  const signed = signAttestation(attestation, privateKeyPem);

  const modeOption = getStringOption(parsed, "mode") ?? "auto";

  if (modeOption !== "auto" && modeOption !== "sidecar" && modeOption !== "metadata") {
    throw new CliError("invalid_mode", "Mode must be one of: auto, sidecar, metadata.");
  }

  const outPath = getStringOption(parsed, "out");

  const paths: AttestPaths = {};
  if (outPath) {
    paths.metadata = outPath;
    paths.sidecar = outPath;
  }

  const outcome = await attestSigned(inputPath, signed, modeOption as "auto" | "sidecar" | "metadata", paths);

  if (parsed.wantsJson) {
    process.stdout.write(
      toJson("attest", {
        mode: outcome.mode,
        format: outcome.format,
        outputPath: outcome.outputPath,
        signed,
      }),
    );

    return;
  }

  if (outcome.mode === "sidecar") {
    process.stdout.write(`Wrote ARR sidecar: ${outcome.outputPath}\n`);
    return;
  }

  process.stdout.write(
    `Embedded ARR attestation in ${outcome.format?.toUpperCase()} metadata: ${outcome.outputPath}\n`,
  );
}

async function handleWatch(parsed: ParsedArgs): Promise<void> {
  if (parsed.options.help === true) {
    process.stdout.write(getHelp("watch"));
    return;
  }

  const inputDir = getRequiredStringOption(parsed, "in");
  await ensureDirExists(inputDir);
  void getRequiredStringOption(parsed, "creator");

  const privateKeyPath = getRequiredStringOption(parsed, "private-key");
  await ensureFileExists(privateKeyPath);
  const privateKeyPem = await readFile(privateKeyPath, "utf8");

  const outputDir = getStringOption(parsed, "out-dir");
  if (outputDir) {
    await mkdir(outputDir, { recursive: true });
  }

  const modeOption = getStringOption(parsed, "mode") ?? "auto";
  if (modeOption !== "auto" && modeOption !== "sidecar" && modeOption !== "metadata") {
    throw new CliError("invalid_mode", "Mode must be one of: auto, sidecar, metadata.");
  }

  const pending = new Map<string, NodeJS.Timeout>();

  const processFile = async (filePath: string): Promise<void> => {
    try {
      const stats = await stat(filePath);
      if (!stats.isFile()) return;
    } catch (error: unknown) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return;
      }
      throw error;
    }

    const fileName = path.basename(filePath);
    if (isSkippableFilename(fileName)) {
      return;
    }

    const outputBaseDir = outputDir ?? path.dirname(filePath);
    const paths: AttestPaths = outputDir
      ? {
          metadata: metadataOutputPathAt(filePath, outputBaseDir),
          sidecar: sidecarOutputPathAt(filePath, outputBaseDir),
        }
      : {};

    const attestation = buildAttestation(parsed);
    const signed = signAttestation(attestation, privateKeyPem);

    const outcome = await attestSigned(filePath, signed, modeOption as "auto" | "sidecar" | "metadata", paths);

    if (parsed.wantsJson) {
      process.stdout.write(
        toJson("watch", {
          inputPath: filePath,
          mode: outcome.mode,
          format: outcome.format,
          outputPath: outcome.outputPath,
        }),
      );
      return;
    }

    if (outcome.mode === "sidecar") {
      process.stdout.write(`Attested (sidecar): ${filePath} -> ${outcome.outputPath}\n`);
      return;
    }

    process.stdout.write(`Attested (${outcome.format?.toUpperCase()}): ${filePath} -> ${outcome.outputPath}\n`);
  };

  const schedule = (filePath: string): void => {
    const existing = pending.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      pending.delete(filePath);
      void processFile(filePath).catch((error) => {
        const normalized = normalizeError(error);
        if (parsed.wantsJson) {
          process.stderr.write(toJsonError("watch", normalized));
        } else {
          process.stderr.write(`Error [${normalized.code}]: ${normalized.message}\n`);
        }
      });
    }, 400);

    pending.set(filePath, timer);
  };

  if (parsed.wantsJson) {
    process.stdout.write(
      toJson("watch", {
        status: "started",
        inputDir,
        outputDir: outputDir ?? null,
        mode: modeOption,
      }),
    );
  } else {
    process.stdout.write(`Watching ${inputDir}\n`);
    if (outputDir) {
      process.stdout.write(`Output directory: ${outputDir}\n`);
    }
    process.stdout.write("Drop files into the folder to auto-attest them.\n");
  }

  watch(inputDir, { persistent: true }, (_eventType, filename) => {
    if (!filename) return;
    const filePath = path.join(inputDir, filename.toString());
    schedule(filePath);
  });
}

async function handleVerify(parsed: ParsedArgs): Promise<void> {
  if (parsed.options.help === true) {
    process.stdout.write(getHelp("verify"));
    return;
  }

  const [inputPath] = parsed.positionals;

  if (!inputPath) {
    throw new CliError("missing_file", "Usage: arr verify <file> ...");
  }

  await ensureFileExists(inputPath);
  const extracted = await loadSignedAttestation(inputPath);

  const publicKeyPath = getStringOption(parsed, "public-key");
  let publicKeyPem: string | undefined;

  if (publicKeyPath) {
    await ensureFileExists(publicKeyPath);
    publicKeyPem = await readFile(publicKeyPath, "utf8");
  }

  const result = verifyAttestation(extracted.signed, publicKeyPem);

  if (parsed.wantsJson) {
    process.stdout.write(
      toJson("verify", {
        source: {
          type: extracted.source,
          path: extracted.filePath,
          format: extracted.format,
        },
        result,
      }),
    );

    if (!result.valid) {
      process.exitCode = 1;
    }

    return;
  }

  if (result.valid) {
    process.stdout.write(`ARR verification: valid${result.expired ? " (expired)" : ""}.\n`);
    return;
  }

  process.stdout.write(`ARR verification failed: ${result.reason}.\n`);
  process.exitCode = 1;
}

async function handleExtract(parsed: ParsedArgs): Promise<void> {
  if (parsed.options.help === true) {
    process.stdout.write(getHelp("extract"));
    return;
  }

  const [inputPath] = parsed.positionals;

  if (!inputPath) {
    throw new CliError("missing_file", "Usage: arr extract <file> ...");
  }

  await ensureFileExists(inputPath);

  const extracted = await loadSignedAttestation(inputPath);

  if (parsed.wantsJson) {
    process.stdout.write(
      toJson("extract", {
        source: {
          type: extracted.source,
          path: extracted.filePath,
          format: extracted.format,
        },
        signed: extracted.signed,
      }),
    );

    return;
  }

  process.stdout.write(`${JSON.stringify(extracted.signed, null, 2)}\n`);
}

function normalizeError(error: unknown): { code: string; message: string } {
  if (error instanceof CliError) {
    return { code: error.code, message: error.message };
  }

  if (error instanceof ArrError) {
    return { code: error.code, message: error.message };
  }

  if (error instanceof Error) {
    return { code: "unexpected", message: error.message };
  }

  return { code: "unexpected", message: "An unexpected error occurred." };
}

async function run(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const firstToken = process.argv.slice(2)[0];

  if (parsed.options.help === true && !parsed.command) {
    process.stdout.write(getHelp());
    return;
  }

  if (!parsed.command) {
    if (!firstToken) {
      process.stdout.write(getHelp());
      return;
    }

    if (firstToken && !firstToken.startsWith("--")) {
      throw new CliError("unknown_command", `Unknown command: ${firstToken}`);
    }

    throw new CliError(
      "unknown_command",
      "Usage: arr <keygen|attest|verify|extract> [args]. Use --help for details.",
    );
  }

  switch (parsed.command) {
    case "keygen":
      await handleKeygen(parsed);
      break;
    case "attest":
      await handleAttest(parsed);
      break;
    case "watch":
      await handleWatch(parsed);
      break;
    case "verify":
      await handleVerify(parsed);
      break;
    case "extract":
      await handleExtract(parsed);
      break;
    default:
      throw new CliError("unknown_command", `Unknown command: ${parsed.command}`);
  }
}

run().catch((error: unknown) => {
  const parsed = parseArgs(process.argv.slice(2));
  const normalized = normalizeError(error);

  if (parsed.wantsJson) {
    process.stderr.write(toJsonError(parsed.command, normalized));
  } else {
    process.stderr.write(`Error [${normalized.code}]: ${normalized.message}\n`);
  }

  process.exitCode = 1;
});
