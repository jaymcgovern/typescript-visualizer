/**
 * The graph JSON contract shared by the parser, the MCP server and the UI:
 * its types, validation for untrusted input, and queries over a loaded graph.
 * Dependency-free and browser-safe.
 */
export {
  EDGE_KINDS,
  MEMBER_KINDS,
  NODE_KINDS,
  type DroppedReference,
  type EdgeKind,
  type Graph,
  type GraphEdge,
  type GraphMeta,
  type GraphNode,
  type Member,
  type NodeKind,
} from "./types.ts";
export { GraphIndex, qualifiedName, type RefResolution } from "./graph-index.ts";
export {
  describe,
  find,
  MAX_DEPTH,
  neighbors,
  path,
  summary,
  type Direction,
  type Subgraph,
  type Summary,
} from "./queries.ts";
export { GraphLoadError, parseGraph, type LoadedGraph } from "./parse.ts";
