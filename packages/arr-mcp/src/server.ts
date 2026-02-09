import type { ArrMcpServer, ArrMcpServerOptions } from "./types.js";

export function createArrMcpServer(_options: ArrMcpServerOptions): ArrMcpServer {
  return {
    async start(): Promise<void> {
      throw new Error("ARR MCP server not implemented yet.");
    },
    async stop(): Promise<void> {
      return;
    },
  };
}
