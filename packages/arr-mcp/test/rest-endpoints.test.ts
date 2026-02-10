import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createArrMcpServer } from "../src/server.js";
import { generateKeyPair, verifyAttestation } from "@allrightsrespected/sdk";
import { WIDGET_API } from "../src/widget-contract.js";
import type { ArrMcpServer } from "../src/types.js";
import type { Attestation, SignedAttestation } from "@allrightsrespected/sdk";

const TEST_PORT = 18788;

let server: ArrMcpServer;
let keys: ReturnType<typeof generateKeyPair>;

function url(path: string): string {
  return `http://127.0.0.1:${TEST_PORT}${path}`;
}

function post(path: string, body: unknown): Promise<Response> {
  return fetch(url(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  keys = generateKeyPair();
  server = createArrMcpServer({
    name: "arr-rest-test",
    version: "0.1.0-test",
    transport: "http",
    http: { port: TEST_PORT },
  });
  await server.start();
});

afterAll(async () => {
  await server.stop();
});

describe("CORS", () => {
  test("OPTIONS preflight returns 204 with CORS headers", async () => {
    const res = await fetch(url(WIDGET_API.draft), { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });

  test("POST responses include CORS headers", async () => {
    const res = await post(WIDGET_API.draft, { creator: keys.creator });
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});

describe("POST /api/v1/attestation/draft", () => {
  test("creates draft with valid creator", async () => {
    const res = await post(WIDGET_API.draft, {
      creator: keys.creator,
      intent: "REST test draft",
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { attestation: Attestation; event: { event: { type: string } } };
    expect(body.attestation.version).toBe("arr/0.1");
    expect(body.attestation.creator).toBe(keys.creator);
    expect(body.attestation.intent).toBe("REST test draft");
    expect(body.event.event.type).toBe("arr.attestation.draft.created");
  });

  test("returns 400 for missing creator", async () => {
    const res = await post(WIDGET_API.draft, { intent: "no creator" });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Invalid draft request.");
  });

  test("returns 400 for empty body", async () => {
    const res = await post(WIDGET_API.draft, {});
    expect(res.status).toBe(400);
  });

  test("accepts draft with widget context", async () => {
    const res = await post(WIDGET_API.draft, {
      creator: keys.creator,
      intent: "Poster design",
      context: {
        surface: "browser",
        tool: "arr-widget/0.1.0",
        file_path: "https://example.com/poster.png",
        selection: { type: "rect", bounds: [120, 80, 640, 480] },
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { attestation: Attestation };
    expect(body.attestation.creator).toBe(keys.creator);
  });
});

describe("POST /api/v1/attestation/sign", () => {
  test("signs a draft attestation", async () => {
    const draftRes = await post(WIDGET_API.draft, { creator: keys.creator, intent: "Sign test" });
    const { attestation } = await draftRes.json() as { attestation: Attestation };

    const res = await post(WIDGET_API.sign, {
      attestation,
      private_key_pem: keys.privateKeyPem,
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { signed_attestation: SignedAttestation; event: { event: { type: string } } };
    expect(body.signed_attestation.signature).toMatch(/^ed25519:/);
    expect(body.signed_attestation.attestation.creator).toBe(keys.creator);
    expect(body.event.event.type).toBe("arr.attestation.signed");
  });

  test("returns 400 for missing private key", async () => {
    const draftRes = await post(WIDGET_API.draft, { creator: keys.creator });
    const { attestation } = await draftRes.json() as { attestation: Attestation };

    const res = await post(WIDGET_API.sign, { attestation });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/attestation/verify", () => {
  test("verifies a valid signed attestation", async () => {
    const draftRes = await post(WIDGET_API.draft, { creator: keys.creator, intent: "Verify test" });
    const { attestation } = await draftRes.json() as { attestation: Attestation };

    const signRes = await post(WIDGET_API.sign, {
      attestation,
      private_key_pem: keys.privateKeyPem,
    });
    const { signed_attestation } = await signRes.json() as { signed_attestation: SignedAttestation };

    const res = await post(WIDGET_API.verify, {
      signed_attestation,
      public_key_pem: keys.publicKeyPem,
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { result: { valid: boolean; expired: boolean }; event: { event: { type: string } } };
    expect(body.result.valid).toBe(true);
    expect(body.result.expired).toBe(false);
    expect(body.event.event.type).toBe("arr.attestation.verified");
  });

  test("detects tampered attestation", async () => {
    const draftRes = await post(WIDGET_API.draft, { creator: keys.creator, intent: "Original" });
    const { attestation } = await draftRes.json() as { attestation: Attestation };

    const signRes = await post(WIDGET_API.sign, {
      attestation,
      private_key_pem: keys.privateKeyPem,
    });
    const { signed_attestation } = await signRes.json() as { signed_attestation: SignedAttestation };

    const tampered = {
      ...signed_attestation,
      attestation: { ...signed_attestation.attestation, intent: "Tampered" },
    };

    const res = await post(WIDGET_API.verify, {
      signed_attestation: tampered,
      public_key_pem: keys.publicKeyPem,
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { result: { valid: boolean; reason: string } };
    expect(body.result.valid).toBe(false);
    expect(body.result.reason).toBe("invalid_signature");
  });
});

describe("POST /api/v1/attestation/renew", () => {
  test("renews an existing attestation", async () => {
    const draftRes = await post(WIDGET_API.draft, { creator: keys.creator, intent: "Original" });
    const { attestation: original } = await draftRes.json() as { attestation: Attestation };

    const res = await post(WIDGET_API.renew, {
      renews: original.id,
      creator: keys.creator,
      intent: "Updated",
      private_key_pem: keys.privateKeyPem,
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { signed_attestation: SignedAttestation; event: { event: { type: string } } };
    expect(body.signed_attestation.attestation.renews).toBe(original.id);
    expect(body.signed_attestation.attestation.intent).toBe("Updated");
    expect(body.signed_attestation.signature).toMatch(/^ed25519:/);
    expect(body.event.event.type).toBe("arr.attestation.renewed");

    const verifyResult = verifyAttestation(body.signed_attestation, keys.publicKeyPem);
    expect(verifyResult.valid).toBe(true);
  });

  test("returns 400 for missing renews field", async () => {
    const res = await post(WIDGET_API.renew, {
      creator: keys.creator,
      private_key_pem: keys.privateKeyPem,
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/attestation/revoke", () => {
  test("revokes an attestation", async () => {
    const draftRes = await post(WIDGET_API.draft, { creator: keys.creator });
    const { attestation } = await draftRes.json() as { attestation: Attestation };

    const res = await post(WIDGET_API.revoke, {
      attestation_id: attestation.id,
      reason: "No longer relevant",
      private_key_pem: keys.privateKeyPem,
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { revocation: { revocation: { attestation_id: string; reason: string }; signature: string }; event: { event: { type: string } } };
    expect(body.revocation.revocation.attestation_id).toBe(attestation.id);
    expect(body.revocation.revocation.reason).toBe("No longer relevant");
    expect(body.revocation.signature).toMatch(/^ed25519:/);
    expect(body.event.event.type).toBe("arr.attestation.revoked");
  });

  test("revokes without reason", async () => {
    const res = await post(WIDGET_API.revoke, {
      attestation_id: "some-id",
      private_key_pem: keys.privateKeyPem,
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { revocation: { revocation: { attestation_id: string; reason?: string } } };
    expect(body.revocation.revocation.attestation_id).toBe("some-id");
    expect(body.revocation.revocation).not.toHaveProperty("reason");
  });

  test("returns 400 for missing attestation_id", async () => {
    const res = await post(WIDGET_API.revoke, {
      private_key_pem: keys.privateKeyPem,
    });
    expect(res.status).toBe(400);
  });
});

describe("full lifecycle via REST", () => {
  test("draft → sign → verify → renew → verify → revoke", async () => {
    // #given — draft
    const draftRes = await post(WIDGET_API.draft, {
      creator: keys.creator,
      intent: "Climate poster v1",
      tool: "midjourney/6.1",
      license: "CC-BY-4.0",
    });
    expect(draftRes.status).toBe(200);
    const { attestation: draft } = await draftRes.json() as { attestation: Attestation };

    // #when — sign
    const signRes = await post(WIDGET_API.sign, {
      attestation: draft,
      private_key_pem: keys.privateKeyPem,
    });
    expect(signRes.status).toBe(200);
    const { signed_attestation: signed } = await signRes.json() as { signed_attestation: SignedAttestation };

    // #then — verify
    const verifyRes = await post(WIDGET_API.verify, {
      signed_attestation: signed,
      public_key_pem: keys.publicKeyPem,
    });
    expect(verifyRes.status).toBe(200);
    const { result: verifyResult } = await verifyRes.json() as { result: { valid: boolean } };
    expect(verifyResult.valid).toBe(true);

    // #when — renew
    const renewRes = await post(WIDGET_API.renew, {
      renews: draft.id,
      creator: keys.creator,
      intent: "Climate poster v2",
      private_key_pem: keys.privateKeyPem,
    });
    expect(renewRes.status).toBe(200);
    const { signed_attestation: renewed } = await renewRes.json() as { signed_attestation: SignedAttestation };
    expect(renewed.attestation.renews).toBe(draft.id);
    expect(renewed.attestation.intent).toBe("Climate poster v2");

    // #then — verify renewal
    const verifyRenewRes = await post(WIDGET_API.verify, {
      signed_attestation: renewed,
      public_key_pem: keys.publicKeyPem,
    });
    expect(verifyRenewRes.status).toBe(200);
    const { result: renewVerify } = await verifyRenewRes.json() as { result: { valid: boolean } };
    expect(renewVerify.valid).toBe(true);

    // #when — revoke original
    const revokeRes = await post(WIDGET_API.revoke, {
      attestation_id: draft.id,
      reason: "Superseded by v2",
      private_key_pem: keys.privateKeyPem,
    });
    expect(revokeRes.status).toBe(200);
    const { revocation } = await revokeRes.json() as { revocation: { revocation: { attestation_id: string } } };
    expect(revocation.revocation.attestation_id).toBe(draft.id);
  });
});
