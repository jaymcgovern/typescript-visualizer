import type { EdgeKind, GraphEdge, GraphMeta, GraphNode, NodeKind } from "../types";
import { qualifiedName, type GraphIndex } from "./graph-index";

export type Direction = "out" | "in" | "both";

export interface Subgraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
  /** Edges left out because of `limit`. */
  omitted: number;
}

export const MAX_DEPTH = 3;

/** Guards a neighbourhood walk around hub nodes from growing without bound. */
const MAX_EDGES_VISITED = 10_000;

export function find(
  index: GraphIndex,
  { query, kind, limit = 20 }: { query: string; kind?: NodeKind; limit?: number },
): { matches: GraphNode[]; total: number } {
  const q = query.toLowerCase();
  const scored: { node: GraphNode; score: number }[] = [];

  for (const node of index.nodes) {
    if (kind && node.kind !== kind) continue;

    const score = matchScore(node, q);

    if (score !== undefined) scored.push({ node, score });
  }

  scored.sort((a, b) => a.score - b.score || compare(a.node.name, b.node.name) || compare(a.node.id, b.node.id));

  return {
    matches: scored.slice(0, limit).map((s) => s.node),
    total: scored.length,
  };
}

/** Lower is better: exact name, prefix, substring, then anywhere in the id. */
function matchScore(node: GraphNode, q: string): number | undefined {
  const name = node.name.toLowerCase();
  const qualified = qualifiedName(node).toLowerCase();

  if (name === q || qualified === q) return 0;
  if (name.startsWith(q) || qualified.startsWith(q)) return 1;
  if (name.includes(q) || qualified.includes(q)) return 2;
  if (node.id.toLowerCase().includes(q)) return 3;

  return undefined;
}

export function describe(
  index: GraphIndex,
  node: GraphNode,
): { node: GraphNode; outgoing: GraphEdge[]; incoming: GraphEdge[] } {
  return {
    node,
    outgoing: index.outgoing(node.id),
    incoming: index.incoming(node.id),
  };
}

/** Breadth-first neighbourhood; nearer edges come first, so truncation keeps the closest. */
export function neighbors(
  index: GraphIndex,
  {
    id,
    direction = "both",
    kinds,
    depth = 1,
    limit = 50,
  }: {
    id: string;
    direction?: Direction;
    kinds?: EdgeKind[];
    depth?: number;
    limit?: number;
  },
): Subgraph {
  const maxDepth = Math.min(Math.max(depth, 1), MAX_DEPTH);
  const allowed = kinds && kinds.length > 0 ? new Set(kinds) : undefined;
  const visited = new Set([id]);
  const seenEdges = new Set<GraphEdge>();
  const edges: GraphEdge[] = [];
  let frontier = [id];

  for (let level = 0; level < maxDepth && frontier.length > 0; level++) {
    const next: string[] = [];

    for (const current of frontier) {
      for (const edge of adjacent(index, current, direction)) {
        if (allowed && !allowed.has(edge.kind)) continue;
        if (seenEdges.has(edge)) continue;

        seenEdges.add(edge);
        edges.push(edge);

        const other = edge.source === current ? edge.target : edge.source;

        if (!visited.has(other)) {
          visited.add(other);
          next.push(other);
        }
      }

      if (edges.length >= MAX_EDGES_VISITED) break;
    }

    frontier = next;
  }

  const kept = edges.slice(0, limit);

  return {
    nodes: nodesOf(index, id, kept),
    edges: kept,
    truncated: edges.length > limit,
    omitted: Math.max(edges.length - limit, 0),
  };
}

/** Shortest chain of edges from `from` to `to`, or null when none is within `maxDepth`. */
export function path(
  index: GraphIndex,
  { from, to, maxDepth = 6, directed = false }: { from: string; to: string; maxDepth?: number; directed?: boolean },
): GraphEdge[] | null {
  if (from === to) return [];

  const via = new Map<string, { prev: string; edge: GraphEdge }>();
  const visited = new Set([from]);
  let frontier = [from];

  for (let level = 0; level < maxDepth && frontier.length > 0; level++) {
    const next: string[] = [];

    for (const current of frontier) {
      for (const edge of adjacent(index, current, directed ? "out" : "both")) {
        const other = edge.source === current ? edge.target : edge.source;

        if (visited.has(other)) continue;

        visited.add(other);
        via.set(other, { prev: current, edge });

        if (other === to) return chain(via, from, to);

        next.push(other);
      }
    }

    frontier = next;
  }

  return null;
}

export interface Summary {
  meta: GraphMeta;
  nodeCount: number;
  edgeCount: number;
  nodeKinds: Record<string, number>;
  edgeKinds: Record<string, number>;
}

export function summary(index: GraphIndex): Summary {
  const { meta, nodes, edges } = index.graph;

  return {
    meta,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodeKinds: countBy(nodes.map((n) => n.kind)),
    edgeKinds: countBy(edges.map((e) => e.kind)),
  };
}

function adjacent(index: GraphIndex, id: string, direction: Direction): GraphEdge[] {
  if (direction === "out") return index.outgoing(id);
  if (direction === "in") return index.incoming(id);

  return [...index.outgoing(id), ...index.incoming(id)];
}

/** The start node, then every edge endpoint in first-seen order. */
function nodesOf(index: GraphIndex, start: string, edges: GraphEdge[]): GraphNode[] {
  const ids = new Set([start]);

  for (const e of edges) {
    ids.add(e.source);
    ids.add(e.target);
  }

  return [...ids].map((id) => index.byId.get(id)).filter((n) => n !== undefined);
}

function chain(via: Map<string, { prev: string; edge: GraphEdge }>, from: string, to: string): GraphEdge[] {
  const edges: GraphEdge[] = [];

  for (let at = to; at !== from;) {
    const step = via.get(at)!;
    edges.unshift(step.edge);
    at = step.prev;
  }

  return edges;
}

function countBy(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const v of [...values].sort()) counts[v] = (counts[v] ?? 0) + 1;

  return counts;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
