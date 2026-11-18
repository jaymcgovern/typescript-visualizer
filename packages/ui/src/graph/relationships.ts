import type { EdgeKind, GraphEdge } from "@tsviz/graph";

/** Edge kinds that share a colour. */
export type RelFamily = "inherit" | "structure" | "signature" | "composition" | "reference";

export type MarkerShape = "triangle-hollow" | "arrow" | "vee";

export interface RelStyle {
  family: RelFamily;
  marker: MarkerShape;
  dash?: string;
  /** Lower wins when parallel relationships are drawn as one edge. */
  priority: number;
  /** One-line description, for the filter bar's help. */
  meaning: string;
}

export const REL_STYLES: Record<EdgeKind, RelStyle> = {
  extends: { family: "inherit", marker: "triangle-hollow", priority: 0, meaning: "extends a class or interface" },
  implements: {
    family: "inherit",
    marker: "triangle-hollow",
    dash: "6 4",
    priority: 1,
    meaning: "implements an interface",
  },
  property: { family: "structure", marker: "arrow", priority: 2, meaning: "has a property of this type" },
  returns: { family: "signature", marker: "arrow", priority: 3, meaning: "a function or method returns it" },
  param: { family: "signature", marker: "vee", dash: "4 3", priority: 4, meaning: "takes it as a parameter" },
  union: { family: "composition", marker: "arrow", dash: "1 3", priority: 5, meaning: "member of a union" },
  intersection: {
    family: "composition",
    marker: "vee",
    dash: "1 3",
    priority: 6,
    meaning: "member of an intersection",
  },
  typeArg: { family: "reference", marker: "vee", dash: "3 3", priority: 7, meaning: "used as a type argument" },
  typeof: { family: "reference", marker: "vee", dash: "3 3", priority: 8, meaning: "typeof a value" },
  references: { family: "reference", marker: "vee", dash: "3 3", priority: 9, meaning: "any other reference" },
};

/** Id of the SVG `<marker>` for an edge kind (see EdgeMarkers). */
export const markerId = (kind: EdgeKind) => `tsv-marker-${kind}`;

/** How a relationship reads on its edge: `items`, `(a)` for a parameter, `find()` for a return. */
export function relLabel(edge: GraphEdge): string | undefined {
  if (!edge.label) return undefined;

  switch (edge.kind) {
    case "param":
      return `(${edge.label})`;
    case "returns":
      return `${edge.label}()`;
    case "typeArg":
      return `<${edge.label}>`;
    default:
      return edge.label;
  }
}

export interface Relationship {
  source: string;
  target: string;
  /** Highest-priority kind among `edges`; decides the edge's style. */
  kind: EdgeKind;
  /** Every graph edge between source and target, highest priority first. */
  edges: GraphEdge[];
  /** Labels of `edges`, joined; undefined when none has a label. */
  label?: string;
}

/**
 * Groups edges by (source, target). Two declarations can be related several
 * ways (e.g. a property and a return type); drawn separately those edges
 * share ports and overlap, so they become one edge listing each relationship.
 */
export function groupRelationships(edges: GraphEdge[]): Relationship[] {
  const groups = new Map<string, GraphEdge[]>();

  for (const e of edges) {
    const key = `${e.source}\n${e.target}`;
    const list = groups.get(key);

    if (list) list.push(e);
    else groups.set(key, [e]);
  }

  return [...groups.values()].map((group) => {
    const sorted = group.toSorted((a, b) => REL_STYLES[a.kind].priority - REL_STYLES[b.kind].priority);
    const first = sorted[0]!;
    const labels = [...new Set(sorted.map(relLabel).filter((l) => l !== undefined))];

    return {
      source: first.source,
      target: first.target,
      kind: first.kind,
      edges: sorted,
      ...(labels.length > 0 ? { label: joinLabels(labels) } : {}),
    };
  });
}

const MAX_LABEL_PARTS = 3;

function joinLabels(labels: string[]): string {
  if (labels.length <= MAX_LABEL_PARTS) return labels.join(" · ");

  return `${labels.slice(0, MAX_LABEL_PARTS).join(" · ")} +${labels.length - MAX_LABEL_PARTS}`;
}
