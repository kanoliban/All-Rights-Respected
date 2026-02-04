import { describe, expect, test } from "vitest";
import { canonicalizeAttestation, type Attestation } from "../src/index.js";

describe("canonicalizeAttestation", () => {
  test("sorts keys recursively and deterministically", () => {
    const base: Attestation = {
      version: "arr/0.1",
      id: "id-1",
      created: "2026-01-01T00:00:00Z",
      creator: "pubkey:ed25519:test",
      extensions: {
        zebra: 1,
        alpha: {
          second: 2,
          first: 1,
        },
      },
    };

    const shuffled: Attestation = {
      creator: base.creator,
      created: base.created,
      id: base.id,
      version: base.version,
      extensions: {
        alpha: {
          first: 1,
          second: 2,
        },
        zebra: 1,
      },
    };

    const left = canonicalizeAttestation(base);
    const right = canonicalizeAttestation(shuffled);

    expect(left).toBe(right);
    expect(left).toBe(
      '{"created":"2026-01-01T00:00:00Z","creator":"pubkey:ed25519:test","extensions":{"alpha":{"first":1,"second":2},"zebra":1},"id":"id-1","version":"arr/0.1"}',
    );
  });
});
