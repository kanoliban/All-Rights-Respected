import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  generateKeyPair,
  readSidecar,
  signAttestation,
  writeSidecar,
  type Attestation,
} from "../src/index.js";

function buildAttestation(creator: string): Attestation {
  return {
    version: "arr/0.1",
    id: "sidecar-id",
    created: "2026-01-29T10:30:00Z",
    creator,
    intent: "Sidecar test",
  };
}

describe("sidecar adapter", () => {
  test("writes and reads sidecar payload", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "arr-sidecar-"));
    const originalPath = path.join(tempDir, "asset.bin");

    const { privateKeyPem, creator } = generateKeyPair();
    const signed = signAttestation(buildAttestation(creator), privateKeyPem);
    const sidecarPath = await writeSidecar(originalPath, signed);
    const { signed: loaded } = await readSidecar(originalPath);

    expect(sidecarPath).toBe(`${originalPath}.arr`);
    expect(loaded).toEqual(signed);

    const raw = await readFile(sidecarPath, "utf8");
    expect(raw.endsWith("\n")).toBe(true);
  });
});
