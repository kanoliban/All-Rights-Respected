import type { Attestation, SignedAttestation } from "@allrightsrespected/sdk";

export type ArrEventType =
  | "arr.attestation.draft.created"
  | "arr.attestation.signed"
  | "arr.attestation.published"
  | "arr.attestation.verified"
  | "arr.attestation.renewed"
  | "arr.attestation.revoked";

export interface ArrSelectionContext {
  type: "rect" | "point" | "range" | "object" | "unknown";
  bounds?: [number, number, number, number];
  text?: string;
  object_id?: string;
}

export interface ArrInteractionContext {
  content_hash?: string;
  file_path?: string;
  tool?: string;
  selection?: ArrSelectionContext;
  session?: string;
  surface?: string;
}

export interface ArrRevocationRecord {
  attestation_id: string;
  revoked_at: string;
  reason?: string;
}

export interface ArrSignedRevocation {
  revocation: ArrRevocationRecord;
  signature: string;
}

export interface ArrEventPayload {
  attestation?: Attestation;
  signed_attestation?: SignedAttestation;
  revocation?: ArrSignedRevocation;
  context?: ArrInteractionContext;
  message?: string;
}

export interface ArrEvent {
  version: "arr/event/0.1";
  id: string;
  type: ArrEventType;
  created: string;
  session?: string;
  payload?: ArrEventPayload;
}

export interface ArrEventEnvelope {
  event: ArrEvent;
}

export interface ArrMcpServerOptions {
  name: string;
  version: string;
}

export interface ArrMcpServer {
  start(): Promise<void>;
  stop(): Promise<void>;
}
