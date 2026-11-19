import {
  DROP_REASONS,
  EDGE_KINDS,
  groupDropped,
  qualifiedName,
  type DropReason,
  type DroppedName,
  type EdgeKind,
  type GraphMeta,
  type NodeKind,
} from "@tsviz/graph";
import type { Highlight } from "./highlight.ts";
import { REL_STYLES, type RelFamily } from "./relationships.ts";

/** Relationship families in display order, with the kinds each colours. */
export const FAMILIES: { family: RelFamily; label: string; kinds: EdgeKind[] }[] = (
  [
    ["inherit", "Inheritance"],
    ["structure", "Structure"],
    ["signature", "Signature"],
    ["composition", "Composition"],
    ["reference", "Reference"],
  ] as const
).map(([family, label]) => ({
  family,
  label,
  kinds: EDGE_KINDS.filter((k) => REL_STYLES[k].family === family).toSorted(
    (a, b) => REL_STYLES[a].priority - REL_STYLES[b].priority,
  ),
}));

/** What the filter bar has switched off: those cards and edges are faded out of the way. */
export interface Filters {
  kinds: ReadonlySet<NodeKind>;
  families: ReadonlySet<RelFamily>;
}

export const NO_FILTERS: Filters = { kinds: new Set(), families: new Set() };

/** A filter chip under the pointer (or keyboard focus): everything it covers is highlighted. */
export type FilterHover = { kind: NodeKind } | { family: RelFamily };

export interface FilterNode {
  id: string;
  kind: NodeKind;
}

export interface FilterEdge {
  id: string;
  source: string;
  target: string;
  /** The kind the edge is drawn as (a merged edge takes its highest-priority kind). */
  kind: EdgeKind;
}

export function familyOf(kind: EdgeKind): RelFamily {
  return REL_STYLES[kind].family;
}

/**
 * Cards and edges the filters switch off. An edge goes with its family, and
 * with either of its cards, since a line to a faded card leads nowhere.
 */
export function filteredOut(
  nodes: FilterNode[],
  edges: FilterEdge[],
  filters: Filters,
): { nodes: Set<string>; edges: Set<string> } {
  const offNodes = new Set(nodes.filter((n) => filters.kinds.has(n.kind)).map((n) => n.id));
  const offEdges = new Set(
    edges
      .filter((e) => filters.families.has(familyOf(e.kind)) || offNodes.has(e.source) || offNodes.has(e.target))
      .map((e) => e.id),
  );

  return { nodes: offNodes, edges: offEdges };
}

/**
 * Highlight for a hovered chip: a kind keeps its cards and their edges; a
 * family keeps its edges and the cards they join. Everything else fades.
 */
export function filterHighlight(nodes: FilterNode[], edges: FilterEdge[], hover: FilterHover): Highlight {
  const activeNodes = new Set<string>();
  const activeEdges = new Set<string>();

  if ("kind" in hover) {
    for (const n of nodes) if (n.kind === hover.kind) activeNodes.add(n.id);
    for (const e of edges) if (activeNodes.has(e.source) || activeNodes.has(e.target)) activeEdges.add(e.id);
  } else {
    for (const e of edges) {
      if (familyOf(e.kind) === hover.family) {
        activeEdges.add(e.id);
        activeNodes.add(e.source).add(e.target);
      }
    }
  }

  return { activeNodes, activeEdges, targetNodes: new Set(), fadeNodes: true, fadeEdges: true };
}

/** `set` with `item` added, or removed if it was there. */
export function toggle<T>(set: ReadonlySet<T>, item: T): Set<T> {
  const next = new Set(set);

  if (!next.delete(item)) next.add(item);

  return next;
}

export function countBy<T, K>(items: T[], key: (item: T) => K): Map<K, number> {
  const counts = new Map<K, number>();

  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);

  return counts;
}

export interface DroppedSiteItem {
  /** Id of the declaration the reference appears in. */
  from: string;
  /** That declaration's qualified name. */
  fromName: string;
  line: number;
}

/** Every dropped reference to one name. */
export interface DroppedItem {
  /** The reference as written. */
  name: string;
  /** For an external reference: `lib`, a package name, or a file. */
  origin?: string;
  count: number;
  /** The first few places it appears; fewer than `count` when it appears often. */
  sites: DroppedSiteItem[];
}

export interface DroppedGroup {
  reason: DropReason;
  title: string;
  /** What the reason means, and what to do about it. */
  hint: string;
  count: number;
  /** Their counts add up to fewer than `count` when the graph predates `dropped.names` and kept only samples. */
  items: DroppedItem[];
}

const GROUPS: Record<DropReason, { title: string; hint: string }> = {
  external: {
    title: "Outside the analysed files",
    hint: "Extract with --include-external to draw these as placeholder declarations.",
  },
  unresolved: {
    title: "Could not be resolved",
    hint: "No declaration was found, e.g. a missing import or a call in an extends clause.",
  },
};

/**
 * The references the graph has no edge for: a short chip label, and the
 * references grouped by why they were dropped, then by name. Undefined when
 * none were.
 */
export function droppedSummary(meta: GraphMeta): { label: string; groups: DroppedGroup[] } | undefined {
  const { external, unresolved, samples, names } = meta.dropped;
  const byReason = new Map<DropReason, DroppedItem[]>();
  // Older graphs record only counts, plus samples of the unresolved ones.
  const listed = names ?? groupDropped(samples.map((r) => ({ ...r, reason: "unresolved" })));

  for (const n of listed) {
    const items = byReason.get(n.reason) ?? [];

    items.push(toItem(n));
    byReason.set(n.reason, items);
  }

  const counts: Record<DropReason, number> = { external, unresolved };
  // With the full list, count what it holds, so a stale count can't claim entries are missing.
  const countOf = (reason: DropReason) =>
    names ? (byReason.get(reason) ?? []).reduce((sum, i) => sum + i.count, 0) : counts[reason];
  const groups = DROP_REASONS.map((reason) => ({
    reason,
    ...GROUPS[reason],
    count: countOf(reason),
    items: byReason.get(reason) ?? [],
  })).filter((g) => g.count > 0);
  const total = groups.reduce((sum, g) => sum + g.count, 0);

  if (total === 0) return undefined;

  return { label: `${total} ${total === 1 ? "reference" : "references"} not drawn`, groups };
}

function toItem({ name, origin, count, sites }: DroppedName): DroppedItem {
  return {
    name,
    ...(origin !== undefined ? { origin } : {}),
    count,
    sites: sites.map(({ from, line }) => ({ from, fromName: qualifiedName(from), line })),
  };
}
