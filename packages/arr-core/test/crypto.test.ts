import { describe, expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import {
  generateKeyPair,
  parseSignedAttestationJson,
  signAttestation,
  verifyAttestation,
  type Attestation,
  type SignedAttestation,
} from "../src/index.js";

function buildAttestation(overrides: Partial<Attestation> = {}): Attestation {
  return {
    version: "arr/0.1",
    id: "test-id",
    created: "2026-01-29T10:30:00Z",
    creator: overrides.creator ?? "pubkey:ed25519:test",
    ...overrides,
  };
}

describe("sign and verify", () => {
  test("verifies a valid signature with explicit public key", () => {
    const { privateKeyPem, publicKeyPem, creator } = generateKeyPair();
    const attestation = buildAttestation({ creator });
    const signed = signAttestation(attestation, privateKeyPem);

    const result = verifyAttestation(signed, publicKeyPem);

    expect(result.valid).toBe(true);
    expect(result.expired).toBe(false);
  });

  test("returns invalid_signature for tampered attestation", () => {
    const { privateKeyPem, publicKeyPem, creator } = generateKeyPair();
    const signed = signAttestation(buildAttestation({ creator, intent: "Original" }), privateKeyPem);

    const tampered: SignedAttestation = {
      ...signed,
      attestation: {
        ...signed.attestation,
        intent: "Tampered",
      },
    };

    const result = verifyAttestation(tampered, publicKeyPem);

    expect(result).toEqual({ valid: false, reason: "invalid_signature" });
  });

  test("returns unsupported_version when version is not arr/0.1", () => {
    const { privateKeyPem, publicKeyPem, creator } = generateKeyPair();
    const signed = signAttestation(buildAttestation({ creator }), privateKeyPem);

    const result = verifyAttestation(
      {
        ...signed,
        attestation: {
          ...signed.attestation,
          version: "arr/9.9" as Attestation["version"],
        },
      },
      publicKeyPem,
    );

    expect(result).toEqual({ valid: false, reason: "unsupported_version" });
  });

  test("returns valid true and expired true for expired attestations", () => {
    const { privateKeyPem, publicKeyPem, creator } = generateKeyPair();
    const signed = signAttestation(
      buildAttestation({
        creator,
        created: "2020-01-01T00:00:00Z",
        expires: "2020-01-02",
      }),
      privateKeyPem,
    );

    const result = verifyAttestation(signed, publicKeyPem);

    expect(result).toEqual({ valid: true, expired: true });
  });

  test("returns missing_public_key when creator key cannot be discovered", () => {
    const { privateKeyPem } = generateKeyPair();
    const signed = signAttestation(buildAttestation({ creator: "hash:sha256:abc" }), privateKeyPem);

    const result = verifyAttestation(signed);

    expect(result).toEqual({ valid: false, reason: "missing_public_key" });
  });

  test("parses conformance fixture payload shape", async () => {
    const fixturePath = "fixtures/conformance/v0.1/valid.signed.json";
    const raw = await readFile(fixturePath, "utf8");

    const parsed = parseSignedAttestationJson(raw);

    expect(parsed.attestation.version).toBe("arr/0.1");
    expect(parsed.signature.startsWith("ed25519:")).toBe(true);
  });
});
