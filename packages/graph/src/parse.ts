import { EDGE_KINDS, NODE_KINDS, type Graph, type GraphEdge, type GraphNode } from "./types.ts";

export interface LoadedGraph {
  graph: Graph;
  /** Where the graph came from: a URL or a file name. */
  source: string;
  /** Problems that did not stop loading, e.g. edges whose endpoints are missing. */
  warnings: string[];
}

export class GraphLoadError extends Error {
  override name = "GraphLoadError";
}

const nodeKinds = new Set<string>(NODE_KINDS);
const edgeKinds = new Set<string>(EDGE_KINDS);

/**
 * Checks that `data` is a version-1 `Graph`. Structural problems throw;
 * dangling or duplicate references are dropped and reported as warnings so a
 * slightly inconsistent file still renders.
 */
export function parseGraph(data: unknown, source: string): LoadedGraph {
  if (!isObject(data)) throw new GraphLoadError(`${source}: expected a JSON object`);
  if (data.version !== 1) {
    throw new GraphLoadError(`${source}: unsupported graph version ${JSON.stringify(data.version)} (expected 1)`);
  }
  if (!isObject(data.meta)) throw new GraphLoadError(`${source}: missing "meta"`);
  if (!Array.isArray(data.nodes)) throw new GraphLoadError(`${source}: "nodes" must be an array`);
  if (!Array.isArray(data.edges)) throw new GraphLoadError(`${source}: "edges" must be an array`);

  const warnings: string[] = [];
  const nodes: GraphNode[] = [];
  const ids = new Set<string>();

  data.nodes.forEach((n: unknown, i: number) => {
    if (!isObject(n) || typeof n.id !== "string" || typeof n.name !== "string" || typeof n.kind !== "string") {
      throw new GraphLoadError(`${source}: nodes[${i}] needs string "id", "name" and "kind"`);
    }
    if (!nodeKinds.has(n.kind)) throw new GraphLoadError(`${source}: nodes[${i}] has unknown kind "${n.kind}"`);
    if (ids.has(n.id)) {
      warnings.push(`Duplicate node id ${n.id}; kept the first`);
      return;
    }
    ids.add(n.id);
    nodes.push(n as unknown as GraphNode);
  });

  const edges: GraphEdge[] = [];
  let dangling = 0;

  data.edges.forEach((e: unknown, i: number) => {
    if (!isObject(e) || typeof e.source !== "string" || typeof e.target !== "string" || typeof e.kind !== "string") {
      throw new GraphLoadError(`${source}: edges[${i}] needs string "source", "target" and "kind"`);
    }
    if (!edgeKinds.has(e.kind)) throw new GraphLoadError(`${source}: edges[${i}] has unknown kind "${e.kind}"`);
    if (!ids.has(e.source) || !ids.has(e.target)) {
      dangling++;
      return;
    }
    edges.push(e as unknown as GraphEdge);
  });

  if (dangling > 0) warnings.push(`${dangling} edge(s) referenced missing nodes and were skipped`);

  return { graph: { version: 1, meta: data.meta as unknown as Graph["meta"], nodes, edges }, source, warnings };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
