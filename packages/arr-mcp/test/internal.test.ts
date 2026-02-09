import { describe, expect, it } from "vitest";
import { buildAttestation } from "../src/internal.js";

const creator = "pubkey:ed25519:abc";

describe("buildAttestation", () => {
  it("fills id and created when missing", () => {
    const attestation = buildAttestation({ creator });
    expect(attestation.id.length).toBeGreaterThan(10);
    expect(attestation.created).toMatch(/T/);
    expect(attestation.creator).toBe(creator);
    expect(attestation.version).toBe("arr/0.1");
  });

  it("overrides renews when provided", () => {
    const attestation = buildAttestation({ creator }, { renews: "orig-123" });
    expect(attestation.renews).toBe("orig-123");
  });

  it("rejects invalid expires", () => {
    expect(() => buildAttestation({ creator, expires: "nope" })).toThrow();
  });
});
