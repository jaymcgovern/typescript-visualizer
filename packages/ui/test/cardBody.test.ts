import { readFileSync } from "node:fs";
import { type GraphNode, type Member, parseGraph } from "@tsviz/graph";
import { describe, expect, it } from "vitest";
import {
  cardView,
  COLLAPSED_CHIPS,
  COLLAPSED_ROWS,
  signatureRows,
  splitTopLevel,
  type CardBody,
} from "../src/graph/cardBody.ts";

const { graph } = parseGraph(
  JSON.parse(readFileSync(new URL("../../../fixtures/fixtures.graph.json", import.meta.url), "utf8")),
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

/** Rows as text, one array per group. */
function rowText(body: CardBody): string[][] {
  if (body.kind !== "rows") throw new Error(`expected rows, got ${body.kind}`);

  return body.groups.map((g) => g.rows.map((r) => `${r.op ? `${r.op} ` : ""}${r.name ?? ""}${r.rest}`));
}

describe("splitTopLevel", () => {
  it.each([
    ["A | B", "|", ["A ", " B"]],
    ["Map<A, B> | (C | D)", "|", ["Map<A, B> ", " (C | D)"]],
    ['"a|b" | C', "|", ['"a|b" ', " C"]],
    ["(x: A) => B | C", "|", ["(x: A) => B ", " C"]],
    ["a: { b: C }, d: E", ",", ["a: { b: C }", " d: E"]],
    ["T extends A ? B : C", "?", ["T extends A ", " B : C"]],
    ["{ a?: B }", "?", ["{ a?: B }"]],
  ])("%s on %s", (text, sep, parts) => {
    expect(splitTopLevel(text, sep)).toEqual(parts);
  });
});

describe("cardView", () => {
  it("groups members as signatures, then properties, then methods", () => {
    const view = cardView(
      node({
        kind: "interface",
        name: "Dict",
        signature: "export interface Dict extends Base",
        members: [
          m("method", "get", "(k: string): A"),
          m("property", "size", "number"),
          m("index", "[k: string]", "A"),
          m("property", "owner", "Owner"),
        ],
      }),
    );

    expect(view.heritage).toBe("extends Base");
    expect(rowText(view.body)).toEqual([["[k: string]: A"], ["size: number", "owner: Owner"], ["get(k: string): A"]]);
    expect(view.collapse).toBeUndefined();
  });

  it("collapses long member lists across groups, and shows them all when expanded", () => {
    const members = [
      ...Array.from({ length: 4 }, (_, i) => m("property", `p${i}`)),
      ...Array.from({ length: 6 }, (_, i) => m("method", `f${i}`)),
    ];
    const decl = node({ kind: "class", members });
    const collapsed = cardView(decl);

    expect(rowText(collapsed.body).flat()).toHaveLength(COLLAPSED_ROWS);
    expect(rowText(collapsed.body)).toHaveLength(2);
    expect(collapsed.collapse).toEqual({ hidden: 10 - COLLAPSED_ROWS, noun: "more" });
    expect(rowText(cardView(decl, true).body).flat()).toHaveLength(10);
    expect(cardView(decl, true).collapse).toEqual({ hidden: 0, noun: "more" });
  });

  it("shows one extra row rather than '+1 more'", () => {
    const members = Array.from({ length: COLLAPSED_ROWS + 1 }, (_, i) => m("property", `p${i}`));

    expect(cardView(node({ kind: "interface", members })).collapse).toBeUndefined();
  });

  it("shows enum values as chips", () => {
    expect(cardView(byName("Status", "enum")).body).toEqual({ kind: "chips", items: ["Active", "Inactive"] });
  });

  it("collapses long enums", () => {
    const members = Array.from({ length: 20 }, (_, i) => m("enumMember", `V${i}`));
    const view = cardView(node({ kind: "enum", members }));

    expect(view.body.kind === "chips" && view.body.items).toHaveLength(COLLAPSED_CHIPS);
    expect(view.collapse).toEqual({ hidden: 20 - COLLAPSED_CHIPS, noun: "more" });
  });

  it.each([
    ["Shape", [["= Circle", "| Square"]]],
    ["Maybe", [["= User", "| null"]]],
    ["Drawable", [["= Shape", "& { color: Color }"]]],
    ["Color", [["= string"]]],
    ["Cond", [["= T extends Circle ? Square : never"]]],
  ])("type %s → variant rows", (name, rows) => {
    expect(rowText(cardView(byName(name, "type")).body)).toEqual(rows);
  });

  it("shows a union of literals as chips", () => {
    const decl = node({ name: "Reason", signature: 'export type Reason = "typeParam" | "external" | 1 | null' });

    expect(cardView(decl).body).toEqual({ kind: "chips", items: ['"typeParam"', '"external"', "1", "null"] });
  });

  it("ignores a leading | in a union", () => {
    expect(rowText(cardView(node({ signature: "type X = | A | B" })).body)).toEqual([["= A", "| B"]]);
  });

  it("shows a function's parameters and return type", () => {
    const view = cardView(byName("describe", "function"));

    expect(view.inline).toBeUndefined();
    expect(rowText(view.body)).toEqual([["s: Status", "→ string"]]);
  });

  it("numbers overloads", () => {
    const view = cardView(byName("lookup", "function"));

    expect(view.inline).toBe("2 overloads");
    expect(view.body.kind === "rows" && view.body.groups.map((g) => g.label)).toEqual(["1", "2"]);
    expect(rowText(view.body)).toEqual([
      ["name: string", "→ Pet"],
      ["name: string", "owner: Person", "→ Pet"],
    ]);
  });

  it("shows only the first of many overloads until expanded", () => {
    const signature = ["a: A", "b: B", "c: C", "d: D"].map((p) => `export function g(${p}): void`).join("\n");
    const decl = node({ kind: "function", name: "g", signature });

    expect(rowText(cardView(decl).body)).toEqual([["a: A", "→ void"]]);
    expect(cardView(decl).collapse).toEqual({ hidden: 3, noun: "overloads" });
    expect(rowText(cardView(decl, true).body)).toHaveLength(4);
  });

  it("puts a variable's type in the header", () => {
    expect(cardView(byName("defaultPet", "variable"))).toEqual({ inline: ": Pet", body: { kind: "none" } });
    expect(cardView(node({ kind: "variable", signature: "export const X" }))).toEqual({ body: { kind: "none" } });
  });
});

describe("signatureRows", () => {
  it.each([
    ["(): void", ["→ void"]],
    ["(a?: A, ...rest: B[]): C", ["a?: A", "...rest: B[]", "→ C"]],
    [
      "( values: { a?: string; b: boolean; }, onDrop: (d: Drop) => void = () => {}, ): GraphEdge[]",
      ["values: { a?: string; b: boolean; }", "onDrop: (d: Drop) => void = () => {}", "→ GraphEdge[]"],
    ],
    ["({ a, b }: Opts): x is Y", ["{ a, b }: Opts", "→ x is Y"]],
  ])("%s", (tail, rows) => {
    expect(signatureRows(tail).map((r) => `${r.op ? `${r.op} ` : ""}${r.name ?? ""}${r.rest}`)).toEqual(rows);
  });
});
