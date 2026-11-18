import { readFileSync } from "node:fs";
import { EDGE_KINDS, type GraphEdge } from "@tsviz/graph";
import { describe, expect, it } from "vitest";
import { parseGraph } from "../src/data/loadGraph";
import { groupRelationships, REL_STYLES, relLabel } from "../src/graph/relationships";

const { graph } = parseGraph(
  JSON.parse(readFileSync(new URL("../../../fixtures/fixtures.graph.json", import.meta.url), "utf8")),
  "graph.json",
);
const edge = (kind: GraphEdge["kind"], label?: string, target = "t"): GraphEdge => ({
  source: "s",
  target,
  kind,
  ...(label ? { label } : {}),
});

describe("relLabel", () => {
  it("formats labels by kind", () => {
    expect(relLabel(edge("property", "items"))).toBe("items");
    expect(relLabel(edge("param", "a"))).toBe("(a)");
    expect(relLabel(edge("returns", "find"))).toBe("find()");
    expect(relLabel(edge("typeArg", "T"))).toBe("<T>");
    expect(relLabel(edge("extends"))).toBeUndefined();
  });
});

describe("groupRelationships", () => {
  it("merges a property and a return into one edge styled as the property", () => {
    const repoBox = groupRelationships(graph.edges).find(
      (r) => r.source.endsWith("#Repo") && r.target.endsWith("box.ts#Box"),
    )!;

    expect(repoBox.kind).toBe("property");
    expect(repoBox.label).toBe("items · find()");
    expect(repoBox.edges.map((e) => e.kind)).toEqual(["property", "returns"]);
  });

  it("lets inheritance win and leaves unlabelled kinds out of the label", () => {
    const dogAnimal = groupRelationships(graph.edges).find(
      (r) => r.source.endsWith("#Dog") && r.target.endsWith("#Animal"),
    )!;

    expect(dogAnimal.kind).toBe("implements");
    expect(dogAnimal.label).toBe("(pet)");
  });

  it("keeps single edges as they are", () => {
    expect(groupRelationships([edge("extends")])).toEqual([
      { source: "s", target: "t", kind: "extends", edges: [edge("extends")] },
    ]);
  });

  it("de-duplicates labels and truncates long lists", () => {
    const [rel] = groupRelationships([
      edge("param", "a"),
      edge("param", "a"),
      edge("param", "b"),
      edge("param", "c"),
      edge("param", "d"),
      edge("param", "e"),
    ]);

    expect(rel!.label).toBe("(a) · (b) · (c) +2");
  });

  it("separates pairs by direction", () => {
    const rels = groupRelationships([edge("property", "x"), { source: "t", target: "s", kind: "property" }]);

    expect(rels).toHaveLength(2);
  });
});

describe("REL_STYLES", () => {
  it("covers every edge kind with a distinct priority", () => {
    expect(Object.keys(REL_STYLES).toSorted()).toEqual([...EDGE_KINDS].toSorted());
    expect(new Set(Object.values(REL_STYLES).map((s) => s.priority)).size).toBe(EDGE_KINDS.length);
  });
});
