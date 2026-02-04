import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import {
  extractAttestationFromMetadata,
  parseSignedAttestationJson,
  verifyAttestation,
} from "../src/index.js";

const FIXTURE_DIR = "fixtures/conformance/v0.1";

async function readSigned(name: string) {
  const raw = await readFile(`${FIXTURE_DIR}/${name}`, "utf8");
  return parseSignedAttestationJson(raw);
}

describe("conformance fixtures", () => {
  test("valid fixture verifies", async () => {
    const [signed, publicKeyPem] = await Promise.all([
      readSigned("valid.signed.json"),
      readFile(`${FIXTURE_DIR}/public-ed25519.pem`, "utf8"),
    ]);

    expect(verifyAttestation(signed, publicKeyPem)).toEqual({ valid: true, expired: false });
  });

  test("expired fixture verifies with expired=true", async () => {
    const [signed, publicKeyPem] = await Promise.all([
      readSigned("expired.signed.json"),
      readFile(`${FIXTURE_DIR}/public-ed25519.pem`, "utf8"),
    ]);

    expect(verifyAttestation(signed, publicKeyPem)).toEqual({ valid: true, expired: true });
  });

  test("invalid signature fixture reports invalid_signature", async () => {
    const [signed, publicKeyPem] = await Promise.all([
      readSigned("invalid-signature.signed.json"),
      readFile(`${FIXTURE_DIR}/public-ed25519.pem`, "utf8"),
    ]);

    expect(verifyAttestation(signed, publicKeyPem)).toEqual({ valid: false, reason: "invalid_signature" });
  });

  test("unsupported version fixture reports unsupported_version", async () => {
    const [signed, publicKeyPem] = await Promise.all([
      readSigned("unsupported-version.signed.json"),
      readFile(`${FIXTURE_DIR}/public-ed25519.pem`, "utf8"),
    ]);

    expect(verifyAttestation(signed, publicKeyPem)).toEqual({ valid: false, reason: "unsupported_version" });
  });

  test("malformed fixture reports malformed", async () => {
    const raw = await readFile(`${FIXTURE_DIR}/malformed.signed.json`, "utf8");
    const malformed = JSON.parse(raw);

    expect(verifyAttestation(malformed)).toEqual({ valid: false, reason: "malformed" });
  });

  test("embedded PNG and JPEG fixtures extract correctly", async () => {
    const [png, jpeg] = await Promise.all([
      readFile(`${FIXTURE_DIR}/sample.embedded.png`),
      readFile(`${FIXTURE_DIR}/sample.embedded.jpg`),
    ]);

    const [expected, publicKeyPem] = await Promise.all([
      readSigned("valid.signed.json"),
      readFile(`${FIXTURE_DIR}/public-ed25519.pem`, "utf8"),
    ]);

    const extractedPng = extractAttestationFromMetadata(png);
    const extractedJpeg = extractAttestationFromMetadata(jpeg);

    expect(extractedPng?.signed).toEqual(expected);
    expect(extractedJpeg?.signed).toEqual(expected);
    expect(verifyAttestation(extractedPng!.signed, publicKeyPem)).toEqual({ valid: true, expired: false });
    expect(verifyAttestation(extractedJpeg!.signed, publicKeyPem)).toEqual({ valid: true, expired: false });
  });
});
