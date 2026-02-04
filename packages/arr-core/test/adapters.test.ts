import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import {
  detectFileFormat,
  embedAttestationInMetadata,
  extractAttestationFromMetadata,
  generateKeyPair,
  signAttestation,
  type Attestation,
} from "../src/index.js";

function buildAttestation(creator: string): Attestation {
  return {
    version: "arr/0.1",
    id: "embed-id",
    created: "2026-01-29T10:30:00Z",
    creator,
    intent: "embed-roundtrip",
  };
}

describe("PNG and JPEG adapters", () => {
  test("detects PNG and JPEG formats", async () => {
    const [png, jpeg] = await Promise.all([
      readFile("fixtures/conformance/v0.1/sample.png"),
      readFile("fixtures/conformance/v0.1/sample.jpg"),
    ]);

    expect(detectFileFormat(png)).toBe("png");
    expect(detectFileFormat(jpeg)).toBe("jpeg");
  });

  test("roundtrips PNG metadata attestation", async () => {
    const png = await readFile("fixtures/conformance/v0.1/sample.png");
    const { privateKeyPem, creator } = generateKeyPair();
    const signed = signAttestation(buildAttestation(creator), privateKeyPem);

    const embedded = embedAttestationInMetadata(png, signed, "png");
    const extracted = extractAttestationFromMetadata(embedded);

    expect(extracted?.format).toBe("png");
    expect(extracted?.signed).toEqual(signed);

    const reembedded = embedAttestationInMetadata(embedded, signed, "png");
    const keywordCount = reembedded.toString("latin1").split("arr.attestation").length - 1;

    expect(keywordCount).toBe(1);
  });

  test("roundtrips JPEG metadata attestation", async () => {
    const jpeg = await readFile("fixtures/conformance/v0.1/sample.jpg");
    const { privateKeyPem, creator } = generateKeyPair();
    const signed = signAttestation(buildAttestation(creator), privateKeyPem);

    const embedded = embedAttestationInMetadata(jpeg, signed, "jpeg");
    const extracted = extractAttestationFromMetadata(embedded);

    expect(extracted?.format).toBe("jpeg");
    expect(extracted?.signed).toEqual(signed);

    const reembedded = embedAttestationInMetadata(embedded, signed, "jpeg");
    const namespaceCount = reembedded.toString("utf8").split("http://arr.protocol/1.0/").length - 1;

    expect(namespaceCount).toBe(1);
  });
});
