export const NODE_KINDS = [
  "interface",
  "class",
  "type",
  "enum",
  "function",
  "variable",
  "namespace",
  "external",
] as const;

export type NodeKind = (typeof NODE_KINDS)[number];

export const EDGE_KINDS = [
  "extends",
  "implements",
  "references",
  "typeArg",
  "returns",
  "param",
  "property",
  "union",
  "intersection",
  "typeof",
] as const;

export type EdgeKind = (typeof EDGE_KINDS)[number];

export const MEMBER_KINDS = ["property", "method", "enumMember", "index", "call", "construct"] as const;

export interface Member {
  name: string;
  kind: (typeof MEMBER_KINDS)[number];
  /** Source text of the member's type (or signature for methods and call/construct signatures). */
  type?: string;
}

export interface GraphNode {
  /**
   * `<root-relative file path>#<qualified name>`, e.g. `src/a.ts#NS.Inner`.
   * When distinct declarations share a name (e.g. `const X` and `type X`), the
   * lower-priority one gets an `@<kind>` suffix: `src/a.ts#X@variable`.
   * External placeholders use `external:<origin>#<name>`.
   */
  id: string;
  /** Short declaration name. */
  name: string;
  kind: NodeKind;
  /** Undefined for external placeholder nodes. */
  file?: string;
  /** 1-based first line of the declaration (excluding its JSDoc). */
  line?: number;
  /** 1-based last line of the declaration. */
  endLine?: number;
  exported: boolean;
  /** External placeholders only: `lib`, a package name, or a root-relative path. */
  origin?: string;
  /** Declaration header, e.g. `export class Dog extends Base`; overloads are newline-separated. */
  signature?: string;
  /** First paragraph of the declaration's JSDoc. */
  doc?: string;
  typeParams?: string[];
  members?: Member[];
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: EdgeKind;
  /** The member, parameter, or type parameter the reference originates from. */
  label?: string;
  /** 1-based line of the reference, in the source node's file. */
  line?: number;
}

export interface DroppedReference {
  /** Id of the node the reference appears in. */
  from: string;
  /** The reference as written. */
  name: string;
  line: number;
}

export interface GraphMeta {
  /** Absolute directory that node `file` paths are relative to. */
  root: string;
  /** Analyzed files, root-relative and sorted. */
  files: string[];
  includeExternal: boolean;
  /**
   * References that produced no edge. An agent should not read a missing edge
   * as "no relationship" when these are non-zero.
   */
  dropped: {
    /** Resolved outside the analyzed files; omitted because `includeExternal` is off. */
    external: number;
    /** No symbol or declaration could be found. */
    unresolved: number;
    /** The first unresolved references, sorted. */
    samples: DroppedReference[];
  };
}

export interface Graph {
  version: 1;
  meta: GraphMeta;
  nodes: GraphNode[];
  edges: GraphEdge[];
}
