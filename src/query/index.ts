/**
 * Browser-safe entry point: the graph types and the queries over a saved
 * graph, without the extractor (ts-morph) or the MCP server.
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
} from "../types";
export { GraphIndex, qualifiedName, type RefResolution } from "./graph-index";
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
} from "./queries";
export { formatDescribe, formatMatches, formatPath, formatSubgraph, formatSummary } from "./format";
