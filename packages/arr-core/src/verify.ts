import type { KeyObject } from "node:crypto";
import { ArrError } from "./errors.js";
import { parseCreatorPublicKey, verifySignature } from "./keys.js";
import type { SignedAttestation, VerificationResult } from "./types.js";
import { isSignedAttestation } from "./validation.js";

function parseExpiry(expires: string | undefined): Date | undefined {
  if (expires === undefined) {
    return undefined;
  }

  const parsed = new Date(expires);

  if (Number.isNaN(parsed.getTime())) {
    throw new ArrError("invalid_expiry", "Attestation expires field is not a valid date.");
  }

  return parsed;
}

function resolvePublicKey(
  signed: SignedAttestation,
  explicitPublicKey?: string | KeyObject,
): KeyObject | string | null {
  if (explicitPublicKey) {
    return explicitPublicKey;
  }

  return parseCreatorPublicKey(signed.attestation.creator);
}

export function verifyAttestation(
  signed: SignedAttestation,
  explicitPublicKey?: string | KeyObject,
): VerificationResult {
  if (!isSignedAttestation(signed)) {
    return { valid: false, reason: "malformed" };
  }

  if (signed.attestation.version !== "arr/0.1") {
    return { valid: false, reason: "unsupported_version" };
  }

  let publicKey: KeyObject | string | null;

  try {
    publicKey = resolvePublicKey(signed, explicitPublicKey);
  } catch {
    return { valid: false, reason: "malformed" };
  }

  if (!publicKey) {
    return { valid: false, reason: "missing_public_key" };
  }

  let signatureValid = false;

  try {
    signatureValid = verifySignature(signed.attestation, signed.signature, publicKey);
  } catch {
    return { valid: false, reason: "malformed" };
  }

  if (!signatureValid) {
    return { valid: false, reason: "invalid_signature" };
  }

  try {
    const expiryDate = parseExpiry(signed.attestation.expires);

    if (!expiryDate) {
      return { valid: true, expired: false };
    }

    return { valid: true, expired: Date.now() > expiryDate.getTime() };
  } catch {
    return { valid: false, reason: "malformed" };
  }
}
