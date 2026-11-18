import { EDGE_KINDS, type GraphMeta } from "@tsviz/graph";
import { describe, expect, it } from "vitest";
import {
  droppedSummary,
  FAMILIES,
  filteredOut,
  filterHighlight,
  type FilterEdge,
  type FilterNode,
} from "../src/graph/filters.ts";

const nodes: FilterNode[] = [
  { id: "Dog", kind: "class" },
  { id: "Animal", kind: "interface" },
  { id: "Owner", kind: "class" },
  { id: "x", kind: "variable" },
];
const edges: FilterEdge[] = [
  { id: "Dog->Animal", source: "Dog", target: "Animal", kind: "implements" },
  { id: "Dog->Owner", source: "Dog", target: "Owner", kind: "property" },
  { id: "x->Dog", source: "x", target: "Dog", kind: "typeof" },
];
const meta = (dropped: Partial<GraphMeta["dropped"]>): GraphMeta => ({
  root: "/r",
  files: [],
  includeExternal: false,
  dropped: { external: 0, unresolved: 0, samples: [], ...dropped },
});

describe("FAMILIES", () => {
  it("covers every edge kind once, in priority order", () => {
    expect(FAMILIES.flatMap((f) => f.kinds).toSorted()).toEqual([...EDGE_KINDS].toSorted());
    expect(FAMILIES[0]).toMatchObject({ family: "inherit", kinds: ["extends", "implements"] });
  });
});

describe("filteredOut", () => {
  it("fades a kind's cards and every edge touching them", () => {
    const out = filteredOut(nodes, edges, { kinds: new Set(["variable"]), families: new Set() });

    expect(out).toEqual({ nodes: new Set(["x"]), edges: new Set(["x->Dog"]) });
  });

  it("fades a family's edges but not their cards", () => {
    const out = filteredOut(nodes, edges, { kinds: new Set(), families: new Set(["inherit"]) });

    expect(out).toEqual({ nodes: new Set(), edges: new Set(["Dog->Animal"]) });
  });
});

describe("filterHighlight", () => {
  it("a kind keeps its cards and their edges", () => {
    const h = filterHighlight(nodes, edges, { kind: "interface" });

    expect(h.activeNodes).toEqual(new Set(["Animal"]));
    expect(h.activeEdges).toEqual(new Set(["Dog->Animal"]));
    expect(h).toMatchObject({ fadeNodes: true, fadeEdges: true });
  });

  it("a family keeps its edges and the cards they join", () => {
    const h = filterHighlight(nodes, edges, { family: "structure" });

    expect(h.activeEdges).toEqual(new Set(["Dog->Owner"]));
    expect(h.activeNodes).toEqual(new Set(["Dog", "Owner"]));
  });
});

describe("droppedSummary", () => {
  it("is undefined when nothing was dropped", () => {
    expect(droppedSummary(meta({}))).toBeUndefined();
  });

  it("lists every dropped reference, grouped by reason", () => {
    const s = droppedSummary(
      meta({
        external: 2,
        unresolved: 1,
        references: [
          { from: "src/a.ts#Foo", name: "Missing", line: 3, reason: "unresolved" },
          { from: "src/a.ts#Foo", name: "Map", line: 4, reason: "external", origin: "lib" },
          { from: "src/b.ts#NS.Bar", name: "Project", line: 9, reason: "external", origin: "ts-morph" },
        ],
      }),
    )!;

    expect(s.label).toBe("3 references not drawn");
    expect(s.groups.map((g) => [g.reason, g.count, g.items.length])).toEqual([
      ["external", 2, 2],
      ["unresolved", 1, 1],
    ]);
    expect(s.groups[0]!.items[1]).toEqual({
      from: "src/b.ts#NS.Bar",
      fromName: "NS.Bar",
      name: "Project",
      line: 9,
      origin: "ts-morph",
    });
    expect(s.groups[1]!.items).toEqual([{ from: "src/a.ts#Foo", fromName: "Foo", name: "Missing", line: 3 }]);
  });

  it("falls back to counts and samples for graphs without the full list", () => {
    const s = droppedSummary(
      meta({ external: 41, unresolved: 2, samples: [{ from: "src/a.ts#Foo", name: "Missing", line: 3 }] }),
    )!;

    expect(s.label).toBe("43 references not drawn");
    expect(s.groups.map((g) => [g.reason, g.count, g.items.length])).toEqual([
      ["external", 41, 0],
      ["unresolved", 2, 1],
    ]);
  });

  it("omits empty groups", () => {
    expect(droppedSummary(meta({ unresolved: 1 }))!.groups.map((g) => g.reason)).toEqual(["unresolved"]);
  });

  it("uses the singular for one", () => {
    expect(droppedSummary(meta({ unresolved: 1 }))!.label).toBe("1 reference not drawn");
  });
});
