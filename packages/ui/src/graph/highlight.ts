import type { GraphEdge } from "@tsviz/graph";
import type { BodyRow } from "./cardBody.ts";
import type { Relationship } from "./relationships.ts";

/** What the pointer is over: a card, one row of it, or a type name in it that links to `target`. */
export interface HoverTarget {
  node: string;
  row?: BodyRow;
  target?: string;
}

export interface HighlightEdge {
  id: string;
  source: string;
  target: string;
  rel: Pick<Relationship, "edges">;
}

/**
 * Which cards and edges stand out. Anything not active is faded when the
 * matching `fade` flag is set; with no focus and no hover nothing is.
 */
export interface Highlight {
  activeEdges: Set<string>;
  /** Focused cards and their neighbours: never faded. */
  activeNodes: Set<string>;
  /** Cards the hovered row points to: ringed. */
  targetNodes: Set<string>;
  fadeNodes: boolean;
  fadeEdges: boolean;
}

export const NO_HIGHLIGHT: Highlight = {
  activeEdges: new Set(),
  activeNodes: new Set(),
  targetNodes: new Set(),
  fadeNodes: false,
  fadeEdges: false,
};

/**
 * - focus (selected cards): their edges and neighbours stay, everything else fades
 * - a selected edge: it and its two cards stay, everything else fades, and its target is ringed
 * - hovering an edge: it stays and its target is ringed; other edges fade, cards do not
 * - hovering a card: its edges stay (on top of any focus), other edges fade
 * - hovering a row: only that row's edges stay, and their targets are ringed
 * - hovering a linked type name: only the edge to that declaration, which is ringed
 */
export interface HighlightInput {
  /** Selected cards. */
  focusedNodes?: string[];
  /** Selected edges. */
  focusedEdges?: string[];
  /** The card, row or type name under the pointer. */
  hover?: HoverTarget;
  /** The edge under the pointer. */
  hoveredEdge?: string;
}

export function computeHighlight(
  edges: HighlightEdge[],
  { focusedNodes = [], focusedEdges = [], hover, hoveredEdge }: HighlightInput,
): Highlight {
  if (focusedNodes.length === 0 && focusedEdges.length === 0 && !hover && !hoveredEdge) return NO_HIGHLIGHT;

  const focus = new Set(focusedNodes);
  const activeNodes = new Set(focusedNodes);
  const activeEdges = new Set<string>();
  const targetNodes = new Set<string>();

  for (const e of edges) {
    if (focus.has(e.source) || focus.has(e.target)) {
      activeNodes.add(e.source).add(e.target);
      if (!hover?.row && !hover?.target) activeEdges.add(e.id);
    }
  }

  const edgeFocus = new Set(focusedEdges);

  for (const e of edges) {
    if (edgeFocus.has(e.id) || e.id === hoveredEdge) {
      activeEdges.add(e.id);
      activeNodes.add(e.source).add(e.target);
      targetNodes.add(e.target);
    }
  }

  if (hover?.target) {
    activeNodes.add(hover.node);
    targetNodes.add(hover.target);
    for (const e of edges) if (e.source === hover.node && e.target === hover.target) activeEdges.add(e.id);
  } else if (hover?.row) {
    const row = hover.row;

    activeNodes.add(hover.node);
    for (const e of edges) {
      if (e.source === hover.node && e.rel.edges.some((g) => rowMatches(row, g))) {
        activeEdges.add(e.id);
        targetNodes.add(e.target);
      }
    }
  } else if (hover) {
    activeNodes.add(hover.node);
    for (const e of edges) {
      if (e.source === hover.node || e.target === hover.node) activeEdges.add(e.id);
    }
  }

  return { activeEdges, activeNodes, targetNodes, fadeNodes: focus.size + edgeFocus.size > 0, fadeEdges: true };
}

/** Whether a graph edge starts at this row of its source card. */
export function rowMatches(row: BodyRow, edge: GraphEdge): boolean {
  // A property, parameter or method, by name (a method's own name labels its return edge).
  if (row.name !== undefined && edge.label === row.name) return true;
  // A method's parameter is labelled with the parameter's name, which appears in the row's signature.
  if (edge.kind === "param" && edge.label && hasParam(row.rest, edge.label)) return true;
  // `→ R` rows: the return edges whose target the row names.
  if (row.op === "→") return edge.kind === "returns" && mentions(row.rest, targetName(edge.target));
  // `= A`, `| B`, `& C` rows: whatever the variant names.
  if (row.op) return mentions(row.rest, targetName(edge.target));

  return false;
}

/** `src/a.ts#NS.Foo@type` → `Foo`. */
export function targetName(id: string): string {
  const qualified = id.slice(id.indexOf("#") + 1).replace(/@\w+$/, "");

  return qualified.slice(qualified.lastIndexOf(".") + 1);
}

function mentions(text: string, name: string): boolean {
  return new RegExp(`(^|[^\\w$])${escape(name)}(?![\\w$])`).test(text);
}

function hasParam(signature: string, name: string): boolean {
  return new RegExp(`[(,]\\s*(\\.\\.\\.)?${escape(name)}\\??\\s*:`).test(signature);
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
