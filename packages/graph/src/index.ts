/**
 * The graph JSON contract shared by the parser, the MCP server and the UI:
 * its types, validation for untrusted input, and queries over a loaded graph.
 * Dependency-free and browser-safe.
 */
export {
  DROP_REASONS,
  EDGE_KINDS,
  MAX_DROP_SITES,
  MEMBER_KINDS,
  NODE_KINDS,
  type DropReason,
  type DroppedName,
  type DroppedReference,
  type DroppedSite,
  type EdgeKind,
  type Graph,
  type GraphEdge,
  type GraphMeta,
  type GraphNode,
  type Member,
  type NodeKind,
} from "./types.ts";
export { groupDropped, type ReasonedReference } from "./dropped.ts";
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
