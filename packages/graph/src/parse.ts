import {
  DROP_REASONS,
  EDGE_KINDS,
  NODE_KINDS,
  type Graph,
  type GraphEdge,
  type GraphMeta,
  type GraphNode,
} from "./types.ts";

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
const dropReasons = new Set<string>(DROP_REASONS);

/**
 * Checks that `data` is a version-1 `Graph`. Structural problems throw;
 * dangling or duplicate references are dropped, and missing or malformed
 * `meta` fields are filled with empty defaults, all reported as warnings so a
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
  const meta = parseMeta(data.meta, warnings);
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

  return { graph: { version: 1, meta, nodes, edges }, source, warnings };
}

/** `meta` with any missing or malformed field replaced by an empty default. */
function parseMeta(meta: Record<string, unknown>, warnings: string[]): GraphMeta {
  const field = <T>(name: string, ok: boolean, value: unknown, fallback: T): T => {
    if (ok) return value as T;
    warnings.push(`"meta.${name}" is missing or malformed; treated as ${JSON.stringify(fallback)}`);
    return fallback;
  };
  const valid = (name: string, list: unknown[], ok: (v: unknown) => boolean) => {
    const kept = list.filter(ok);
    if (kept.length < list.length)
      warnings.push(`Skipped ${list.length - kept.length} malformed "meta.${name}" entries`);
    return kept;
  };
  const { root, files, includeExternal, dropped } = meta;
  const d = isObject(dropped) ? dropped : undefined;

  if (!d) warnings.push(`"meta.dropped" is missing or malformed; no dropped references are reported`);
  // Optional, so only a present but malformed list is reported.
  if (d && d.names !== undefined && !Array.isArray(d.names))
    warnings.push(`"meta.dropped.names" is not a list; ignored`);

  return {
    ...meta,
    root: field("root", typeof root === "string", root, ""),
    files: field("files", Array.isArray(files) && files.every((f) => typeof f === "string"), files, []),
    includeExternal: field("includeExternal", typeof includeExternal === "boolean", includeExternal, false),
    dropped: d
      ? {
          external: field("dropped.external", isCount(d.external), d.external, 0),
          unresolved: field("dropped.unresolved", isCount(d.unresolved), d.unresolved, 0),
          samples: valid(
            "dropped.samples",
            field("dropped.samples", Array.isArray(d.samples), d.samples, []),
            isSample,
          ),
          ...(Array.isArray(d.names) ? { names: valid("dropped.names", d.names, isDroppedName) } : {}),
        }
      : { external: 0, unresolved: 0, samples: [] },
  } as GraphMeta;
}

function isSite(v: unknown): boolean {
  return isObject(v) && typeof v.from === "string" && typeof v.line === "number";
}

function isSample(v: unknown): boolean {
  return isSite(v) && typeof (v as Record<string, unknown>).name === "string";
}

function isDroppedName(v: unknown): boolean {
  return (
    isObject(v) &&
    typeof v.reason === "string" &&
    dropReasons.has(v.reason) &&
    typeof v.name === "string" &&
    isCount(v.count) &&
    Array.isArray(v.sites) &&
    v.sites.every(isSite)
  );
}

function isCount(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= 0;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
