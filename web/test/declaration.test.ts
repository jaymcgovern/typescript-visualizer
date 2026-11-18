import { readFileSync } from "node:fs";
import type { GraphNode, Member } from "@core";
import { describe, expect, it } from "vitest";
import { parseGraph } from "../src/data/loadGraph";
import { codeSpans, docSummary, memberText, signatureTails } from "../src/graph/declaration";

const { graph } = parseGraph(
  JSON.parse(readFileSync(new URL("../../graph.json", import.meta.url), "utf8")),
  "graph.json",
);
const byName = (name: string, kind?: string) => graph.nodes.find((n) => n.name === name && (!kind || n.kind === kind))!;
const node = (over: Partial<GraphNode>): GraphNode => ({
  id: "a.ts#X",
  name: "X",
  kind: "type",
  exported: true,
  ...over,
});

const m = (kind: Member["kind"], name: string, type?: string): Member => ({ kind, name, ...(type ? { type } : {}) });

describe("signatureTails", () => {
  it.each([
    ["Dog", "class", ["extends Base implements Animal, Walkable"]],
    ["Pet", "interface", ["extends Named"]],
    ["Named", "interface", []],
    ["Maybe", "type", ["= User | null"]],
    ["defaultPet", "variable", [": Pet"]],
    ["lookup", "function", ["(name: string): Pet", "(name: string, owner: Person): Pet"]],
    ["mixin", "function", ["(base: T): T"]],
    ["NS", "namespace", []],
  ])("%s (%s)", (name, kind, expected) => {
    expect(signatureTails(byName(name, kind))).toEqual(expected);
  });

  it("strips generics, including ones containing arrow types", () => {
    expect(
      signatureTails(
        node({
          name: "Fn",
          signature: "export type Fn<T extends (x: number) => void, U = Map<string, T>> = (t: T) => U",
        }),
      ),
    ).toEqual(["= (t: T) => U"]);
  });

  it("matches the name as a whole word, not inside keywords or other names", () => {
    expect(signatureTails(node({ name: "type", signature: "export const type: string" }))).toEqual([": string"]);
    expect(signatureTails(node({ name: "$x", signature: "export const $x = 1" }))).toEqual(["= 1"]);
  });

  it("handles missing signatures", () => {
    expect(signatureTails(node({}))).toEqual([]);
  });
});

describe("memberText", () => {
  it.each([
    [m("property", "pets", "Pet[]"), "pets: Pet[]"],
    [m("property", "name"), "name"],
    [m("method", "walk", "(distance: number): void"), "walk(distance: number): void"],
    [m("index", "[k: string]", "A"), "[k: string]: A"],
    [m("call", "call", "(q: B): A"), "(q: B): A"],
    [m("construct", "new", "(q: B): Dict"), "new (q: B): Dict"],
    [m("enumMember", "Active"), "Active"],
  ])("%o → %s", (member, text) => {
    expect(memberText(member)).toBe(text);
  });
});

describe("docSummary", () => {
  it.each([
    [undefined, undefined],
    ["", undefined],
    ["A person who can own pets.", "A person who can own pets."],
    ["MCP tools over the graph. `load` builds it.", "MCP tools over the graph. `load` builds it."],
    ["Resolves a ref. Records an edge.", "Resolves a ref."],
    ["Constraints, e.g. `<B extends Keyed>`.", "Constraints, e.g. `<B extends Keyed>`."],
    ["Like X, e.g. Foo. Then more.", "Like X, e.g. Foo."],
    ["See {@link GraphIndex | the index} for\n  lookups. More.", "See GraphIndex for lookups."],
    ["No final stop", "No final stop"],
  ])("%j → %j", (doc, summary) => {
    expect(docSummary(doc)).toBe(summary);
  });
});

describe("codeSpans", () => {
  it("marks backticked parts as code", () => {
    expect(codeSpans("Resolves `ref` and `x`.")).toEqual([
      { text: "Resolves ", code: false },
      { text: "ref", code: true },
      { text: " and ", code: false },
      { text: "x", code: true },
      { text: ".", code: false },
    ]);
  });
});
