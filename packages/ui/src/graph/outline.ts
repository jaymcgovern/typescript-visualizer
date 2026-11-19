import { NODE_KINDS, qualifiedName, type GraphNode, type NodeKind } from "@tsviz/graph";

/** One declaration as the outline lists it. */
export interface OutlineEntry {
  id: string;
  /** Qualified name, e.g. `Shapes.Circle`. */
  name: string;
  kind: NodeKind;
  /** Source file, or for an external declaration where it comes from. */
  where?: string;
  members: string[];
}

/** Why an entry matches the filter text, when its name alone does not show it. */
export type OutlineMatch = { via: "name" } | { via: "where" } | { via: "member"; member: string };

export interface OutlineItem extends OutlineEntry {
  match?: OutlineMatch;
}

export interface OutlineGroup {
  kind: NodeKind;
  /** Declarations of this kind in the graph, matching or not. */
  total: number;
  items: OutlineItem[];
}

export function outlineEntries(nodes: GraphNode[]): OutlineEntry[] {
  return nodes.map((n) => {
    const where = n.file ?? n.origin;

    return {
      id: n.id,
      name: qualifiedName(n),
      kind: n.kind,
      ...(where !== undefined ? { where } : {}),
      members: (n.members ?? []).map((m) => m.name).filter((name) => name !== ""),
    };
  });
}

/**
 * How `entry` matches `query`: every whitespace-separated term, ignoring
 * case, must appear in its name, its file, or one of its member names.
 * Reports the first of those that explains the match; undefined if it does not match.
 */
export function matchEntry(entry: OutlineEntry, query: string): OutlineMatch | undefined {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  if (terms.length === 0) return { via: "name" };
  const name = entry.name.toLowerCase();
  const where = entry.where?.toLowerCase() ?? "";
  const members = entry.members.map((m) => m.toLowerCase());
  let match: OutlineMatch = { via: "name" };

  for (const term of terms) {
    if (name.includes(term)) continue;
    if (where.includes(term)) {
      if (match.via === "name") match = { via: "where" };
      continue;
    }
    const i = members.findIndex((m) => m.includes(term));

    if (i < 0) return undefined;
    if (match.via !== "member") match = { via: "member", member: entry.members[i]! };
  }

  return match;
}

/**
 * The entries matching `query`, grouped by kind in the legend's order. Within
 * a group, names starting with the query come first, then other name
 * matches, then matches on the file or a member; each tier alphabetically.
 * Groups with no matches are left out.
 */
export function outlineGroups(entries: OutlineEntry[], query: string): OutlineGroup[] {
  const q = query.trim().toLowerCase();
  const rank = (item: OutlineItem) =>
    item.match?.via !== "name" ? 2 : q && !item.name.toLowerCase().startsWith(q) ? 1 : 0;

  return NODE_KINDS.flatMap((kind) => {
    const ofKind = entries.filter((e) => e.kind === kind);
    const items = ofKind
      .flatMap((e): OutlineItem[] => {
        const match = matchEntry(e, q);

        return match ? [{ ...e, match }] : [];
      })
      .toSorted((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

    return items.length > 0 ? [{ kind, total: ofKind.length, items }] : [];
  });
}

/** The last two segments of a path, enough to tell most files apart. */
export function shortPath(path: string): string {
  return path.split("/").slice(-2).join("/");
}
