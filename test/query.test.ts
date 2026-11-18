import path from "node:path";
import { describe as suite, expect, it } from "vitest";
import { extractGraph } from "../src/extract";
import { formatSubgraph } from "../src/query/format";
import { GraphIndex } from "../src/query/graph-index";
import { find, neighbors, path as findPath } from "../src/query/queries";

const repoRoot = path.resolve(import.meta.dirname, "..");
const index = new GraphIndex(extractGraph({ files: ["fixtures/**/*.ts"], root: repoRoot }));

const DOG = "fixtures/classes/dog.ts#Dog";
const ANIMAL = "fixtures/classes/animal.ts#Animal";

suite("resolveRef", () => {
  it("accepts ids, id suffixes, names and qualified names", () => {
    expect(index.resolveRef(DOG)).toEqual({ node: index.byId.get(DOG) });
    expect(index.resolveRef("dog.ts#Dog")).toEqual({ node: index.byId.get(DOG) });
    expect(index.resolveRef("Dog")).toEqual({ node: index.byId.get(DOG) });
    expect(index.resolveRef("NS.Inner")).toEqual({
      node: index.byId.get("fixtures/modules/a.ts#NS.Inner"),
    });
  });

  it("returns candidates for an ambiguous name", () => {
    const r = index.resolveRef("Status");

    expect("candidates" in r && r.candidates.map((n) => n.id)).toEqual([
      "fixtures/edge-cases/merging.ts#Status",
      "fixtures/edge-cases/merging.ts#Status@variable",
      "fixtures/enums-fns/status.ts#Status",
    ]);
  });

  it("reports unknown refs", () => {
    expect(index.resolveRef("Nope")).toEqual({ missing: true });
  });
});

suite("find", () => {
  it("ranks exact, then prefix, then substring matches", () => {
    const names = find(index, { query: "status" }).matches.map((n) => n.name);

    expect(names.slice(0, 3)).toEqual(["Status", "Status", "Status"]);
    expect(names.indexOf("DefaultStatusType")).toBeGreaterThan(2);
    expect(names).toContain("defaultStatus");
  });

  it("filters by kind and reports the total beyond the limit", () => {
    const r = find(index, { query: "s", kind: "interface", limit: 2 });

    expect(r.matches).toHaveLength(2);
    expect(r.matches.every((n) => n.kind === "interface")).toBe(true);
    expect(r.total).toBeGreaterThan(2);
  });
});

suite("neighbors", () => {
  it("finds what uses a declaration", () => {
    const sub = neighbors(index, { id: ANIMAL, direction: "in" });

    expect(sub.edges.map((e) => `${e.source}|${e.kind}|${e.label ?? ""}`)).toEqual([
      `${DOG}|implements|`,
      `${DOG}|param|pet`,
    ]);
    expect(sub.nodes.map((n) => n.id)).toEqual([ANIMAL, DOG]);
  });

  it("filters by edge kind", () => {
    const sub = neighbors(index, { id: DOG, direction: "out", kinds: ["implements"] });

    expect(sub.edges.map((e) => e.target)).toEqual([ANIMAL, "fixtures/classes/animal.ts#Walkable"]);
  });

  it("follows several hops", () => {
    const usesB = "fixtures/modules/uses.ts#UsesB";
    const one = neighbors(index, { id: usesB, direction: "out" });
    const two = neighbors(index, { id: usesB, direction: "out", depth: 2 });

    expect(one.edges).toHaveLength(2);
    expect(two.edges).toHaveLength(3);
    expect(two.edges[2]).toMatchObject({
      source: "fixtures/modules/a.ts#NS.Inner",
      target: "fixtures/modules/a.ts#A",
    });
  });

  it("truncates to the limit and reports how much was left out", () => {
    const all = neighbors(index, { id: DOG });
    const sub = neighbors(index, { id: DOG, limit: 2 });

    expect(sub.edges).toEqual(all.edges.slice(0, 2));
    expect(sub).toMatchObject({ truncated: true, omitted: all.edges.length - 2 });
  });
});

suite("path", () => {
  const OWNER = "fixtures/classes/owner.ts#Owner";

  it("finds the shortest chain", () => {
    const edges = findPath(index, { from: OWNER, to: ANIMAL });

    expect(edges?.map((e) => [e.source, e.target])).toEqual([
      [OWNER, DOG],
      [DOG, ANIMAL],
    ]);
  });

  it("can walk edges backwards unless directed", () => {
    expect(findPath(index, { from: ANIMAL, to: OWNER })).toHaveLength(2);
    expect(findPath(index, { from: ANIMAL, to: OWNER, directed: true })).toBeNull();
  });

  it("returns null for unconnected declarations", () => {
    expect(findPath(index, { from: DOG, to: "fixtures/basic/types.ts#Address" })).toBeNull();
  });
});

suite("formatSubgraph", () => {
  it("renders a compact text view", () => {
    const sub = neighbors(index, { id: ANIMAL, direction: "in" });

    expect(formatSubgraph(sub, index)).toBe(
      [
        `[interface] Animal  id=${ANIMAL}  fixtures/classes/animal.ts:1-4`,
        "  export interface Animal",
        `[class] Dog  id=${DOG}  fixtures/classes/dog.ts:5-21`,
        "  export class Dog extends Base implements Animal, Walkable",
        "",
        "Dog --implements--> Animal  (line 5)",
        "Dog --param:pet--> Animal  (line 17)",
      ].join("\n"),
    );
  });

  it("falls back to ids when names collide and notes truncation", () => {
    const id = "fixtures/edge-cases/merging.ts#Status@variable";
    const full = formatSubgraph(neighbors(index, { id }), index);

    expect(full).toContain(`fixtures/edge-cases/merging.ts#Status --typeof--> ${id}  (line 19)`);
    expect(full).toContain(`J --typeof--> ${id}  (line 3)`);
    expect(full).not.toContain("more edges");

    // Only names that collide within the output need ids.
    const truncated = formatSubgraph(neighbors(index, { id, limit: 1 }), index);

    expect(truncated).toContain("J --typeof--> Status  (line 3)");
    expect(truncated).toContain("… 1 more edges");
  });
});
