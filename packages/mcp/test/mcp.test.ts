import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Graph } from "@tsviz/graph";
import { extractGraph } from "@tsviz/parser";
import { createServer } from "../src/tools.ts";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

// The first load sees only `classes`; refreshing adds `basic`, standing in for edits on disk.
let loads = 0;
const load = (): Graph =>
  extractGraph({
    files: loads++ === 0 ? ["fixtures/classes/*.ts"] : ["fixtures/{classes,basic}/*.ts"],
    root: repoRoot,
  });

let client: Client;

beforeAll(async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await createServer(load).connect(serverTransport);

  client = new Client({ name: "test", version: "0.0.0" });

  await client.connect(clientTransport);
});

afterAll(async () => {
  await client.close();
});

describe("server", () => {
  it("identifies as tsviz-mcp at the package version", () => {
    expect(client.getServerVersion()).toMatchObject({ name: "tsviz-mcp", version: "0.1.0" });
  });
});

function textOf(result: Awaited<ReturnType<Client["callTool"]>>): string {
  const content = result.content as { type: string; text: string }[];

  return content.map((c) => c.text).join("\n");
}

describe("mcp server", () => {
  it("lists every tool with input and output schemas", async () => {
    const { tools } = await client.listTools();

    expect(tools.map((t) => t.name).sort()).toEqual([
      "find_declarations",
      "find_path",
      "get_declaration",
      "get_neighbors",
      "graph_summary",
      "refresh_graph",
    ]);

    for (const tool of tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.outputSchema).toBeDefined();
    }

    const neighborsTool = tools.find((t) => t.name === "get_neighbors");

    expect(neighborsTool?.inputSchema.required).toEqual(["ref"]);
  });

  it("answers neighbour queries with text and structured content", async () => {
    const result = await client.callTool({
      name: "get_neighbors",
      arguments: { ref: "Animal", direction: "in" },
    });

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain("Dog --implements--> Animal");
    expect(result.structuredContent).toMatchObject({
      truncated: false,
      edges: [
        { source: "fixtures/classes/dog.ts#Dog", kind: "implements" },
        { source: "fixtures/classes/dog.ts#Dog", kind: "param", label: "pet" },
      ],
    });
  });

  it("returns an error with suggestions for unknown refs", async () => {
    const result = await client.callTool({
      name: "get_declaration",
      arguments: { ref: "Dogg" },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('No declaration matches "Dogg"');
  });

  it("finds paths between declarations", async () => {
    const result = await client.callTool({
      name: "find_path",
      arguments: { from: "Owner", to: "Animal" },
    });

    expect(result.structuredContent).toMatchObject({ found: true });
    expect(textOf(result)).toContain("2 steps:");
  });

  it("re-extracts on refresh_graph", async () => {
    const before = await client.callTool({
      name: "find_declarations",
      arguments: { query: "User" },
    });

    expect(before.structuredContent).toMatchObject({ total: 0 });

    const refreshed = await client.callTool({ name: "refresh_graph", arguments: {} });

    expect(refreshed.structuredContent).toMatchObject({ fileCount: 5 });

    const after = await client.callTool({
      name: "find_declarations",
      arguments: { query: "User" },
    });

    expect(after.structuredContent).toMatchObject({ total: 2 });
  });
});
