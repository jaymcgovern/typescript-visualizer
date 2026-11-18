import { readFileSync } from "node:fs";
import { type EdgeKind, type GraphEdge, parseGraph } from "@tsviz/graph";
import { describe, expect, it } from "vitest";
import { cardView, type BodyRow } from "../src/graph/cardBody.ts";
import { computeHighlight, NO_HIGHLIGHT, rowMatches, targetName } from "../src/graph/highlight.ts";
import { toFlow } from "../src/graph/toFlow.ts";

const { graph } = parseGraph(
  JSON.parse(readFileSync(new URL("../../../fixtures/fixtures.graph.json", import.meta.url), "utf8")),
  "graph.json",
);
const { edges: flowEdges } = toFlow(graph);
const edges = flowEdges.map((e) => ({ id: e.id, source: e.source, target: e.target, rel: e.data!.rel }));
const idOf = (name: string, kind?: string) =>
  graph.nodes.find((n) => n.name === name && (!kind || n.kind === kind))!.id;
const rowsOf = (name: string, kind?: string): BodyRow[] => {
  const body = cardView(
    graph.nodes.find((n) => n.id === idOf(name, kind))!,
    true,
  ).body;

  return body.kind === "rows" ? body.groups.flatMap((g) => g.rows) : [];
};
const rowOf = (card: string, text: string, kind?: string) =>
  rowsOf(card, kind).find((r) => `${r.op ?? ""}${r.name ?? ""}${r.rest}`.includes(text))!;
const names = (ids: Set<string>) => [...ids].map(targetName).toSorted();
const edge = (kind: EdgeKind, target: string, label?: string): GraphEdge => ({
  source: "a.ts#S",
  target,
  kind,
  ...(label ? { label } : {}),
});

describe("targetName", () => {
  it.each([
    ["src/a.ts#Foo", "Foo"],
    ["src/a.ts#NS.Inner", "Inner"],
    ["src/a.ts#X@variable", "X"],
    ["external:lib#Promise", "Promise"],
  ])("%s → %s", (id, name) => {
    expect(targetName(id)).toBe(name);
  });
});

describe("rowMatches", () => {
  it.each<[string, BodyRow, GraphEdge, boolean]>([
    ["property by name", { name: "owner", rest: ": Owner" }, edge("property", "a.ts#Owner", "owner"), true],
    ["another property", { name: "name", rest: ": string" }, edge("property", "a.ts#Owner", "owner"), false],
    ["method return", { name: "adopt", rest: "(pet: Animal): Dog" }, edge("returns", "a.ts#Dog", "adopt"), true],
    ["method parameter", { name: "adopt", rest: "(pet: Animal): Dog" }, edge("param", "a.ts#Animal", "pet"), true],
    ["optional rest parameter", { name: "f", rest: "(a, ...xs?: X[])" }, edge("param", "a.ts#X", "xs"), true],
    ["return row, named target", { op: "→", rest: "Pet" }, edge("returns", "a.ts#Pet", "lookup"), true],
    ["return row, other target", { op: "→", rest: "Pet" }, edge("returns", "a.ts#Person", "lookup"), false],
    ["return row ignores params", { op: "→", rest: "Pet" }, edge("param", "a.ts#Pet", "x"), false],
    ["union variant", { op: "|", rest: "Square" }, edge("union", "a.ts#Square"), true],
    ["no partial names", { op: "|", rest: "Squares" }, edge("union", "a.ts#Square"), false],
    ["intersection member", { op: "&", rest: "{ color: Color }" }, edge("intersection", "a.ts#Color"), true],
  ])("%s", (_, row, e, expected) => {
    expect(rowMatches(row, e)).toBe(expected);
  });
});

describe("computeHighlight", () => {
  const dog = idOf("Dog", "class");

  it("highlights nothing without focus or hover", () => {
    expect(computeHighlight(edges, {})).toBe(NO_HIGHLIGHT);
  });

  it("focus keeps the focused card's edges and neighbours, and fades the rest", () => {
    const h = computeHighlight(edges, { focusedNodes: [dog] });
    const touching = edges.filter((e) => e.source === dog || e.target === dog);

    expect(h).toMatchObject({ fadeNodes: true, fadeEdges: true });
    expect([...h.activeEdges].toSorted()).toEqual(touching.map((e) => e.id).toSorted());
    expect(names(h.activeNodes)).toEqual(["Animal", "Base", "Dog", "Owner", "Walkable"]);
  });

  it("hovering a card keeps its edges without fading cards", () => {
    const h = computeHighlight(edges, { hover: { node: dog } });

    expect(h.fadeNodes).toBe(false);
    expect(h.fadeEdges).toBe(true);
    expect(h.activeEdges.size).toBe(edges.filter((e) => e.source === dog || e.target === dog).length);
  });

  it.each([
    ["Dog", "class", "owner", ["Owner"]],
    ["Dog", "class", "adopt", ["Animal", "Dog"]],
    ["Dog", "class", "speak", []],
    ["lookup", "function", "owner", ["Person"]],
    ["lookup", "function", "→", ["Pet"]],
    ["Shape", "type", "Square", ["Square"]],
    ["Drawable", "type", "color", ["Color"]],
  ])("hovering %s's row %s targets %j", (card, kind, text, targets) => {
    const h = computeHighlight(edges, { hover: { node: idOf(card, kind), row: rowOf(card, text, kind) } });

    expect(names(h.targetNodes)).toEqual(targets);
    expect(h.activeEdges.size).toBe(targets.length);
  });

  it("hovering a type name keeps only the edge to that declaration", () => {
    const owner = idOf("Owner", "class");
    const h = computeHighlight(edges, {
      focusedNodes: [dog],
      hover: { node: dog, row: rowOf("Dog", "owner", "class"), target: owner },
    });

    expect([...h.activeEdges]).toEqual([`${dog}->${owner}`]);
    expect(names(h.targetNodes)).toEqual(["Owner"]);
  });

  it("a row hover replaces the focus's edges but keeps its cards", () => {
    const h = computeHighlight(edges, {
      focusedNodes: [dog],
      hover: { node: dog, row: rowOf("Dog", "owner", "class") },
    });

    expect(names(h.targetNodes)).toEqual(["Owner"]);
    expect(h.activeEdges.size).toBe(1);
    expect(names(h.activeNodes)).toContain("Walkable");
  });
});
