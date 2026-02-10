import { z } from "zod";
import type { Attestation, SignedAttestation, VerificationResult } from "@allrightsrespected/sdk";
import type { ArrEventEnvelope, ArrInteractionContext, ArrSignedRevocation } from "./types.js";

// ── Bounds ─────────────────────────────────────────────────────

const boundsSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

// ── Selection (discriminated union: enforces required fields per type) ──
//
// rect  → bounds required (pixel rectangle)
// point → bounds required (x, y with w=0, h=0 by convention)
// range → text required (DOM text selection), bounds optional
// object → object_id required (CSS selector or data-arr-id), bounds optional
// unknown → all optional (fallback)

export const widgetSelectionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("rect"),
    bounds: boundsSchema,
    text: z.string().optional(),
    object_id: z.string().optional(),
  }),
  z.object({
    type: z.literal("point"),
    bounds: boundsSchema,
    text: z.string().optional(),
    object_id: z.string().optional(),
  }),
  z.object({
    type: z.literal("range"),
    text: z.string().min(1),
    bounds: boundsSchema.optional(),
    object_id: z.string().optional(),
  }),
  z.object({
    type: z.literal("object"),
    object_id: z.string().min(1),
    bounds: boundsSchema.optional(),
    text: z.string().optional(),
  }),
  z.object({
    type: z.literal("unknown"),
    bounds: boundsSchema.optional(),
    text: z.string().optional(),
    object_id: z.string().optional(),
  }),
]);

export type WidgetSelection = z.infer<typeof widgetSelectionSchema>;

// ── Widget Context ─────────────────────────────────────────────
//
// Maps browser state to ArrInteractionContext:
//   surface  → always "browser"
//   tool     → "arr-widget/<version>"
//   file_path → page URL (location.href)
//   selection → captured WidgetSelection
//   content_hash → optional sha256 of selected content
//   session  → widget session ID (persisted per tab)

export const widgetContextSchema = z.object({
  surface: z.literal("browser"),
  tool: z.string().regex(/^arr-widget\//, "tool must start with arr-widget/"),
  file_path: z.string().url(),
  selection: widgetSelectionSchema.optional(),
  content_hash: z.string().regex(/^sha256:/, "content_hash must use sha256: prefix").optional(),
  session: z.string().optional(),
});

export type WidgetContext = z.infer<typeof widgetContextSchema>;

// ── Widget State Machine ───────────────────────────────────────

export const WIDGET_STATES = [
  "idle",
  "selecting",
  "drafting",
  "pending_sign",
  "signed",
  "publishing",
  "published",
  "verified",
  "error",
] as const;

export type WidgetState = (typeof WIDGET_STATES)[number];

export const WIDGET_TRANSITIONS: Record<WidgetState, readonly WidgetState[]> = {
  idle: ["selecting"],
  selecting: ["idle", "drafting"],
  drafting: ["idle", "pending_sign", "error"],
  pending_sign: ["signed", "idle", "error"],
  signed: ["publishing", "idle"],
  publishing: ["published", "error"],
  published: ["verified", "idle"],
  verified: ["idle"],
  error: ["idle", "drafting"],
} as const;

export const EVENT_TO_STATE: Readonly<Record<string, WidgetState>> = {
  "arr.attestation.draft.created": "pending_sign",
  "arr.attestation.signed": "signed",
  "arr.attestation.published": "published",
  "arr.attestation.verified": "verified",
  "arr.attestation.renewed": "verified",
  "arr.attestation.revoked": "idle",
} as const;

// ── REST API Endpoint Paths ────────────────────────────────────

export const WIDGET_API = {
  draft: "/api/v1/attestation/draft",
  sign: "/api/v1/attestation/sign",
  publish: "/api/v1/attestation/publish",
  verify: "/api/v1/attestation/verify",
  renew: "/api/v1/attestation/renew",
  revoke: "/api/v1/attestation/revoke",
  events: "/events",
} as const;

// ── Request Schemas ────────────────────────────────────────────
//
// These define what the widget POSTs to each REST endpoint.
// The server validates these before delegating to MCP tool handlers.

export const draftRequestSchema = z.object({
  creator: z.string().min(1),
  intent: z.string().optional(),
  tool: z.string().optional(),
  license: z.string().optional(),
  upstream: z.array(z.string()).optional(),
  content_hash: z.string().optional(),
  expires: z.string().optional(),
  extensions: z.record(z.unknown()).optional(),
  context: widgetContextSchema.optional(),
  session: z.string().optional(),
});

export type DraftRequest = z.infer<typeof draftRequestSchema>;

export const signRequestSchema = z.object({
  attestation: z.object({
    version: z.literal("arr/0.1"),
    id: z.string(),
    created: z.string(),
    creator: z.string(),
    intent: z.string().optional(),
    tool: z.string().optional(),
    upstream: z.array(z.string()).optional(),
    content_hash: z.string().optional(),
    expires: z.string().optional(),
    revocable: z.boolean().optional(),
    license: z.string().optional(),
    renews: z.string().optional(),
    extensions: z.record(z.unknown()).optional(),
  }),
  private_key_pem: z.string().min(1),
  context: widgetContextSchema.optional(),
  session: z.string().optional(),
});

export type SignRequest = z.infer<typeof signRequestSchema>;

export const publishRequestSchema = z.object({
  signed_attestation: z.object({
    attestation: z.object({
      version: z.literal("arr/0.1"),
      id: z.string(),
      created: z.string(),
      creator: z.string(),
    }).passthrough(),
    signature: z.string(),
  }),
  file_path: z.string().min(1),
  mode: z.enum(["auto", "metadata", "sidecar"]).optional(),
  output_path: z.string().optional(),
  context: widgetContextSchema.optional(),
  session: z.string().optional(),
});

export type PublishRequest = z.infer<typeof publishRequestSchema>;

export const verifyRequestSchema = z.object({
  signed_attestation: z.object({
    attestation: z.object({
      version: z.literal("arr/0.1"),
      id: z.string(),
      created: z.string(),
      creator: z.string(),
    }).passthrough(),
    signature: z.string(),
  }),
  public_key_pem: z.string().optional(),
  context: widgetContextSchema.optional(),
  session: z.string().optional(),
});

export type VerifyRequest = z.infer<typeof verifyRequestSchema>;

export const renewRequestSchema = z.object({
  renews: z.string().min(1),
  creator: z.string().min(1),
  intent: z.string().optional(),
  tool: z.string().optional(),
  license: z.string().optional(),
  private_key_pem: z.string().min(1),
  context: widgetContextSchema.optional(),
  session: z.string().optional(),
});

export type RenewRequest = z.infer<typeof renewRequestSchema>;

export const revokeRequestSchema = z.object({
  attestation_id: z.string().min(1),
  reason: z.string().optional(),
  private_key_pem: z.string().min(1),
  context: widgetContextSchema.optional(),
  session: z.string().optional(),
});

export type RevokeRequest = z.infer<typeof revokeRequestSchema>;

// ── Response Types ─────────────────────────────────────────────
//
// TypeScript types only (no Zod): the widget trusts server responses.

export interface DraftResponse {
  attestation: Attestation;
  event: ArrEventEnvelope;
}

export interface SignResponse {
  signed_attestation: SignedAttestation;
  event: ArrEventEnvelope;
}

export interface PublishResponse {
  result: {
    mode: "metadata" | "sidecar";
    outputPath: string;
    format?: "png" | "jpeg";
  };
  event: ArrEventEnvelope;
}

export interface VerifyResponse {
  result: VerificationResult;
  event: ArrEventEnvelope;
}

export interface RenewResponse {
  signed_attestation: SignedAttestation;
  event: ArrEventEnvelope;
}

export interface RevokeResponse {
  revocation: ArrSignedRevocation;
  event: ArrEventEnvelope;
}

// ── Validation Helpers ─────────────────────────────────────────

export function isValidTransition(from: WidgetState, to: WidgetState): boolean {
  return (WIDGET_TRANSITIONS[from] as readonly string[]).includes(to);
}

export function stateForEvent(eventType: string): WidgetState | undefined {
  return EVENT_TO_STATE[eventType];
}
