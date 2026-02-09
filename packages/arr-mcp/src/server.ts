import { createPrivateKey, randomUUID, sign as signBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  detectFileFormat,
  embedAttestationInMetadata,
  signAttestation,
  verifyAttestation,
  writeSidecar,
  type Attestation,
  type SignedAttestation,
} from "@allrightsrespected/sdk";
import type {
  ArrEvent,
  ArrEventEnvelope,
  ArrEventPayload,
  ArrEventType,
  ArrMcpServer,
  ArrMcpServerOptions,
  ArrSignedRevocation,
} from "./types.js";

const EVENT_VERSION = "arr/event/0.1";
const ED25519_PREFIX = "ed25519:";

const DEFAULT_EVENT_LIMIT = 100;
const MAX_EVENT_BUFFER = 1000;

function encodeBase64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function canonicalizeRecord(value: unknown): string {
  function sortValue(entry: unknown): unknown {
    if (Array.isArray(entry)) {
      return entry.map((item) => sortValue(item));
    }

    if (entry && typeof entry === "object") {
      const entries = Object.entries(entry as Record<string, unknown>).sort(([left], [right]) =>
        left.localeCompare(right),
      );
      const sorted: Record<string, unknown> = {};
      for (const [key, item] of entries) {
        sorted[key] = sortValue(item);
      }
      return sorted;
    }

    return entry;
  }

  return JSON.stringify(sortValue(value));
}

function defaultMetadataOutputPath(inputPath: string): string {
  const parsed = path.parse(inputPath);
  if (!parsed.ext) {
    return path.join(parsed.dir, `${parsed.name}.attested`);
  }
  return path.join(parsed.dir, `${parsed.name}.attested${parsed.ext}`);
}

function buildEvent(type: ArrEventType, payload?: ArrEventPayload, session?: string): ArrEventEnvelope {
  const event: ArrEvent = {
    version: EVENT_VERSION,
    id: randomUUID(),
    type,
    created: new Date().toISOString(),
    session,
    payload,
  };

  return { event };
}

function pushEvent(events: ArrEventEnvelope[], envelope: ArrEventEnvelope): void {
  events.push(envelope);
  if (events.length > MAX_EVENT_BUFFER) {
    events.splice(0, events.length - MAX_EVENT_BUFFER);
  }
}

function listEvents(events: ArrEventEnvelope[], sinceId?: string, limit = DEFAULT_EVENT_LIMIT): ArrEventEnvelope[] {
  if (!sinceId) {
    return events.slice(-limit);
  }

  const index = events.findIndex((entry) => entry.event.id === sinceId);
  if (index < 0) {
    return events.slice(-limit);
  }

  return events.slice(index + 1, index + 1 + limit);
}

async function publishSignedAttestation(
  signed: SignedAttestation,
  filePath: string,
  mode: "auto" | "metadata" | "sidecar",
  outputPath?: string,
): Promise<{ mode: "metadata" | "sidecar"; outputPath: string; format?: "png" | "jpeg" }> {
  if (mode === "sidecar") {
    const written = await writeSidecar(filePath, signed, outputPath);
    return { mode: "sidecar", outputPath: written };
  }

  const bytes = await readFile(filePath);
  const detected = detectFileFormat(bytes);

  if (mode === "metadata" && detected === "unknown") {
    throw new Error("Metadata mode supports only PNG and JPEG. Use mode=sidecar instead.");
  }

  if (detected === "unknown") {
    const written = await writeSidecar(filePath, signed, outputPath);
    return { mode: "sidecar", outputPath: written };
  }

  const embedded = embedAttestationInMetadata(bytes, signed, detected);
  const targetPath = outputPath ?? defaultMetadataOutputPath(filePath);
  await writeFile(targetPath, embedded);

  return { mode: "metadata", outputPath: targetPath, format: detected };
}

export function createArrMcpServer(options: ArrMcpServerOptions): ArrMcpServer {
  const server = new McpServer({ name: options.name, version: options.version });
  const events: ArrEventEnvelope[] = [];
  let transport: StdioServerTransport | null = null;

  const emit = (type: ArrEventType, payload?: ArrEventPayload, session?: string): ArrEventEnvelope => {
    const envelope = buildEvent(type, payload, session);
    pushEvent(events, envelope);
    return envelope;
  };

  const selectionSchema = z
    .object({
      type: z.enum(["rect", "point", "range", "object", "unknown"]),
      bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
      text: z.string().optional(),
      object_id: z.string().optional(),
    })
    .partial()
    .optional();

  const contextSchema = z
    .object({
      content_hash: z.string().optional(),
      file_path: z.string().optional(),
      tool: z.string().optional(),
      selection: selectionSchema,
      session: z.string().optional(),
      surface: z.string().optional(),
    })
    .partial()
    .optional();

  const attestationSchema = z.object({
    version: z.literal("arr/0.1").optional(),
    id: z.string().optional(),
    created: z.string().optional(),
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
  });

  const signedAttestationSchema = z.object({
    attestation: attestationSchema,
    signature: z.string(),
  });

  server.tool(
    "arr.events.list",
    {
      since_id: z.string().optional(),
      limit: z.number().int().min(1).max(500).optional(),
    },
    async ({ since_id, limit }) => {
      const payload = { events: listEvents(events, since_id, limit ?? DEFAULT_EVENT_LIMIT) };
      return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
    },
  );

  server.tool(
    "arr.attestation.create_draft",
    {
      attestation: attestationSchema,
      context: contextSchema,
      session: z.string().optional(),
    },
    async ({ attestation, context, session }) => {
      const created = attestation.created ?? new Date().toISOString();
      const id = attestation.id ?? randomUUID();

      if (attestation.expires) {
        const parsed = new Date(attestation.expires);
        if (Number.isNaN(parsed.getTime())) {
          throw new Error("expires must be a valid ISO-8601 date.");
        }
      }

      const draft: Attestation = {
        version: "arr/0.1",
        id,
        created,
        creator: attestation.creator,
        intent: attestation.intent,
        tool: attestation.tool,
        upstream: attestation.upstream,
        content_hash: attestation.content_hash,
        expires: attestation.expires,
        revocable: attestation.revocable ?? true,
        license: attestation.license,
        renews: attestation.renews,
        extensions: attestation.extensions,
      };

      const envelope = emit("arr.attestation.draft.created", { attestation: draft, context }, session);
      const payload = { attestation: draft, event: envelope };
      return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
    },
  );

  server.tool(
    "arr.attestation.sign",
    {
      attestation: attestationSchema,
      private_key_pem: z.string(),
      context: contextSchema,
      session: z.string().optional(),
    },
    async ({ attestation, private_key_pem, context, session }) => {
      const created = attestation.created ?? new Date().toISOString();
      const id = attestation.id ?? randomUUID();

      const unsigned: Attestation = {
        version: "arr/0.1",
        id,
        created,
        creator: attestation.creator,
        intent: attestation.intent,
        tool: attestation.tool,
        upstream: attestation.upstream,
        content_hash: attestation.content_hash,
        expires: attestation.expires,
        revocable: attestation.revocable ?? true,
        license: attestation.license,
        renews: attestation.renews,
        extensions: attestation.extensions,
      };

      const signed = signAttestation(unsigned, private_key_pem);
      const envelope = emit("arr.attestation.signed", { signed_attestation: signed, context }, session);
      const payload = { signed_attestation: signed, event: envelope };
      return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
    },
  );

  server.tool(
    "arr.attestation.publish",
    {
      signed_attestation: signedAttestationSchema,
      file_path: z.string(),
      mode: z.enum(["auto", "metadata", "sidecar"]).optional(),
      output_path: z.string().optional(),
      context: contextSchema,
      session: z.string().optional(),
    },
    async ({ signed_attestation, file_path, mode, output_path, context, session }) => {
      const result = await publishSignedAttestation(
        signed_attestation as SignedAttestation,
        file_path,
        mode ?? "auto",
        output_path,
      );
      const enrichedContext = {
        ...context,
        file_path: context?.file_path ?? file_path,
      };

      const envelope = emit(
        "arr.attestation.published",
        { signed_attestation, context: enrichedContext },
        session,
      );

      const payload = { result, event: envelope };
      return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
    },
  );

  server.tool(
    "arr.attestation.verify",
    {
      signed_attestation: signedAttestationSchema,
      public_key_pem: z.string().optional(),
      context: contextSchema,
      session: z.string().optional(),
    },
    async ({ signed_attestation, public_key_pem, context, session }) => {
      const result = verifyAttestation(
        signed_attestation as SignedAttestation,
        public_key_pem,
      );
      const envelope = emit(
        "arr.attestation.verified",
        { signed_attestation, context },
        session,
      );
      const payload = { result, event: envelope };
      return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
    },
  );

  server.tool(
    "arr.revocation.create",
    {
      attestation_id: z.string(),
      reason: z.string().optional(),
      revoked_at: z.string().optional(),
      private_key_pem: z.string(),
      context: contextSchema,
      session: z.string().optional(),
    },
    async ({ attestation_id, reason, revoked_at, private_key_pem, context, session }) => {
      const record = {
        attestation_id,
        revoked_at: revoked_at ?? new Date().toISOString(),
        ...(reason ? { reason } : {}),
      };

      const canonical = canonicalizeRecord(record);
      const key = createPrivateKey(private_key_pem);
      const signature = signBytes(null, Buffer.from(canonical, "utf8"), key);
      const signed: ArrSignedRevocation = {
        revocation: record,
        signature: `${ED25519_PREFIX}${encodeBase64Url(signature)}`,
      };

      const envelope = emit("arr.attestation.revoked", { revocation: signed, context }, session);
      const payload = { revocation: signed, event: envelope };
      return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
    },
  );

  return {
    async start(): Promise<void> {
      transport = new StdioServerTransport();
      await server.connect(transport);
    },
    async stop(): Promise<void> {
      if (transport) {
        await transport.close();
      }
      await server.close();
    },
  };
}
