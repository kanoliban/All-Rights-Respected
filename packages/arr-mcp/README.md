# ARR MCP (`@allrightsrespected/mcp`)

Draft MCP server skeleton for **All Rights Respected (ARR)** evented workflows.

Status: experimental (skeleton only).

This package exposes ARR interaction events (drafts, signatures, publication, verification)
over MCP so agents can subscribe to live attribution workflows.

## Install

```bash
npm install @allrightsrespected/mcp
```

## Usage (placeholder)

```ts
import { createArrMcpServer } from "@allrightsrespected/mcp";

const server = createArrMcpServer({
  name: "arr-mcp",
  version: "0.1.0",
  transport: "both",
  http: {
    port: 8787,
  },
});

await server.start();
```

## License

CC0-1.0

## Tools (current)

- `arr.events.list`
- `arr.events.watch`
- `arr.attestation.create_draft`
- `arr.attestation.sign`
- `arr.attestation.publish`
- `arr.attestation.verify`
- `arr.attestation.renew`
- `arr.revocation.create`

## HTTP/SSE Endpoints

When `transport: "http"` (or `"both"`), the server exposes:

- `GET /events` — SSE stream of ARR event envelopes
- `GET /sse` — MCP SSE transport (session bootstrap)
- `POST /messages?sessionId=...` — MCP messages for the SSE session
