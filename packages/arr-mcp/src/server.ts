import { createPrivateKey, randomUUID, sign as signBytes } from "node:crypto";
import { EventEmitter } from "node:events";
import { createServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  detectFileFormat,
  embedAttestationInMetadata,
  signAttestation,
  verifyAttestation,
  writeSidecar,
  type SignedAttestation,
} from "@allrightsrespected/sdk";
import { buildAttestation, canonicalizeRecord, type AttestationInput } from "./internal.js";
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
const DEFAULT_HTTP_HOST = "127.0.0.1";
const DEFAULT_HTTP_PORT = 8787;
const DEFAULT_MCP_SSE_PATH = "/sse";
const DEFAULT_MCP_MESSAGE_PATH = "/messages";
const DEFAULT_EVENTS_PATH = "/events";

function encodeBase64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
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

function writeSse(res: ServerResponse, data: unknown): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return undefined;
  }

  return JSON.parse(raw);
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
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0);
  const eventStreams = new Set<ServerResponse>();
  const sseSessions = new Map<string, SSEServerTransport>();
  let stdioTransport: StdioServerTransport | null = null;
  let httpServer: HttpServer | null = null;

  const httpConfig = {
    host: options.http?.host ?? DEFAULT_HTTP_HOST,
    port: options.http?.port ?? DEFAULT_HTTP_PORT,
    mcpSsePath: options.http?.mcpSsePath ?? DEFAULT_MCP_SSE_PATH,
    mcpMessagePath: options.http?.mcpMessagePath ?? DEFAULT_MCP_MESSAGE_PATH,
    eventsPath: options.http?.eventsPath ?? DEFAULT_EVENTS_PATH,
  };

  const emit = (type: ArrEventType, payload?: ArrEventPayload, session?: string): ArrEventEnvelope => {
    const envelope = buildEvent(type, payload, session);
    pushEvent(events, envelope);
    emitter.emit("event", envelope);
    for (const res of eventStreams) {
      writeSse(res, envelope);
    }
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

  const toAttestationInput = (input: z.infer<typeof attestationSchema>): AttestationInput => ({
    creator: input.creator,
    id: input.id,
    created: input.created,
    intent: input.intent,
    tool: input.tool,
    upstream: input.upstream,
    content_hash: input.content_hash,
    expires: input.expires,
    revocable: input.revocable,
    license: input.license,
    renews: input.renews,
    extensions: input.extensions,
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
      const draft = buildAttestation(toAttestationInput(attestation));

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
      const unsigned = buildAttestation(toAttestationInput(attestation));
      const signed = signAttestation(unsigned, private_key_pem);
      const envelope = emit("arr.attestation.signed", { signed_attestation: signed, context }, session);
      const payload = { signed_attestation: signed, event: envelope };
      return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
    },
  );

  server.tool(
    "arr.attestation.renew",
    {
      renews: z.string(),
      attestation: attestationSchema,
      private_key_pem: z.string(),
      context: contextSchema,
      session: z.string().optional(),
    },
    async ({ renews, attestation, private_key_pem, context, session }) => {
      const renewed = buildAttestation(toAttestationInput(attestation), { renews });
      const signed = signAttestation(renewed, private_key_pem);
      const envelope = emit("arr.attestation.renewed", { signed_attestation: signed, context }, session);
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
    "arr.events.watch",
    {
      since_id: z.string().optional(),
      timeout_ms: z.number().int().min(250).max(120000).optional(),
      limit: z.number().int().min(1).max(500).optional(),
    },
    async ({ since_id, timeout_ms, limit }) => {
      const existing = listEvents(events, since_id, limit ?? DEFAULT_EVENT_LIMIT);
      if (existing.length > 0) {
        return { content: [{ type: "text", text: JSON.stringify({ events: existing }, null, 2) }] };
      }

      const timeout = timeout_ms ?? 30000;

      const next = await new Promise<ArrEventEnvelope | null>((resolve) => {
        const handler = (envelope: ArrEventEnvelope) => {
          clearTimeout(timer);
          emitter.removeListener("event", handler);
          resolve(envelope);
        };

        const timer = setTimeout(() => {
          emitter.removeListener("event", handler);
          resolve(null);
        }, timeout);

        emitter.on("event", handler);
      });

      const payload = next
        ? { events: listEvents(events, since_id, limit ?? DEFAULT_EVENT_LIMIT) }
        : { events: [] };

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
      const mode = options.transport ?? "stdio";

      if (mode === "stdio" || mode === "both") {
        stdioTransport = new StdioServerTransport();
        await server.connect(stdioTransport);
      }

      if (mode === "http" || mode === "both") {
        httpServer = createServer(async (req, res) => {
          const url = new URL(req.url ?? "/", `http://${httpConfig.host}:${httpConfig.port}`);

          if (req.method === "GET" && url.pathname === httpConfig.eventsPath) {
            res.writeHead(200, {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            });

            const sinceId = url.searchParams.get("since_id") ?? undefined;
            const backlog = listEvents(events, sinceId, DEFAULT_EVENT_LIMIT);
            backlog.forEach((entry) => writeSse(res, entry));

            eventStreams.add(res);
            req.on("close", () => {
              eventStreams.delete(res);
            });
            return;
          }

          if (req.method === "GET" && url.pathname === httpConfig.mcpSsePath) {
            const transport = new SSEServerTransport(httpConfig.mcpMessagePath, res);
            sseSessions.set(transport.sessionId, transport);
            req.on("close", () => {
              sseSessions.delete(transport.sessionId);
            });
            await server.connect(transport);
            return;
          }

          if (req.method === "POST" && url.pathname === httpConfig.mcpMessagePath) {
            const sessionId = url.searchParams.get("sessionId");
            if (!sessionId) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Missing sessionId query param." }));
              return;
            }

            const transport = sseSessions.get(sessionId);
            if (!transport) {
              res.writeHead(404, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Unknown sessionId." }));
              return;
            }

            let body: unknown;
            try {
              body = await readJsonBody(req);
            } catch (error) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid JSON body." }));
              return;
            }

            await transport.handlePostMessage(req, res, body);
            return;
          }

          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not found");
        });

        await new Promise<void>((resolve) => {
          httpServer?.listen(httpConfig.port, httpConfig.host, () => resolve());
        });
      }
    },
    async stop(): Promise<void> {
      if (stdioTransport) {
        await stdioTransport.close();
      }

      if (httpServer) {
        await new Promise<void>((resolve) => {
          httpServer?.close(() => resolve());
        });
        httpServer = null;
      }

      sseSessions.clear();
      eventStreams.clear();
      await server.close();
    },
  };
}
