import type { GraphNode } from "@tsviz/graph";
import { cardView, type BodyRow } from "./cardBody";
import { rowMatches } from "./highlight";
import type { Relationship } from "./relationships";

/** React Flow handle ids. Every edge names its handles explicitly. */
export const IN_HANDLE = "in";
export const OUT_HANDLE = "out";
/** Edges from rows behind "+N more" leave from that button. */
export const MORE_HANDLE = "more";
export const rowHandle = (index: number) => `row-${index}`;

/**
 * Which handle each outgoing relationship leaves from (relationships keyed
 * by target id), for the `RIGHT` layout, where edges can leave a row's side:
 *
 * - inheritance (`extends` / `implements`) leaves from the card's main port
 * - otherwise the first row it starts at (see `rowMatches`), by its index
 *   among all of the card's rows
 * - a row hidden behind "+N more" leaves from that button
 * - nothing matching: the main port
 *
 * Rows are indexed in the expanded body, and a collapsed body shows a prefix
 * of it, so a row keeps its handle id when the card expands.
 */
export function assignPorts(decl: GraphNode, expanded: boolean, out: Relationship[]): Map<string, string> {
  const all = rowsOf(decl, true);
  const shown = expanded ? all.length : rowsOf(decl, false).length;
  const ports = new Map<string, string>();

  for (const rel of out) {
    if (rel.edges.some((e) => e.kind === "extends" || e.kind === "implements")) {
      ports.set(rel.target, OUT_HANDLE);
      continue;
    }

    const index = all.findIndex((row) => rel.edges.some((e) => rowMatches(row, e)));

    ports.set(rel.target, index < 0 ? OUT_HANDLE : index < shown ? rowHandle(index) : MORE_HANDLE);
  }

  return ports;
}

function rowsOf(decl: GraphNode, expanded: boolean): BodyRow[] {
  const { body } = cardView(decl, expanded);

  return body.kind === "rows" ? body.groups.flatMap((g) => g.rows) : [];
}
