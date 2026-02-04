import { readFile, writeFile } from "node:fs/promises";
import type { SignedAttestation } from "./types.js";
import { parseSignedAttestationJson, serializeSignedAttestation } from "./signed.js";

export function sidecarPathFor(originalPath: string): string {
  return originalPath.endsWith(".arr") ? originalPath : `${originalPath}.arr`;
}

export async function writeSidecar(
  originalPath: string,
  signed: SignedAttestation,
  outPath?: string,
): Promise<string> {
  const targetPath = outPath ?? sidecarPathFor(originalPath);
  await writeFile(targetPath, serializeSignedAttestation(signed), "utf8");
  return targetPath;
}

export async function readSidecar(pathOrOriginal: string): Promise<{ path: string; signed: SignedAttestation }> {
  const targetPath = sidecarPathFor(pathOrOriginal);
  const raw = await readFile(targetPath, "utf8");

  return {
    path: targetPath,
    signed: parseSignedAttestationJson(raw),
  };
}
