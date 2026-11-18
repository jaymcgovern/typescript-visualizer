import type { GraphEdge, GraphNode } from "@tsviz/graph";
import { cardView, type BodyRow } from "./cardBody.ts";
import { signatureTails } from "./declaration.ts";
import { rowMatches } from "./highlight.ts";
import { MORE_HANDLE, rowHandle } from "./ports.ts";
import type { Relationship } from "./relationships.ts";

const INHERITANCE: ReadonlySet<GraphEdge["kind"]> = new Set(["extends", "implements"]);

/** Where on its source card a relationship comes from, to light those parts up. */
export interface SourceParts {
  /** Handle ids (see `rowHandle`) of shown rows, plus `MORE_HANDLE` when a match is hidden behind "+N more". */
  rows: Set<string>;
  /** An `extends` / `implements` relationship: the heritage line. */
  heritage: boolean;
}

export function sourceParts(source: GraphNode, expanded: boolean, rel: Pick<Relationship, "edges">): SourceParts {
  const all = rowsOf(source, true);
  const shown = expanded ? all.length : rowsOf(source, false).length;
  const rows = new Set<string>();

  all.forEach((row, i) => {
    if (rel.edges.some((e) => rowMatches(row, e))) rows.add(i < shown ? rowHandle(i) : MORE_HANDLE);
  });

  return { rows, heritage: rel.edges.some((e) => INHERITANCE.has(e.kind)) };
}

/** One graph edge behind a drawn relationship, for the detail popover. */
export interface RelationshipItem {
  edge: GraphEdge;
  /** The source text it comes from: a member row, a parameter, or the heritage clause. */
  via?: string;
  /** `file:line` of the reference, when known. */
  location?: string;
}

/**
 * Every graph edge a drawn relationship stands for, in its order (highest
 * priority first), with the member or clause each comes from. Dog → Animal,
 * drawn as one `implements` arrow, lists `implements` and the `pet` parameter
 * of `adopt`.
 */
export function relationshipItems(source: GraphNode, rel: Pick<Relationship, "edges">): RelationshipItem[] {
  const rows = rowsOf(source, true);
  const heritage = signatureTails(source)[0];

  return rel.edges.map((edge) => {
    const row = rows.find((r) => rowMatches(r, edge));
    const via = INHERITANCE.has(edge.kind) ? heritage : row ? rowText(row) : undefined;
    const location = source.file && edge.line !== undefined ? `${source.file}:${edge.line}` : undefined;

    return { edge, ...(via ? { via } : {}), ...(location ? { location } : {}) };
  });
}

function rowsOf(decl: GraphNode, expanded: boolean): BodyRow[] {
  const { body } = cardView(decl, expanded);

  return body.kind === "rows" ? body.groups.flatMap((g) => g.rows) : [];
}

function rowText(row: BodyRow): string {
  return `${row.op ? `${row.op} ` : ""}${row.name ?? ""}${row.rest}`;
}
