import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GraphIndex, neighbors, parseGraph } from "@tsviz/graph";
import { countDegrees, GRID, toFlow } from "../src/graph/toFlow.ts";

const { graph } = parseGraph(
  JSON.parse(readFileSync(new URL("../../../fixtures/fixtures.graph.json", import.meta.url), "utf8")),
  "graph.json",
);

describe("toFlow", () => {
  const { nodes, edges } = toFlow(graph);

  it("creates one card per declaration and one edge per related pair", () => {
    expect(nodes.map((n) => n.id).toSorted()).toEqual(graph.nodes.map((n) => n.id).toSorted());
    expect(nodes.every((n) => n.type === "decl")).toBe(true);
    const pairs = new Set(graph.edges.map((e) => `${e.source}->${e.target}`));
    expect(edges).toHaveLength(pairs.size);
    expect(edges.length).toBeLessThan(graph.edges.length);
  });

  it("keeps every graph edge exactly once, on the edge for its pair", () => {
    const kept = edges.flatMap((e) => e.data!.rel.edges);
    expect(kept).toHaveLength(graph.edges.length);
    expect(new Set(kept)).toEqual(new Set(graph.edges));
    for (const e of edges) {
      expect(new Set(e.data!.rel.edges.map((r) => `${r.source}->${r.target}`))).toEqual(new Set([e.id]));
    }
  });

  it("styles each edge by its relationship kind", () => {
    const implementsEdge = edges.find((e) => e.data!.rel.kind === "implements")!;
    expect(implementsEdge).toMatchObject({
      className: "rel rel--implements rel-family--inherit",
      markerEnd: "tsv-marker-implements",
      style: { strokeDasharray: "6 4" },
    });
    const extendsEdge = edges.find((e) => e.data!.rel.kind === "extends")!;
    expect(extendsEdge.style).toBeUndefined();
  });

  it("places nodes on distinct grid cells, grouped by file", () => {
    const cells = new Set(nodes.map((n) => `${n.position.x},${n.position.y}`));
    expect(cells.size).toBe(nodes.length);
    for (const n of nodes) {
      expect(n.position.x % GRID.cellWidth).toBe(0);
      expect(n.position.y % GRID.cellHeight).toBe(0);
    }
    const files = nodes.map((n) => n.data.decl.file ?? "");
    expect(files).toEqual(files.toSorted());
  });
});

describe("@core alias", () => {
  it("runs the shared queries against the loaded graph", () => {
    const index = new GraphIndex(graph);
    const dog = index.resolveRef("Dog");
    expect("node" in dog).toBe(true);
    if (!("node" in dog)) return;

    const sub = neighbors(index, { id: dog.node.id, direction: "out", depth: 1 });
    expect(sub.nodes.length).toBeGreaterThan(1);
  });
});

describe("degree", () => {
  it("counts drawn edges into and out of each card", () => {
    const { nodes, edges } = toFlow(graph);

    for (const n of nodes) {
      expect(n.data.degree).toEqual({
        in: edges.filter((e) => e.target === n.id).length,
        out: edges.filter((e) => e.source === n.id).length,
      });
    }
    expect(nodes.some((n) => n.data.degree.in > 0 && n.data.degree.out > 0)).toBe(true);
  });

  it("counts a self-reference as both in and out", () => {
    const degrees = countDegrees([
      { source: "a", target: "a" },
      { source: "a", target: "b" },
    ]);

    expect(degrees.get("a")).toEqual({ in: 1, out: 2 });
    expect(degrees.get("b")).toEqual({ in: 1, out: 0 });
  });
});
