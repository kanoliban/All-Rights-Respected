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
import { buildAttestation, canonicalizeRecord, stripUndefined, type AttestationInput } from "./internal.js";
import {
  WIDGET_API,
  draftRequestSchema,
  publishRequestSchema,
  renewRequestSchema,
  revokeRequestSchema,
  signRequestSchema,
  verifyRequestSchema,
} from "./widget-contract.js";
import type {
  ArrEvent,
  ArrEventEnvelope,
  ArrEventPayload,
  ArrEventType,
  ArrInteractionContext,
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
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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
  const event = stripUndefined({
    version: EVENT_VERSION as "arr/event/0.1",
    id: randomUUID(),
    type,
    created: new Date().toISOString(),
    session,
    payload,
  }) as ArrEvent;

  return { event };
}

function writeSse(res: ServerResponse, data: unknown): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function writeJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, {
    ...CORS_HEADERS,
    "Content-Type": "application/json",
  });
  res.end(JSON.stringify(payload));
}

function writeError(res: ServerResponse, status: number, message: string, details?: unknown): void {
  writeJson(res, status, stripUndefined({ error: message, details }));
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

  const toAttestationInput = (input: z.infer<typeof attestationSchema>): AttestationInput =>
    stripUndefined({
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
    }) as AttestationInput;

  type ZodContext = z.infer<typeof contextSchema>;

  function cleanContext(ctx: ZodContext): ArrInteractionContext | undefined {
    if (!ctx) return undefined;
    return stripUndefined(ctx) as ArrInteractionContext;
  }

  function contextFromWidget(ctx: unknown): ArrInteractionContext | undefined {
    if (!ctx) return undefined;
    return stripUndefined(ctx as Record<string, unknown>) as ArrInteractionContext;
  }

  function cleanSignedAttestation(input: z.infer<typeof signedAttestationSchema>): SignedAttestation {
    return {
      attestation: stripUndefined(input.attestation) as SignedAttestation["attestation"],
      signature: input.signature,
    };
  }

  function toAttestationInputFromWidget(attestation: Record<string, unknown>): AttestationInput {
    const { version: _version, ...rest } = attestation;
    return stripUndefined(rest) as AttestationInput;
  }

  function toAttestationInputFromDraft(input: z.infer<typeof draftRequestSchema>): AttestationInput {
    return stripUndefined({
      creator: input.creator,
      intent: input.intent,
      tool: input.tool,
      license: input.license,
      upstream: input.upstream,
      content_hash: input.content_hash,
      expires: input.expires,
      extensions: input.extensions,
    }) as AttestationInput;
  }

  function toAttestationInputFromRenew(input: z.infer<typeof renewRequestSchema>): AttestationInput {
    return stripUndefined({
      creator: input.creator,
      intent: input.intent,
      tool: input.tool,
      license: input.license,
    }) as AttestationInput;
  }

  function eventPayload(fields: Record<string, unknown>): ArrEventPayload {
    return stripUndefined(fields) as ArrEventPayload;
  }

  function handleDraft(
    input: AttestationInput,
    context: ArrInteractionContext | undefined,
    session?: string,
  ) {
    const draft = buildAttestation(input);
    const envelope = emit(
      "arr.attestation.draft.created",
      eventPayload({ attestation: draft, context }),
      session,
    );
    return { attestation: draft, event: envelope };
  }

  function handleSign(
    input: AttestationInput,
    privateKeyPem: string,
    context: ArrInteractionContext | undefined,
    session?: string,
  ) {
    const unsigned = buildAttestation(input);
    const signed = signAttestation(unsigned, privateKeyPem);
    const envelope = emit(
      "arr.attestation.signed",
      eventPayload({ signed_attestation: signed, context }),
      session,
    );
    return { signed_attestation: signed, event: envelope };
  }

  function handleRenew(
    input: AttestationInput,
    renews: string,
    privateKeyPem: string,
    context: ArrInteractionContext | undefined,
    session?: string,
  ) {
    const renewed = buildAttestation(input, { renews });
    const signed = signAttestation(renewed, privateKeyPem);
    const envelope = emit(
      "arr.attestation.renewed",
      eventPayload({ signed_attestation: signed, context }),
      session,
    );
    return { signed_attestation: signed, event: envelope };
  }

  async function handlePublish(
    signedAttestation: SignedAttestation,
    filePath: string,
    mode: "auto" | "metadata" | "sidecar",
    outputPath: string | undefined,
    context: ArrInteractionContext | undefined,
    session?: string,
  ) {
    const result = await publishSignedAttestation(signedAttestation, filePath, mode, outputPath);
    const enrichedContext = stripUndefined({
      ...(context ?? {}),
      file_path: context?.file_path ?? filePath,
    }) as ArrInteractionContext;

    const envelope = emit(
      "arr.attestation.published",
      eventPayload({ signed_attestation: signedAttestation, context: enrichedContext }),
      session,
    );
    return { result, event: envelope };
  }

  function handleVerify(
    signedAttestation: SignedAttestation,
    publicKeyPem: string | undefined,
    context: ArrInteractionContext | undefined,
    session?: string,
  ) {
    const result = verifyAttestation(signedAttestation, publicKeyPem);
    const envelope = emit(
      "arr.attestation.verified",
      eventPayload({ signed_attestation: signedAttestation, context }),
      session,
    );
    return { result, event: envelope };
  }

  function handleRevoke(
    attestationId: string,
    reason: string | undefined,
    revokedAt: string | undefined,
    privateKeyPem: string,
    context: ArrInteractionContext | undefined,
    session?: string,
  ) {
    const record = stripUndefined({
      attestation_id: attestationId,
      revoked_at: revokedAt ?? new Date().toISOString(),
      reason,
    });

    const canonical = canonicalizeRecord(record);
    const key = createPrivateKey(privateKeyPem);
    const signature = signBytes(null, Buffer.from(canonical, "utf8"), key);
    const signed: ArrSignedRevocation = {
      revocation: record as ArrSignedRevocation["revocation"],
      signature: `${ED25519_PREFIX}${encodeBase64Url(signature)}`,
    };

    const envelope = emit(
      "arr.attestation.revoked",
      eventPayload({ revocation: signed, context }),
      session,
    );
    return { revocation: signed, event: envelope };
  }

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
      const payload = handleDraft(toAttestationInput(attestation), cleanContext(context), session);
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
      const payload = handleSign(
        toAttestationInput(attestation),
        private_key_pem,
        cleanContext(context),
        session,
      );
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
      const payload = handleRenew(
        toAttestationInput(attestation),
        renews,
        private_key_pem,
        cleanContext(context),
        session,
      );
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
      const cleaned = cleanSignedAttestation(signed_attestation);
      const payload = await handlePublish(
        cleaned,
        file_path,
        mode ?? "auto",
        output_path,
        cleanContext(context),
        session,
      );
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
      const cleaned = cleanSignedAttestation(signed_attestation);
      const payload = handleVerify(
        cleaned,
        public_key_pem,
        cleanContext(context),
        session,
      );
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
      const payload = handleRevoke(
        attestation_id,
        reason,
        revoked_at,
        private_key_pem,
        cleanContext(context),
        session,
      );
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

          if (req.method === "OPTIONS") {
            res.writeHead(204, CORS_HEADERS);
            res.end();
            return;
          }

          if (req.method === "GET" && url.pathname === httpConfig.eventsPath) {
            Object.entries(CORS_HEADERS).forEach(([key, value]) => res.setHeader(key, value));
            res.writeHead(200, {
              ...CORS_HEADERS,
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
            Object.entries(CORS_HEADERS).forEach(([key, value]) => res.setHeader(key, value));
            const transport = new SSEServerTransport(httpConfig.mcpMessagePath, res);
            sseSessions.set(transport.sessionId, transport);
            req.on("close", () => {
              sseSessions.delete(transport.sessionId);
            });
            await server.connect(transport);
            return;
          }

          if (req.method === "POST" && url.pathname === WIDGET_API.draft) {
            let body: unknown;
            try {
              body = await readJsonBody(req);
            } catch {
              writeError(res, 400, "Invalid JSON body.");
              return;
            }

            const parsed = draftRequestSchema.safeParse(body);
            if (!parsed.success) {
              writeError(res, 400, "Invalid draft request.", parsed.error.flatten());
              return;
            }

            const payload = handleDraft(
              toAttestationInputFromDraft(parsed.data),
              contextFromWidget(parsed.data.context),
              parsed.data.session,
            );
            writeJson(res, 200, payload);
            return;
          }

          if (req.method === "POST" && url.pathname === WIDGET_API.sign) {
            let body: unknown;
            try {
              body = await readJsonBody(req);
            } catch {
              writeError(res, 400, "Invalid JSON body.");
              return;
            }

            const parsed = signRequestSchema.safeParse(body);
            if (!parsed.success) {
              writeError(res, 400, "Invalid sign request.", parsed.error.flatten());
              return;
            }

            const payload = handleSign(
              toAttestationInputFromWidget(parsed.data.attestation as Record<string, unknown>),
              parsed.data.private_key_pem,
              contextFromWidget(parsed.data.context),
              parsed.data.session,
            );
            writeJson(res, 200, payload);
            return;
          }

          if (req.method === "POST" && url.pathname === WIDGET_API.publish) {
            let body: unknown;
            try {
              body = await readJsonBody(req);
            } catch {
              writeError(res, 400, "Invalid JSON body.");
              return;
            }

            const parsed = publishRequestSchema.safeParse(body);
            if (!parsed.success) {
              writeError(res, 400, "Invalid publish request.", parsed.error.flatten());
              return;
            }

            const signed = cleanSignedAttestation({
              attestation: parsed.data.signed_attestation.attestation as z.infer<typeof signedAttestationSchema>["attestation"],
              signature: parsed.data.signed_attestation.signature,
            });

            const payload = await handlePublish(
              signed,
              parsed.data.file_path,
              parsed.data.mode ?? "auto",
              parsed.data.output_path,
              contextFromWidget(parsed.data.context),
              parsed.data.session,
            );
            writeJson(res, 200, payload);
            return;
          }

          if (req.method === "POST" && url.pathname === WIDGET_API.verify) {
            let body: unknown;
            try {
              body = await readJsonBody(req);
            } catch {
              writeError(res, 400, "Invalid JSON body.");
              return;
            }

            const parsed = verifyRequestSchema.safeParse(body);
            if (!parsed.success) {
              writeError(res, 400, "Invalid verify request.", parsed.error.flatten());
              return;
            }

            const signed = cleanSignedAttestation({
              attestation: parsed.data.signed_attestation.attestation as z.infer<typeof signedAttestationSchema>["attestation"],
              signature: parsed.data.signed_attestation.signature,
            });

            const payload = handleVerify(
              signed,
              parsed.data.public_key_pem,
              contextFromWidget(parsed.data.context),
              parsed.data.session,
            );
            writeJson(res, 200, payload);
            return;
          }

          if (req.method === "POST" && url.pathname === WIDGET_API.renew) {
            let body: unknown;
            try {
              body = await readJsonBody(req);
            } catch {
              writeError(res, 400, "Invalid JSON body.");
              return;
            }

            const parsed = renewRequestSchema.safeParse(body);
            if (!parsed.success) {
              writeError(res, 400, "Invalid renew request.", parsed.error.flatten());
              return;
            }

            const payload = handleRenew(
              toAttestationInputFromRenew(parsed.data),
              parsed.data.renews,
              parsed.data.private_key_pem,
              contextFromWidget(parsed.data.context),
              parsed.data.session,
            );
            writeJson(res, 200, payload);
            return;
          }

          if (req.method === "POST" && url.pathname === WIDGET_API.revoke) {
            let body: unknown;
            try {
              body = await readJsonBody(req);
            } catch {
              writeError(res, 400, "Invalid JSON body.");
              return;
            }

            const parsed = revokeRequestSchema.safeParse(body);
            if (!parsed.success) {
              writeError(res, 400, "Invalid revoke request.", parsed.error.flatten());
              return;
            }

            const payload = handleRevoke(
              parsed.data.attestation_id,
              parsed.data.reason,
              undefined,
              parsed.data.private_key_pem,
              contextFromWidget(parsed.data.context),
              parsed.data.session,
            );
            writeJson(res, 200, payload);
            return;
          }

          if (req.method === "POST" && url.pathname === httpConfig.mcpMessagePath) {
            Object.entries(CORS_HEADERS).forEach(([key, value]) => res.setHeader(key, value));
            const sessionId = url.searchParams.get("sessionId");
            if (!sessionId) {
              writeError(res, 400, "Missing sessionId query param.");
              return;
            }

            const transport = sseSessions.get(sessionId);
            if (!transport) {
              writeError(res, 404, "Unknown sessionId.");
              return;
            }

            let body: unknown;
            try {
              body = await readJsonBody(req);
            } catch (error) {
              writeError(res, 400, "Invalid JSON body.");
              return;
            }

            await transport.handlePostMessage(req, res, body);
            return;
          }

          res.writeHead(404, {
            ...CORS_HEADERS,
            "Content-Type": "application/json",
          });
          res.end(JSON.stringify({ error: "Not found" }));
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
