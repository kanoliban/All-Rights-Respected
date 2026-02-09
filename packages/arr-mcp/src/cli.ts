#!/usr/bin/env node

import { createArrMcpServer } from "./server.js";

type ParsedArgs = {
  options: Record<string, string | boolean>;
};

type TransportMode = "stdio" | "http" | "both";

type HttpConfig = {
  host: string;
  port: number;
  mcpSsePath: string;
  mcpMessagePath: string;
  eventsPath: string;
};

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8787;
const DEFAULT_MCP_SSE_PATH = "/sse";
const DEFAULT_MCP_MESSAGE_PATH = "/messages";
const DEFAULT_EVENTS_PATH = "/events";

function parseArgs(argv: string[]): ParsedArgs {
  const options: Record<string, string | boolean> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) {
      continue;
    }

    if (token === "-h" || token === "--help") {
      options.help = true;
      continue;
    }

    if (token === "-v" || token === "--version") {
      options.version = true;
      continue;
    }

    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return { options };
}

function getStringOption(parsed: ParsedArgs, key: string): string | undefined {
  const value = parsed.options[key];
  return typeof value === "string" ? value : undefined;
}

function getNumberOption(parsed: ParsedArgs, key: string): number | undefined {
  const value = getStringOption(parsed, key);
  if (!value) {
    return undefined;
  }
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function getTransport(parsed: ParsedArgs): TransportMode {
  const raw = getStringOption(parsed, "transport");
  if (!raw) {
    return "stdio";
  }

  if (raw === "stdio" || raw === "http" || raw === "both") {
    return raw;
  }

  throw new Error("--transport must be one of: stdio, http, both");
}

function getHttpConfig(parsed: ParsedArgs): HttpConfig {
  return {
    host: getStringOption(parsed, "host") ?? DEFAULT_HOST,
    port: getNumberOption(parsed, "port") ?? DEFAULT_PORT,
    mcpSsePath: getStringOption(parsed, "mcp-sse-path") ?? DEFAULT_MCP_SSE_PATH,
    mcpMessagePath: getStringOption(parsed, "mcp-message-path") ?? DEFAULT_MCP_MESSAGE_PATH,
    eventsPath: getStringOption(parsed, "events-path") ?? DEFAULT_EVENTS_PATH,
  };
}

function getHelp(): string {
  return [
    "ARR MCP Server",
    "",
    "Usage:",
    "  arr-mcp [options]",
    "",
    "Options:",
    "  --transport <stdio|http|both>   Transport mode (default: stdio)",
    "  --host <host>                   HTTP host (default: 127.0.0.1)",
    "  --port <port>                   HTTP port (default: 8787)",
    "  --mcp-sse-path <path>           MCP SSE endpoint (default: /sse)",
    "  --mcp-message-path <path>       MCP message endpoint (default: /messages)",
    "  --events-path <path>            ARR events SSE path (default: /events)",
    "  --name <name>                   Server name (default: arr-mcp)",
    "  -h, --help                      Show this help message",
    "  -v, --version                   Show version",
    "",
  ].join("\n");
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.options.help) {
    console.log(getHelp());
    return;
  }

  if (parsed.options.version) {
    console.log("0.1.0");
    return;
  }

  const transport = getTransport(parsed);
  const name = getStringOption(parsed, "name") ?? "arr-mcp";
  const http = getHttpConfig(parsed);

  const server = createArrMcpServer({
    name,
    version: "0.1.0",
    transport,
    http,
  });

  const shutdown = async (signal: string): Promise<void> => {
    try {
      await server.stop();
    } finally {
      process.exit(signal === "SIGINT" ? 130 : 0);
    }
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  await server.start();
  console.error(`ARR MCP server running (${transport}).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
