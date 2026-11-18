import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { formatDescribe, formatMatches, formatPath, formatSubgraph, formatSummary } from "../query/format";
import { GraphIndex } from "../query/graph-index";
import { describe, find, MAX_DEPTH, neighbors, path, summary } from "../query/queries";
import type { Graph, GraphNode } from "../types";
import {
  DeclarationOutput,
  EdgeKindSchema,
  FindOutput,
  NeighborsOutput,
  NodeKindSchema,
  PathOutput,
  SummaryOutput,
} from "./schemas";

const REF_DESCRIPTION =
  "A declaration id (from another tool's output), a name (`Dog`), or a qualified name (`NS.Inner`).";

/**
 * MCP tools over the declaration graph. `load` builds the graph; it runs once
 * now and again on every `refresh_graph` call.
 */
export function createServer(load: () => Graph): McpServer {
  let index = new GraphIndex(load());
  const server = new McpServer({ name: "ts-graph", version: "1.0.0" });

  const summaryResult = (): CallToolResult => {
    const s = summary(index);
    const { root, files, includeExternal, dropped } = s.meta;

    return {
      content: [text(formatSummary(s))],
      structuredContent: {
        root,
        fileCount: files.length,
        includeExternal,
        nodeCount: s.nodeCount,
        edgeCount: s.edgeCount,
        nodeKinds: s.nodeKinds,
        edgeKinds: s.edgeKinds,
        dropped,
      },
    };
  };

  /** Resolves a ref, or returns the result to send back instead (candidates or an error). */
  const lookup = (ref: string): { node: GraphNode } | { result: CallToolResult } => {
    const r = index.resolveRef(ref);

    if ("node" in r) return r;

    if ("candidates" in r) {
      return {
        result: {
          content: [
            text(
              `"${ref}" matches ${r.candidates.length} declarations; call again with one of these ids:\n${formatMatches(r.candidates)}`,
            ),
          ],
          structuredContent: { candidates: r.candidates },
        },
      };
    }

    const similar = find(index, {
      query: ref.split(/[#.]/).pop() ?? ref,
      limit: 5,
    }).matches;

    return {
      result: {
        isError: true,
        content: [
          text(
            similar.length > 0
              ? `No declaration matches "${ref}". Similar:\n${formatMatches(similar)}`
              : `No declaration matches "${ref}". Use find_declarations to search.`,
          ),
        ],
      },
    };
  };

  server.registerTool(
    "graph_summary",
    {
      title: "Graph summary",
      description:
        "Overview of the TypeScript declaration graph: root directory, node and edge counts by kind, and how many references produced no edge. If unresolved or omitted external references are non-zero, a missing edge does not prove two declarations are unrelated.",
      outputSchema: SummaryOutput,
    },
    async () => summaryResult(),
  );

  server.registerTool(
    "find_declarations",
    {
      title: "Find declarations",
      description:
        "Search interfaces, classes, type aliases, enums, functions, variables and namespaces by name. Ranks exact name, then prefix, then substring matches. Returns ids to pass to the other tools.",
      inputSchema: {
        query: z.string().min(1).describe("Name or part of a name."),
        kind: NodeKindSchema.optional().describe("Only this kind of declaration."),
        limit: z.number().int().min(1).max(200).optional().describe("Default 20."),
      },
      outputSchema: FindOutput,
    },
    async ({ query, kind, limit }) => {
      const { matches, total } = find(index, { query, kind, limit });

      return {
        content: [text(formatMatches(matches, total))],
        structuredContent: { matches, total },
      };
    },
  );

  server.registerTool(
    "get_declaration",
    {
      title: "Get declaration",
      description:
        "One declaration in full: file and line range, signature, doc comment, members, and every relationship to and from it.",
      inputSchema: { ref: z.string().min(1).describe(REF_DESCRIPTION) },
      outputSchema: DeclarationOutput,
    },
    async ({ ref }) => {
      const found = lookup(ref);

      if ("result" in found) return found.result;

      const result = describe(index, found.node);

      return {
        content: [text(formatDescribe(result, index))],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "get_neighbors",
    {
      title: "Get related declarations",
      description:
        "Declarations related to `ref` within `depth` hops. direction 'out' = what it uses (extends, property types, params...); 'in' = what uses it (implementers, subclasses, referencing types); 'both' = either. Narrow with `kinds`, e.g. ['implements'] to find implementations.",
      inputSchema: {
        ref: z.string().min(1).describe(REF_DESCRIPTION),
        direction: z.enum(["out", "in", "both"]).optional().describe("Default 'both'."),
        kinds: z.array(EdgeKindSchema).optional().describe("Only these relationship kinds."),
        depth: z.number().int().min(1).max(MAX_DEPTH).optional().describe("Hops to follow. Default 1."),
        limit: z.number().int().min(1).max(500).optional().describe("Maximum edges returned. Default 50."),
      },
      outputSchema: NeighborsOutput,
    },
    async ({ ref, direction, kinds, depth, limit }) => {
      const found = lookup(ref);

      if ("result" in found) return found.result;

      const sub = neighbors(index, {
        id: found.node.id,
        direction,
        kinds,
        depth,
        limit,
      });

      return {
        content: [text(formatSubgraph(sub, index))],
        structuredContent: { ...sub },
      };
    },
  );

  server.registerTool(
    "find_path",
    {
      title: "Find path",
      description:
        "Shortest chain of relationships connecting two declarations. By default edges are followed in either direction; directed=true follows them only from `from` towards `to`.",
      inputSchema: {
        from: z.string().min(1).describe(REF_DESCRIPTION),
        to: z.string().min(1).describe(REF_DESCRIPTION),
        maxDepth: z.number().int().min(1).max(10).optional().describe("Longest chain to search for. Default 6."),
        directed: z.boolean().optional(),
      },
      outputSchema: PathOutput,
    },
    async ({ from, to, maxDepth, directed }) => {
      const a = lookup(from);

      if ("result" in a) return a.result;

      const b = lookup(to);

      if ("result" in b) return b.result;

      const edges = path(index, {
        from: a.node.id,
        to: b.node.id,
        maxDepth,
        directed,
      });

      if (!edges) {
        return {
          content: [
            text(
              `No path from ${a.node.name} to ${b.node.name} within ${maxDepth ?? 6} steps${directed ? " following edge direction" : ""}.`,
            ),
          ],
          structuredContent: { found: false },
        };
      }

      return {
        content: [text(formatPath(edges, index))],
        structuredContent: { found: true, edges },
      };
    },
  );

  server.registerTool(
    "refresh_graph",
    {
      title: "Refresh graph",
      description: "Re-analyze the source files. Call after editing code so later answers reflect the change.",
      outputSchema: SummaryOutput,
    },
    async () => {
      index = new GraphIndex(load());

      return summaryResult();
    },
  );

  return server;
}

function text(value: string): { type: "text"; text: string } {
  return { type: "text", text: value };
}
