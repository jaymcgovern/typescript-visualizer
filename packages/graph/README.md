# @tsviz/graph

The graph format shared by [`@tsviz/parser`](../parser) (which writes it),
[`@tsviz/mcp`](../mcp) and [`@tsviz/ui`](../ui) (which read it). It has no
dependencies and runs in browsers and Node.

- **Types:** `Graph`, `GraphNode`, `GraphEdge`, `GraphMeta`, `Member`, and the
  `NODE_KINDS`, `EDGE_KINDS` and `MEMBER_KINDS` lists.
- **Validation:** `parseGraph(data, source)` checks untrusted JSON. It throws
  `GraphLoadError` on structural problems. Duplicate nodes and edges to missing
  nodes are dropped and listed in `warnings`.
- **Queries:** build a `GraphIndex` once, then call `find`, `describe`,
  `neighbors`, `path` and `summary` on it.

```ts
import { GraphIndex, neighbors, parseGraph } from "@tsviz/graph";

const { graph, warnings } = parseGraph(await (await fetch("/graph.json")).json(), "graph.json");
const index = new GraphIndex(graph);
const ref = index.resolveRef("Dog"); // an id, name or qualified name

if ("node" in ref) {
  const { nodes, edges } = neighbors(index, { id: ref.node.id, direction: "out", depth: 2 });
}
```

The format is versioned (`version: 1`). `parseGraph` rejects other versions.
