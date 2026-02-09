# ARR MCP (`@allrightsrespected/mcp`)

Draft MCP server skeleton for **All Rights Respected (ARR)** evented workflows.

Status: experimental (skeleton only).

This package is intended to expose ARR interaction events (drafts, signatures, publication,
verification) over MCP so agents can subscribe to live attribution workflows.

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
});

await server.start();
```

## License

CC0-1.0
