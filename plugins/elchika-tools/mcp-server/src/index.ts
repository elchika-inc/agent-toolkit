import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { REGISTRY, TOOL_NAMES, type ToolFn } from "./registry.js";

const server = new McpServer({ name: "elchika-tools", version: "1.0.0" });

server.tool(
  "run",
  [
    "Elchika Tools のユーティリティを実行する。",
    "`tool` に操作名（下記 enum から選択）、`input` に処理対象テキストを渡す。",
    "複数パラメータが必要な場合は `input` を JSON 文字列にする。",
    "戻り値は常に文字列。",
  ].join("\n"),
  {
    tool: z.enum(TOOL_NAMES).describe("実行するツール名"),
    input: z.string().describe("処理対象テキスト（複数パラメータは JSON 文字列）"),
  },
  async ({ tool, input }) => {
    try {
      const fn = REGISTRY[tool] as ToolFn;
      const result = await fn(input);
      return { content: [{ type: "text", text: String(result) }] };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
