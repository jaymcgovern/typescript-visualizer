import { Position, type Edge, type Node } from "@xyflow/react";
import type { Graph, GraphNode } from "@tsviz/graph";
import type { Direction, EdgeRoute, LayoutInput, LayoutResult } from "../layout/elkGraph.ts";
import { assignPorts, IN_HANDLE, OUT_HANDLE } from "./ports.ts";
import type { Ref } from "./refs.ts";
import { groupRelationships, markerId, REL_STYLES, type Relationship } from "./relationships.ts";

/** Relationships (drawn edges, not raw graph edges) into and out of a declaration. */
export type Degree = { in: number; out: number };
export type DeclNodeData = {
  decl: GraphNode;
  degree: Degree;
  /** Relationships this declaration is the source of. */
  out: Relationship[];
  /** Their targets, which the card's text links to by name. */
  refs: Ref[];
  expanded?: boolean;
};
export type DeclNode = Node<DeclNodeData, "decl">;
export type DeclEdgeData = { rel: Relationship; route?: EdgeRoute };
export type DeclEdge = Edge<DeclEdgeData, "elk">;

/** Initial placement, used only for the measuring pass before the first layout. */
export const GRID = { cellWidth: 320, cellHeight: 200 } as const;

/** Sorts nodes without a file (externals) last. */
const NO_FILE = "\u{10ffff}";

/**
 * Maps a graph to React Flow nodes and edges. Nodes start on a grid ordered by
 * file then name; the grid is only seen while nodes are measured, and
 * `applyNodeLayout` then moves them to ELK's positions. Edges between the same
 * two declarations are merged into one (see `groupRelationships`).
 */
export function toFlow(graph: Graph): { nodes: DeclNode[]; edges: DeclEdge[] } {
  const sorted = graph.nodes.toSorted(
    (a, b) => compare(a.file ?? NO_FILE, b.file ?? NO_FILE) || compare(a.name, b.name) || compare(a.id, b.id),
  );
  const columns = Math.max(1, Math.ceil(Math.sqrt(sorted.length)));
  const relationships = groupRelationships(graph.edges);
  const degrees = countDegrees(relationships);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, Relationship[]>();

  for (const rel of relationships) {
    const list = outgoing.get(rel.source);

    if (list) list.push(rel);
    else outgoing.set(rel.source, [rel]);
  }

  const nodes: DeclNode[] = sorted.map((decl, i) => {
    const out = outgoing.get(decl.id) ?? [];

    return {
      id: decl.id,
      type: "decl",
      position: { x: (i % columns) * GRID.cellWidth, y: Math.floor(i / columns) * GRID.cellHeight },
      data: {
        decl,
        degree: degrees.get(decl.id) ?? { in: 0, out: 0 },
        out,
        refs: out.flatMap((rel) => {
          const target = byId.get(rel.target);

          return target ? [{ id: target.id, name: target.name, kind: target.kind }] : [];
        }),
      },
      className: `decl decl--${decl.kind}`,
      ...handlePositions("DOWN"),
    };
  });

  const edges: DeclEdge[] = relationships.map((rel) => {
    const style = REL_STYLES[rel.kind];

    return {
      id: relationshipId(rel),
      type: "elk",
      source: rel.source,
      target: rel.target,
      sourceHandle: OUT_HANDLE,
      targetHandle: IN_HANDLE,
      label: rel.label,
      data: { rel },
      // Colour comes from CSS by family; the dash pattern is per kind.
      className: `rel rel--${rel.kind} rel-family--${style.family}`,
      ...(style.dash ? { style: { strokeDasharray: style.dash } } : {}),
      markerEnd: markerId(rel.kind),
    };
  });

  return { nodes, edges };
}

/** In and out counts per declaration id. A self-reference counts as both. */
export function countDegrees(relationships: Pick<Relationship, "source" | "target">[]): Map<string, Degree> {
  const degrees = new Map<string, Degree>();
  const of = (id: string) => {
    let d = degrees.get(id);

    if (!d) degrees.set(id, (d = { in: 0, out: 0 }));

    return d;
  };

  for (const rel of relationships) {
    of(rel.source).out++;
    of(rel.target).in++;
  }

  return degrees;
}

/** Unique, since relationships are grouped by source and target. */
export function relationshipId(rel: Pick<Relationship, "source" | "target">): string {
  return `${rel.source}->${rel.target}`;
}

/** A handle's anchor point, relative to its node (see `portsOf`). */
export type PortAnchor = { id: string; x: number; y: number };

/**
 * Sizes come from React Flow's measurements; unmeasured nodes get a fallback
 * size. `handles` (from `sourceHandles`) sends edges to member-row ports,
 * whose positions come from `portsOf`.
 */
export function layoutInput(
  nodes: DeclNode[],
  edges: DeclEdge[],
  { handles, portsOf }: { handles?: Map<string, string>; portsOf?: (id: string) => PortAnchor[] } = {},
): LayoutInput {
  return {
    nodes: nodes.map((n) => {
      const ports = handles?.size ? portsOf?.(n.id) : undefined;

      return {
        id: n.id,
        width: n.measured?.width ?? n.width ?? 150,
        height: n.measured?.height ?? n.height ?? 40,
        ...(ports?.length ? { ports } : {}),
      };
    }),
    edges: edges.map((e) => {
      const handle = handles?.get(e.id);

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: typeof e.label === "string" ? e.label : undefined,
        ...(handle && handle !== OUT_HANDLE ? { sourcePort: handle } : {}),
      };
    }),
  };
}

/**
 * The source handle of every edge (by edge id) for a layout direction. Only
 * the `RIGHT` layout routes edges from member rows; `DOWN` keeps one bottom port,
 * because a row's side port would send edges sideways against the flow.
 */
export function sourceHandles(nodes: DeclNode[], direction: Direction): Map<string, string> {
  const handles = new Map<string, string>();

  if (direction !== "RIGHT") return handles;
  for (const n of nodes) {
    for (const [target, handle] of assignPorts(n.data.decl, n.data.expanded ?? false, n.data.out)) {
      handles.set(relationshipId({ source: n.id, target }), handle);
    }
  }

  return handles;
}

/** Points each edge at its source handle (the main one when `handles` has none for it). */
export function applySourceHandles(edges: DeclEdge[], handles: Map<string, string>): DeclEdge[] {
  return edges.map((e) => {
    const handle = handles.get(e.id) ?? OUT_HANDLE;

    return e.sourceHandle === handle ? e : { ...e, sourceHandle: handle };
  });
}

export function applyNodeLayout(nodes: DeclNode[], layout: LayoutResult): DeclNode[] {
  const handles = handlePositions(layout.direction);

  return nodes.map((n) => {
    const position = layout.positions.get(n.id);

    return position ? { ...n, position, ...handles } : n;
  });
}

export function applyEdgeLayout(edges: DeclEdge[], layout: LayoutResult): DeclEdge[] {
  return edges.map((e) => (e.data ? { ...e, data: { ...e.data, route: layout.routes.get(e.id) } } : e));
}

/** Where React Flow draws the handles; must match the ports in `toElkGraph`. */
export function handlePositions(direction: Direction): { sourcePosition: Position; targetPosition: Position } {
  return direction === "DOWN"
    ? { sourcePosition: Position.Bottom, targetPosition: Position.Top }
    : { sourcePosition: Position.Right, targetPosition: Position.Left };
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
