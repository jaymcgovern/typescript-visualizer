import { DROP_REASONS, MAX_DROP_SITES, type DropReason, type DroppedName, type DroppedReference } from "./types.ts";

export interface ReasonedReference extends DroppedReference {
  reason: DropReason;
  origin?: string;
}

/**
 * Groups dropped references by reason, name and origin, keeping a count and
 * the first `MAX_DROP_SITES` sites of each. Sorted by reason (in
 * `DROP_REASONS` order), then most frequent first, then name and origin.
 */
export function groupDropped(references: Iterable<ReasonedReference>): DroppedName[] {
  const byKey = new Map<string, { name: DroppedName; sites: DroppedReference[] }>();

  for (const r of references) {
    const key = JSON.stringify([r.reason, r.name, r.origin ?? null]);
    let entry = byKey.get(key);

    if (!entry) {
      entry = {
        name: {
          reason: r.reason,
          name: r.name,
          ...(r.origin !== undefined ? { origin: r.origin } : {}),
          count: 0,
          sites: [],
        },
        sites: [],
      };
      byKey.set(key, entry);
    }
    entry.name.count++;
    entry.sites.push(r);
  }

  return [...byKey.values()]
    .map(({ name, sites }) => ({
      ...name,
      sites: sites
        .sort((a, b) => compare(a.from, b.from) || a.line - b.line)
        .slice(0, MAX_DROP_SITES)
        .map(({ from, line }) => ({ from, line })),
    }))
    .sort(
      (a, b) =>
        DROP_REASONS.indexOf(a.reason) - DROP_REASONS.indexOf(b.reason) ||
        b.count - a.count ||
        compare(a.name, b.name) ||
        compare(a.origin ?? "", b.origin ?? ""),
    );
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
