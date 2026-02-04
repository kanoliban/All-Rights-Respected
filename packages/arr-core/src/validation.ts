import type { Attestation, SignedAttestation } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

export function isAttestation(value: unknown): value is Attestation {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.version !== "string" ||
    typeof value.id !== "string" ||
    typeof value.created !== "string" ||
    typeof value.creator !== "string"
  ) {
    return false;
  }

  if (value.intent !== undefined && typeof value.intent !== "string") {
    return false;
  }

  if (value.tool !== undefined && typeof value.tool !== "string") {
    return false;
  }

  if (value.upstream !== undefined && !isStringArray(value.upstream)) {
    return false;
  }

  if (value.expires !== undefined && typeof value.expires !== "string") {
    return false;
  }

  if (value.revocable !== undefined && typeof value.revocable !== "boolean") {
    return false;
  }

  if (value.license !== undefined && typeof value.license !== "string") {
    return false;
  }

  if (value.extensions !== undefined && !isRecord(value.extensions)) {
    return false;
  }

  return true;
}

export function isSignedAttestation(value: unknown): value is SignedAttestation {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.signature === "string" && isAttestation(value.attestation);
}

export function assertSignedAttestation(value: unknown): asserts value is SignedAttestation {
  if (!isSignedAttestation(value)) {
    throw new Error("Malformed signed attestation.");
  }
}
