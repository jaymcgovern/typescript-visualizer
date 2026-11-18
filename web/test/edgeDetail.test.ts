import { readFileSync } from "node:fs";
import type { GraphNode } from "@core";
import { describe, expect, it } from "vitest";
import { parseGraph } from "../src/data/loadGraph";
import { COLLAPSED_ROWS } from "../src/graph/cardBody";
import { relationshipItems, sourceParts } from "../src/graph/edgeDetail";
import { computeHighlight } from "../src/graph/highlight";
import { MORE_HANDLE, rowHandle } from "../src/graph/ports";
import { groupRelationships } from "../src/graph/relationships";

const { graph } = parseGraph(
  JSON.parse(readFileSync(new URL("../../graph.json", import.meta.url), "utf8")),
  "graph.json",
);
const nodeOf = (name: string, kind: string) => graph.nodes.find((n) => n.name === name && n.kind === kind)!;
const rels = groupRelationships(graph.edges);
const relOf = (source: GraphNode, target: GraphNode) =>
  rels.find((r) => r.source === source.id && r.target === target.id)!;

const dog = nodeOf("Dog", "class");
const animal = nodeOf("Animal", "interface");
const owner = nodeOf("Owner", "class");

describe("sourceParts", () => {
  it("lights the heritage line and the rows a relationship comes from", () => {
    // Dog -> Animal: `implements`, and adopt(pet: Animal), Dog's fifth row.
    expect(sourceParts(dog, false, relOf(dog, animal))).toEqual({ rows: new Set([rowHandle(4)]), heritage: true });
    expect(sourceParts(dog, false, relOf(dog, owner))).toEqual({ rows: new Set([rowHandle(1)]), heritage: false });
  });

  it("lights '+N more' for rows hidden behind it", () => {
    const big: GraphNode = {
      id: "a.ts#Big",
      name: "Big",
      kind: "interface",
      exported: true,
      members: Array.from({ length: COLLAPSED_ROWS + 3 }, (_, i) => ({ kind: "property" as const, name: `p${i}` })),
    };
    const rel = { edges: [{ source: big.id, target: "a.ts#T", kind: "property" as const, label: "p8" }] };

    expect(sourceParts(big, false, rel).rows).toEqual(new Set([MORE_HANDLE]));
    expect(sourceParts(big, true, rel).rows).toEqual(new Set([rowHandle(8)]));
  });
});

describe("relationshipItems", () => {
  it("lists each graph edge behind a drawn one, with where it comes from", () => {
    expect(relationshipItems(dog, relOf(dog, animal))).toEqual([
      {
        edge: expect.objectContaining({ kind: "implements" }),
        via: "extends Base implements Animal, Walkable",
        location: `${dog.file}:5`,
      },
      {
        edge: expect.objectContaining({ kind: "param", label: "pet" }),
        via: "adopt(pet: Animal): Dog",
        location: `${dog.file}:17`,
      },
    ]);
  });

  it("names function parameters and returns", () => {
    const lookup = nodeOf("lookup", "function");
    const items = relationshipItems(lookup, relOf(lookup, nodeOf("Pet", "interface")));

    expect(items.map((i) => [i.edge.kind, i.via])).toEqual([["returns", "→ Pet"]]);
  });
});

describe("computeHighlight with a selected or hovered edge", () => {
  it("keeps the edge and its two cards, fades the rest, and rings the target", () => {
    const edges = rels.map((r) => ({ id: `${r.source}->${r.target}`, source: r.source, target: r.target, rel: r }));
    const id = `${dog.id}->${owner.id}`;
    const h = computeHighlight(edges, { focusedEdges: [id] });

    expect([...h.activeEdges]).toEqual([id]);
    expect(h.activeNodes).toEqual(new Set([dog.id, owner.id]));
    expect(h.targetNodes).toEqual(new Set([owner.id]));
    expect(h).toMatchObject({ fadeNodes: true, fadeEdges: true });
  });

  it("hovering an edge highlights it the same way, without fading cards", () => {
    const edges = rels.map((r) => ({ id: `${r.source}->${r.target}`, source: r.source, target: r.target, rel: r }));
    const id = `${dog.id}->${owner.id}`;
    const h = computeHighlight(edges, { hoveredEdge: id });

    expect([...h.activeEdges]).toEqual([id]);
    expect(h.targetNodes).toEqual(new Set([owner.id]));
    expect(h).toMatchObject({ fadeNodes: false, fadeEdges: true });
  });
});
