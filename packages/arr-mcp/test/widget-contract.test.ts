import { describe, expect, test } from "vitest";
import {
  widgetSelectionSchema,
  widgetContextSchema,
  draftRequestSchema,
  signRequestSchema,
  revokeRequestSchema,
  isValidTransition,
  stateForEvent,
  WIDGET_STATES,
  WIDGET_TRANSITIONS,
  EVENT_TO_STATE,
} from "../src/widget-contract.js";

describe("widgetSelectionSchema", () => {
  test("rect requires bounds", () => {
    const valid = widgetSelectionSchema.safeParse({
      type: "rect",
      bounds: [10, 20, 100, 200],
    });
    expect(valid.success).toBe(true);

    const missing = widgetSelectionSchema.safeParse({ type: "rect" });
    expect(missing.success).toBe(false);
  });

  test("point requires bounds", () => {
    const valid = widgetSelectionSchema.safeParse({
      type: "point",
      bounds: [150, 300, 0, 0],
    });
    expect(valid.success).toBe(true);

    const missing = widgetSelectionSchema.safeParse({ type: "point" });
    expect(missing.success).toBe(false);
  });

  test("range requires non-empty text", () => {
    const valid = widgetSelectionSchema.safeParse({
      type: "range",
      text: "selected paragraph",
    });
    expect(valid.success).toBe(true);

    const empty = widgetSelectionSchema.safeParse({ type: "range", text: "" });
    expect(empty.success).toBe(false);

    const missing = widgetSelectionSchema.safeParse({ type: "range" });
    expect(missing.success).toBe(false);
  });

  test("object requires non-empty object_id", () => {
    const valid = widgetSelectionSchema.safeParse({
      type: "object",
      object_id: "[data-arr-id='hero-image']",
    });
    expect(valid.success).toBe(true);

    const empty = widgetSelectionSchema.safeParse({ type: "object", object_id: "" });
    expect(empty.success).toBe(false);

    const missing = widgetSelectionSchema.safeParse({ type: "object" });
    expect(missing.success).toBe(false);
  });

  test("unknown allows all optional fields", () => {
    const bare = widgetSelectionSchema.safeParse({ type: "unknown" });
    expect(bare.success).toBe(true);

    const full = widgetSelectionSchema.safeParse({
      type: "unknown",
      bounds: [0, 0, 100, 100],
      text: "something",
      object_id: "#el",
    });
    expect(full.success).toBe(true);
  });

  test("rejects invalid type discriminant", () => {
    const invalid = widgetSelectionSchema.safeParse({ type: "polygon" });
    expect(invalid.success).toBe(false);
  });

  test("rect with optional text and object_id", () => {
    const result = widgetSelectionSchema.safeParse({
      type: "rect",
      bounds: [0, 0, 50, 50],
      text: "alt text",
      object_id: "#img",
    });
    expect(result.success).toBe(true);
  });
});

describe("widgetContextSchema", () => {
  const validContext = {
    surface: "browser",
    tool: "arr-widget/0.1.0",
    file_path: "https://example.com/poster.png",
  };

  test("accepts valid browser context", () => {
    const result = widgetContextSchema.safeParse(validContext);
    expect(result.success).toBe(true);
  });

  test("rejects non-browser surface", () => {
    const result = widgetContextSchema.safeParse({ ...validContext, surface: "desktop" });
    expect(result.success).toBe(false);
  });

  test("rejects tool without arr-widget/ prefix", () => {
    const result = widgetContextSchema.safeParse({ ...validContext, tool: "photoshop/25.1" });
    expect(result.success).toBe(false);
  });

  test("rejects non-URL file_path", () => {
    const result = widgetContextSchema.safeParse({ ...validContext, file_path: "not-a-url" });
    expect(result.success).toBe(false);
  });

  test("rejects content_hash without sha256: prefix", () => {
    const result = widgetContextSchema.safeParse({
      ...validContext,
      content_hash: "md5:abc123",
    });
    expect(result.success).toBe(false);
  });

  test("accepts content_hash with sha256: prefix", () => {
    const result = widgetContextSchema.safeParse({
      ...validContext,
      content_hash: "sha256:abcdef0123456789",
    });
    expect(result.success).toBe(true);
  });

  test("accepts full context with selection", () => {
    const result = widgetContextSchema.safeParse({
      ...validContext,
      selection: { type: "rect", bounds: [10, 20, 300, 400] },
      content_hash: "sha256:abc",
      session: "sess_123",
    });
    expect(result.success).toBe(true);
  });
});

describe("draftRequestSchema", () => {
  test("accepts minimal draft (creator only)", () => {
    const result = draftRequestSchema.safeParse({ creator: "hash:sha256:abc" });
    expect(result.success).toBe(true);
  });

  test("rejects empty creator", () => {
    const result = draftRequestSchema.safeParse({ creator: "" });
    expect(result.success).toBe(false);
  });

  test("accepts full draft with context", () => {
    const result = draftRequestSchema.safeParse({
      creator: "hash:sha256:abc",
      intent: "Poster design for climate campaign",
      tool: "midjourney/6.1",
      license: "CC-BY-4.0",
      context: {
        surface: "browser",
        tool: "arr-widget/0.1.0",
        file_path: "https://example.com/poster.png",
        selection: { type: "rect", bounds: [120, 80, 640, 480] },
      },
    });
    expect(result.success).toBe(true);
  });

  test("rejects draft with invalid context", () => {
    const result = draftRequestSchema.safeParse({
      creator: "hash:sha256:abc",
      context: { surface: "not-browser", tool: "arr-widget/0.1", file_path: "https://x.com" },
    });
    expect(result.success).toBe(false);
  });
});

describe("signRequestSchema", () => {
  const validAttestation = {
    version: "arr/0.1" as const,
    id: "550e8400-e29b-41d4-a716-446655440000",
    created: "2026-02-09T10:00:00Z",
    creator: "hash:sha256:abc",
    intent: "Test",
  };

  test("accepts valid sign request", () => {
    const result = signRequestSchema.safeParse({
      attestation: validAttestation,
      private_key_pem: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
    });
    expect(result.success).toBe(true);
  });

  test("rejects empty private_key_pem", () => {
    const result = signRequestSchema.safeParse({
      attestation: validAttestation,
      private_key_pem: "",
    });
    expect(result.success).toBe(false);
  });

  test("rejects wrong version", () => {
    const result = signRequestSchema.safeParse({
      attestation: { ...validAttestation, version: "arr/0.2" },
      private_key_pem: "key",
    });
    expect(result.success).toBe(false);
  });
});

describe("revokeRequestSchema", () => {
  test("accepts valid revoke request", () => {
    const result = revokeRequestSchema.safeParse({
      attestation_id: "550e8400-e29b-41d4-a716-446655440000",
      reason: "No longer relevant",
      private_key_pem: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
    });
    expect(result.success).toBe(true);
  });

  test("accepts revoke without reason", () => {
    const result = revokeRequestSchema.safeParse({
      attestation_id: "abc",
      private_key_pem: "key",
    });
    expect(result.success).toBe(true);
  });

  test("rejects empty attestation_id", () => {
    const result = revokeRequestSchema.safeParse({
      attestation_id: "",
      private_key_pem: "key",
    });
    expect(result.success).toBe(false);
  });
});

describe("widget state machine", () => {
  test("all states have transition entries", () => {
    for (const state of WIDGET_STATES) {
      expect(WIDGET_TRANSITIONS).toHaveProperty(state);
    }
  });

  test("all transition targets are valid states", () => {
    for (const [, targets] of Object.entries(WIDGET_TRANSITIONS)) {
      for (const target of targets) {
        expect(WIDGET_STATES).toContain(target);
      }
    }
  });

  test("isValidTransition returns true for valid transitions", () => {
    expect(isValidTransition("idle", "selecting")).toBe(true);
    expect(isValidTransition("selecting", "drafting")).toBe(true);
    expect(isValidTransition("drafting", "pending_sign")).toBe(true);
    expect(isValidTransition("pending_sign", "signed")).toBe(true);
    expect(isValidTransition("signed", "publishing")).toBe(true);
    expect(isValidTransition("publishing", "published")).toBe(true);
    expect(isValidTransition("published", "verified")).toBe(true);
  });

  test("isValidTransition returns false for invalid transitions", () => {
    expect(isValidTransition("idle", "signed")).toBe(false);
    expect(isValidTransition("selecting", "published")).toBe(false);
    expect(isValidTransition("verified", "drafting")).toBe(false);
  });

  test("every state can reach idle (reset path exists)", () => {
    for (const state of WIDGET_STATES) {
      if (state === "idle") continue;
      const targets = WIDGET_TRANSITIONS[state];
      const canReachIdle =
        targets.includes("idle") || targets.some((t) => WIDGET_TRANSITIONS[t].includes("idle"));
      expect(canReachIdle).toBe(true);
    }
  });

  test("error state can recover to idle or drafting", () => {
    expect(isValidTransition("error", "idle")).toBe(true);
    expect(isValidTransition("error", "drafting")).toBe(true);
  });
});

describe("EVENT_TO_STATE mapping", () => {
  test("all event types map to valid widget states", () => {
    for (const [, state] of Object.entries(EVENT_TO_STATE)) {
      expect(WIDGET_STATES).toContain(state);
    }
  });

  test("stateForEvent returns correct state", () => {
    expect(stateForEvent("arr.attestation.draft.created")).toBe("pending_sign");
    expect(stateForEvent("arr.attestation.signed")).toBe("signed");
    expect(stateForEvent("arr.attestation.published")).toBe("published");
    expect(stateForEvent("arr.attestation.verified")).toBe("verified");
    expect(stateForEvent("arr.attestation.renewed")).toBe("verified");
    expect(stateForEvent("arr.attestation.revoked")).toBe("idle");
  });

  test("stateForEvent returns undefined for unknown events", () => {
    expect(stateForEvent("arr.unknown.event")).toBeUndefined();
  });
});
