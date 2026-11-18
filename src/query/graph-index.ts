import type { Graph, GraphEdge, GraphNode } from "../types";

export type RefResolution = { node: GraphNode } | { candidates: GraphNode[] } | { missing: true };

/**
 * Lookup structures over a `Graph`: nodes by id and name, and edges in both
 * directions so "what uses X" is as cheap as "what does X use".
 */
export class GraphIndex {
  readonly byId = new Map<string, GraphNode>();
  private readonly out = new Map<string, GraphEdge[]>();
  private readonly in = new Map<string, GraphEdge[]>();
  private readonly byName = new Map<string, GraphNode[]>();

  constructor(readonly graph: Graph) {
    for (const n of graph.nodes) {
      this.byId.set(n.id, n);

      const keys = new Set([n.name.toLowerCase(), qualifiedName(n).toLowerCase()]);

      for (const key of keys) push(this.byName, key, n);
    }

    for (const e of graph.edges) {
      push(this.out, e.source, e);
      push(this.in, e.target, e);
    }
  }

  get nodes(): GraphNode[] {
    return this.graph.nodes;
  }

  outgoing(id: string): GraphEdge[] {
    return this.out.get(id) ?? [];
  }

  incoming(id: string): GraphEdge[] {
    return this.in.get(id) ?? [];
  }

  /**
   * Accepts an id, an id suffix (`dog.ts#Dog`), or a name / qualified name
   * (`Dog`, `NS.Inner`). Several matches come back as candidates.
   */
  resolveRef(ref: string): RefResolution {
    const exact = this.byId.get(ref);

    if (exact) return { node: exact };

    if (ref.includes("#")) {
      return pick(this.nodes.filter((n) => n.id.endsWith(ref)));
    }

    const matches = this.byName.get(ref.toLowerCase()) ?? [];
    // A case-sensitive match beats case-insensitive ones.
    const caseSensitive = matches.filter((n) => n.name === ref || qualifiedName(n) === ref);

    return pick(caseSensitive.length > 0 ? caseSensitive : matches);
  }
}

/** The part of the id after `#`, without any `@kind` disambiguator. */
export function qualifiedName(n: GraphNode): string {
  const hash = n.id.indexOf("#");
  const qualified = hash >= 0 ? n.id.slice(hash + 1) : n.id;

  return qualified.replace(/@[a-z]+$/, "");
}

function pick(nodes: GraphNode[]): RefResolution {
  if (nodes.length === 1) return { node: nodes[0]! };
  if (nodes.length > 1) return { candidates: nodes };

  return { missing: true };
}

function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key);

  if (list) list.push(value);
  else map.set(key, [value]);
}
