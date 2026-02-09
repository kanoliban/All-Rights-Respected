import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createArrMcpServer } from "../src/server.js";
import {
  generateKeyPair,
  signAttestation,
  verifyAttestation,
} from "@allrightsrespected/sdk";
import { buildAttestation } from "../src/internal.js";
import type { ArrEventEnvelope, ArrMcpServer } from "../src/types.js";

const TEST_PORT = 18787;

let server: ArrMcpServer;
let keys: ReturnType<typeof generateKeyPair>;

function base(path: string): string {
  return `http://127.0.0.1:${TEST_PORT}${path}`;
}

beforeAll(async () => {
  keys = generateKeyPair();
  server = createArrMcpServer({
    name: "arr-mcp-test",
    version: "0.1.0-test",
    transport: "http",
    http: { port: TEST_PORT },
  });
  await server.start();
});

afterAll(async () => {
  await server.stop();
});

describe("buildAttestation + arr-core integration", () => {
  test("buildAttestation output is signable by arr-core", () => {
    const draft = buildAttestation({ creator: keys.creator, intent: "Integration test" });

    expect(draft.version).toBe("arr/0.1");
    expect(draft.creator).toBe(keys.creator);

    const signed = signAttestation(draft, keys.privateKeyPem);
    expect(signed.signature).toMatch(/^ed25519:/);

    const result = verifyAttestation(signed, keys.publicKeyPem);
    expect(result.valid).toBe(true);
    expect(result.expired).toBe(false);
  });

  test("buildAttestation with content_hash and renews", () => {
    const original = buildAttestation({ creator: keys.creator });
    const renewed = buildAttestation(
      { creator: keys.creator, content_hash: "sha256:abc" },
      { renews: original.id },
    );

    expect(renewed.renews).toBe(original.id);
    expect(renewed.content_hash).toBe("sha256:abc");
    expect(renewed.id).not.toBe(original.id);

    const signed = signAttestation(renewed, keys.privateKeyPem);
    const result = verifyAttestation(signed, keys.publicKeyPem);
    expect(result.valid).toBe(true);
  });

  test("buildAttestation rejects invalid expires", () => {
    expect(() => buildAttestation({ creator: keys.creator, expires: "not-a-date" })).toThrow();
  });

  test("buildAttestation with explicit expires produces verifiable attestation", () => {
    const draft = buildAttestation({
      creator: keys.creator,
      expires: "2030-12-31",
    });

    const signed = signAttestation(draft, keys.privateKeyPem);
    const result = verifyAttestation(signed, keys.publicKeyPem);
    expect(result.valid).toBe(true);
    expect(result.expired).toBe(false);
  });

  test("buildAttestation with past expires results in expired verification", () => {
    const draft = buildAttestation({
      creator: keys.creator,
      created: "2020-01-01T00:00:00Z",
      expires: "2020-06-01",
    });

    const signed = signAttestation(draft, keys.privateKeyPem);
    const result = verifyAttestation(signed, keys.publicKeyPem);
    expect(result.valid).toBe(true);
    expect(result.expired).toBe(true);
  });

  test("tampered attestation fails verification", () => {
    const draft = buildAttestation({ creator: keys.creator, intent: "Original" });
    const signed = signAttestation(draft, keys.privateKeyPem);
    const tampered = {
      ...signed,
      attestation: { ...signed.attestation, intent: "Tampered" },
    };

    const result = verifyAttestation(tampered, keys.publicKeyPem);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("invalid_signature");
  });
});

describe("full lifecycle: draft → sign → renew → revoke", () => {
  test("complete attestation lifecycle with arr-core crypto", () => {
    const draft = buildAttestation({
      creator: keys.creator,
      intent: "Poster design for climate campaign",
      tool: "midjourney/6.1",
      license: "CC-BY-4.0",
    });

    const signed = signAttestation(draft, keys.privateKeyPem);
    expect(verifyAttestation(signed, keys.publicKeyPem).valid).toBe(true);

    const renewed = buildAttestation(
      { creator: keys.creator, intent: "Updated poster design" },
      { renews: draft.id },
    );
    expect(renewed.renews).toBe(draft.id);

    const renewedSigned = signAttestation(renewed, keys.privateKeyPem);
    expect(verifyAttestation(renewedSigned, keys.publicKeyPem).valid).toBe(true);
    expect(renewedSigned.attestation.renews).toBe(draft.id);
  });
});

describe("HTTP endpoints", () => {
  test("POST /messages without sessionId returns 400", async () => {
    const res = await fetch(base("/messages"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("Missing sessionId query param.");
  });

  test("POST /messages with unknown sessionId returns 404", async () => {
    const res = await fetch(base("/messages?sessionId=nonexistent"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("Unknown sessionId.");
  });

  test("GET /unknown returns 404", async () => {
    const res = await fetch(base("/unknown"));
    expect(res.status).toBe(404);
  });
});
