import { ArrError } from "./errors.js";
import type { SignedAttestation } from "./types.js";
import { assertSignedAttestation } from "./validation.js";

export function parseSignedAttestationJson(raw: string): SignedAttestation {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ArrError("malformed_json", "Signed attestation JSON is invalid.");
  }

  try {
    assertSignedAttestation(parsed);
  } catch {
    throw new ArrError("malformed", "Signed attestation payload is malformed.");
  }

  return parsed;
}

export function serializeSignedAttestation(signed: SignedAttestation): string {
  return `${JSON.stringify(signed, null, 2)}\n`;
}
