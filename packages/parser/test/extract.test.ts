import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractGraph } from "../src/extract.ts";
import type { EdgeKind, Graph } from "@tsviz/graph";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

function extract(dir: string, includeExternal = false): Graph {
  return extractGraph({
    files: [`fixtures/${dir}/**/*.ts`],
    root: repoRoot,
    includeExternal,
  });
}

function hasEdge(g: Graph, source: string, target: string, kind: EdgeKind, label?: string): boolean {
  return g.edges.some((e) => e.source === source && e.target === target && e.kind === kind && e.label === label);
}

function node(g: Graph, id: string) {
  const n = g.nodes.find((x) => x.id === id);

  if (!n) throw new Error(`missing node ${id}`);

  return n;
}

describe("basic", () => {
  const g = extract("basic");
  const F = "fixtures/basic/types.ts";

  it("emits declaration nodes with kinds and export flags", () => {
    expect(node(g, `${F}#User`)).toMatchObject({ name: "User", kind: "interface", exported: true, line: 10 });
    expect(node(g, `${F}#UserId`).kind).toBe("type");
  });

  it("links extends, property and self-referencing edges", () => {
    expect(hasEdge(g, `${F}#User`, `${F}#Named`, "extends")).toBe(true);
    expect(hasEdge(g, `${F}#User`, `${F}#Address`, "property", "address")).toBe(true);
    expect(hasEdge(g, `${F}#User`, `${F}#User`, "property", "manager")).toBe(true);
  });

  it("links union members from a type alias", () => {
    expect(hasEdge(g, `${F}#Maybe`, `${F}#User`, "union")).toBe(true);
  });

  it("links type arguments of a lib type without emitting the lib type", () => {
    expect(hasEdge(g, `${F}#Registry`, `${F}#User`, "typeArg", "users")).toBe(true);
    expect(g.nodes.every((n) => n.kind !== "external")).toBe(true);
  });

  it("includes external placeholders when requested", () => {
    const gx = extract("basic", true);

    expect(node(gx, "external:lib#Map")).toMatchObject({ kind: "external", origin: "lib" });
    expect(hasEdge(gx, `${F}#Registry`, "external:lib#Map", "property", "users")).toBe(true);
  });
});

describe("classes", () => {
  const g = extract("classes");
  const DOG = "fixtures/classes/dog.ts#Dog";

  it("links extends and implements", () => {
    expect(hasEdge(g, DOG, "fixtures/classes/base.ts#Base", "extends")).toBe(true);
    expect(hasEdge(g, DOG, "fixtures/classes/animal.ts#Animal", "implements")).toBe(true);
    expect(hasEdge(g, DOG, "fixtures/classes/animal.ts#Walkable", "implements")).toBe(true);
  });

  it("links property types and method params/returns", () => {
    expect(hasEdge(g, DOG, "fixtures/classes/owner.ts#Owner", "property", "owner")).toBe(true);
    expect(hasEdge(g, DOG, "fixtures/classes/animal.ts#Animal", "param", "pet")).toBe(true);
    expect(hasEdge(g, DOG, DOG, "returns", "adopt")).toBe(true);
  });

  it("resolves array element types across files", () => {
    expect(hasEdge(g, "fixtures/classes/owner.ts#Owner", DOG, "property", "dogs")).toBe(true);
  });

  it("records class members", () => {
    const names = node(g, DOG).members?.map((m) => `${m.kind}:${m.name}`);

    expect(names).toEqual(expect.arrayContaining(["property:name", "method:speak", "method:adopt"]));
  });
});

describe("generics", () => {
  const g = extract("generics");
  const BOX = "fixtures/generics/box.ts";

  it("records type parameters and constraint/default references", () => {
    expect(node(g, `${BOX}#Pair`).typeParams).toEqual(["A", "B"]);
    expect(hasEdge(g, `${BOX}#Pair`, `${BOX}#Keyed`, "references", "B")).toBe(true);
    expect(hasEdge(g, `${BOX}#unwrap`, `${BOX}#Keyed`, "references", "T")).toBe(true);
  });

  it("links generic instantiations of members and parameters", () => {
    expect(hasEdge(g, `${BOX}#Repo`, `${BOX}#Box`, "property", "items")).toBe(true);
    expect(hasEdge(g, `${BOX}#Repo`, `${BOX}#Box`, "returns", "find")).toBe(true);
    expect(hasEdge(g, `${BOX}#unwrap`, `${BOX}#Box`, "param", "b")).toBe(true);
  });

  it("drops references to local type parameters", () => {
    expect(g.edges.some((e) => e.target.endsWith("#T") || e.target.endsWith("#A"))).toBe(false);
  });

  it("links alias type arguments across files", () => {
    const USE = "fixtures/generics/use.ts#Boxed";

    expect(hasEdge(g, USE, `${BOX}#Box`, "references")).toBe(true);
    expect(hasEdge(g, USE, `${BOX}#Keyed`, "typeArg")).toBe(true);
  });
});

describe("modules", () => {
  const g = extract("modules");

  it("resolves re-export aliases to the original declaration", () => {
    expect(hasEdge(g, "fixtures/modules/uses.ts#UsesB", "fixtures/modules/a.ts#A", "property", "b")).toBe(true);
    expect(g.nodes.some((n) => n.file === "fixtures/modules/reexport.ts")).toBe(false);
  });

  it("names namespace members with their qualified path", () => {
    const inner = node(g, "fixtures/modules/a.ts#NS.Inner");

    expect(inner).toMatchObject({ name: "Inner", kind: "interface" });
    expect(hasEdge(g, "fixtures/modules/a.ts#NS.Inner", "fixtures/modules/a.ts#A", "property", "a")).toBe(true);
    expect(hasEdge(g, "fixtures/modules/uses.ts#UsesB", "fixtures/modules/a.ts#NS.Inner", "property", "inner")).toBe(
      true,
    );
  });
});

describe("unions", () => {
  const g = extract("unions");
  const S = "fixtures/unions/shapes.ts";

  it("links union and intersection members", () => {
    expect(hasEdge(g, `${S}#Shape`, `${S}#Circle`, "union")).toBe(true);
    expect(hasEdge(g, `${S}#Shape`, `${S}#Square`, "union")).toBe(true);
    expect(hasEdge(g, `${S}#Drawable`, `${S}#Shape`, "intersection")).toBe(true);
    expect(hasEdge(g, `${S}#Drawable`, `${S}#Color`, "intersection")).toBe(true);
  });

  it("links conditional type branches", () => {
    const C = "fixtures/unions/conditional.ts#Cond";

    expect(hasEdge(g, C, `${S}#Circle`, "references")).toBe(true);
    expect(hasEdge(g, C, `${S}#Square`, "references")).toBe(true);
  });
});

describe("enums and functions", () => {
  const g = extract("enums-fns");
  const F = "fixtures/enums-fns/status.ts";

  it("emits enum members and variable/function kinds", () => {
    expect(node(g, `${F}#Status`).members?.map((m) => m.name)).toEqual(["Active", "Inactive"]);
    expect(node(g, `${F}#defaultStatus`).kind).toBe("variable");
    expect(node(g, `${F}#describe`).kind).toBe("function");
  });

  it("links property, param and variable type references to enums", () => {
    expect(hasEdge(g, `${F}#Account`, `${F}#Status`, "property", "status")).toBe(true);
    expect(hasEdge(g, `${F}#describe`, `${F}#Status`, "param", "s")).toBe(true);
    expect(hasEdge(g, `${F}#defaultStatus`, `${F}#Status`, "references")).toBe(true);
  });

  it("links typeof queries", () => {
    expect(hasEdge(g, `${F}#DefaultStatusType`, `${F}#defaultStatus`, "typeof")).toBe(true);
  });
});

describe("edge cases", () => {
  const g = extract("edge-cases");
  const E = "fixtures/edge-cases";
  const A = `${E}/merging.ts#A`;
  const B = `${E}/merging.ts#B`;

  it("merges an interface and class of the same name into one class node", () => {
    const foo = node(g, `${E}/merging.ts#Foo`);

    expect(foo.kind).toBe("class");
    expect(foo.members?.map((m) => m.name)).toEqual(["extra", "base"]);
    expect(hasEdge(g, foo.id, A, "property", "extra")).toBe(true);
    expect(hasEdge(g, foo.id, B, "property", "base")).toBe(true);
    expect(g.nodes.filter((n) => n.id.startsWith(`${E}/merging.ts#Foo`))).toHaveLength(1);
  });

  it("keeps a const and a type with the same name as separate nodes", () => {
    const type = `${E}/merging.ts#Status`;
    const value = `${E}/merging.ts#Status@variable`;

    expect(node(g, type).kind).toBe("type");
    expect(node(g, value).kind).toBe("variable");
    expect(hasEdge(g, type, value, "typeof")).toBe(true);
    expect(g.edges.some((e) => e.source === type && e.target === type)).toBe(false);
  });

  it("takes function and method edges from overload signatures, not the implementation", () => {
    const f = `${E}/overloads.ts#f`;

    expect(hasEdge(g, f, A, "param", "a")).toBe(true);
    expect(hasEdge(g, f, A, "returns", "f")).toBe(true);
    expect(hasEdge(g, f, B, "param", "b")).toBe(true);
    expect(hasEdge(g, f, B, "returns", "f")).toBe(true);
    expect(g.edges.some((e) => e.source === f && e.label === "x")).toBe(false);
    expect(node(g, f).line).toBe(3);

    const svc = `${E}/overloads.ts#Svc`;

    expect(hasEdge(g, svc, A, "param", "a")).toBe(true);
    expect(hasEdge(g, svc, B, "returns", "run")).toBe(true);
    expect(node(g, svc).members).toEqual([
      { name: "run", kind: "method", type: "(a: A): A" },
      { name: "run", kind: "method", type: "(b: B): B" },
    ]);
  });

  it("covers index, call and construct signatures", () => {
    const dict = `${E}/signatures.ts#Dict`;

    expect(node(g, dict).members?.map((m) => `${m.kind}:${m.name}`)).toEqual([
      "index:[k: string]",
      "call:call",
      "construct:new",
    ]);
    expect(hasEdge(g, dict, A, "property", "[k: string]")).toBe(true);
    expect(hasEdge(g, dict, B, "param", "q")).toBe(true);
    expect(hasEdge(g, dict, A, "returns", "call")).toBe(true);
    expect(hasEdge(g, dict, dict, "returns", "new")).toBe(true);
  });

  it("resolves import() types", () => {
    expect(hasEdge(g, `${E}/import-type.ts#I`, B, "references")).toBe(true);
    expect(hasEdge(g, `${E}/import-type.ts#J`, `${E}/merging.ts#Status@variable`, "typeof")).toBe(true);
  });

  it("treats constructor parameter properties as members", () => {
    const p = `${E}/param-props.ts#P`;

    expect(node(g, p).members).toEqual([{ name: "owner", kind: "property", type: "A" }]);
    expect(hasEdge(g, p, A, "property", "owner")).toBe(true);
    expect(hasEdge(g, p, A, "param", "owner")).toBe(false);
    expect(hasEdge(g, p, B, "param", "plain")).toBe(true);
  });

  it("identifies externals by resolved symbol and origin", () => {
    const gx = extract("edge-cases", true);
    const uses = `${E}/externals.ts#UsesExternal`;
    const project = "external:ts-morph#Project";

    expect(node(gx, project)).toMatchObject({ name: "Project", origin: "ts-morph" });
    expect(hasEdge(gx, uses, project, "property", "aliased")).toBe(true);
    expect(hasEdge(gx, uses, project, "property", "direct")).toBe(true);
    expect(hasEdge(gx, uses, "external:lib#Map", "property", "map")).toBe(true);

    const externalIds = gx.nodes.filter((n) => n.kind === "external").map((n) => n.id);

    expect(externalIds.some((id) => id.endsWith("#P") || id.includes("("))).toBe(false);
  });
});

describe("options", () => {
  it.each(["!fixtures/edge-cases/excluded.ts", "!**/excluded.ts"])("excludes files with negated glob %s", (neg) => {
    const g = extractGraph({ files: ["fixtures/edge-cases/**/*.ts", neg], root: repoRoot });

    expect(g.nodes.some((n) => n.name === "Excluded")).toBe(false);
    expect(g.nodes.some((n) => n.name === "Dict")).toBe(true);
  });

  it("resolves the tsconfig path against the current directory, not root", () => {
    const g = extractGraph({
      tsConfigFilePath: path.relative(process.cwd(), path.join(import.meta.dirname, "../tsconfig.json")),
      root: path.join(repoRoot, "fixtures"),
      files: ["basic/*.ts"],
    });

    expect(g.nodes.some((n) => n.id === "basic/types.ts#User")).toBe(true);
  });
});

describe("agent metadata", () => {
  const g = extract("agent");
  const D = "fixtures/agent/documented.ts";

  it("records line ranges, signatures and docs", () => {
    expect(node(g, `${D}#Person`)).toMatchObject({
      line: 10,
      endLine: 13,
      signature: "export class Person implements Named",
      doc: "A person who can own pets.",
    });

    expect(node(g, `${D}#Pet`)).toMatchObject({
      signature: "export interface Pet extends Named",
      doc: "A pet that can be adopted.",
    });

    expect(node(g, `${D}#lookup`)).toMatchObject({
      line: 21,
      endLine: 25,
      signature: "export function lookup(name: string): Pet\nexport function lookup(name: string, owner: Person): Pet",
      doc: "Looks a pet up by name.",
    });

    expect(node(g, `${D}#defaultPet`)).toMatchObject({
      signature: "export const defaultPet: Pet",
      doc: "The default pet.",
    });

    expect(node(g, "fixtures/agent/unresolved.ts#Broken").signature).toBe("export type Broken = Missing");
  });

  it("records the line of each reference", () => {
    const at = (source: string, target: string, kind: EdgeKind) =>
      g.edges.find((e) => e.source === source && e.target === target && e.kind === kind)?.line;

    expect(at(`${D}#Person`, `${D}#Named`, "implements")).toBe(10);
    expect(at(`${D}#Person`, `${D}#Pet`, "property")).toBe(12);
    expect(at(`${D}#Pet`, `${D}#Person`, "property")).toBe(17);
  });

  it("describes what was analyzed and what was dropped", () => {
    expect(g.meta).toEqual({
      root: repoRoot,
      files: ["fixtures/agent/documented.ts", "fixtures/agent/unresolved.ts"],
      includeExternal: false,
      dropped: {
        external: 0,
        unresolved: 1,
        samples: [{ from: "fixtures/agent/unresolved.ts#Broken", name: "Missing", line: 2 }],
        names: [
          {
            reason: "unresolved",
            name: "Missing",
            count: 1,
            sites: [{ from: "fixtures/agent/unresolved.ts#Broken", line: 2 }],
          },
        ],
      },
    });
  });

  it("lists every dropped reference by name, with where external ones live", () => {
    const { dropped } = extract("edge-cases").meta;
    const X = "fixtures/edge-cases/externals.ts";

    expect(dropped.names).toEqual(
      expect.arrayContaining([
        {
          reason: "external",
          name: "Project",
          origin: "ts-morph",
          count: 1,
          sites: [{ from: `${X}#UsesExternal`, line: 7 }],
        },
        { reason: "external", name: "Map", origin: "lib", count: 1, sites: [{ from: `${X}#UsesExternal`, line: 8 }] },
        { reason: "unresolved", name: "mixin(Object)", count: 1, sites: [{ from: `${X}#Mixed`, line: 14 }] },
      ]),
    );
    expect(dropped.names!.reduce((sum, n) => sum + n.count, 0)).toBe(dropped.external + dropped.unresolved);
  });

  it("lists no external references when they are drawn", () => {
    expect(extract("edge-cases", true).meta.dropped.names!.filter((n) => n.reason === "external")).toEqual([]);
  });

  it("counts omitted external references only when they are omitted", () => {
    expect(extract("basic").meta.dropped.external).toBe(1);
    expect(extract("basic", true).meta.dropped.external).toBe(0);
  });

  it("reports unresolvable heritage expressions", () => {
    const samples = extract("edge-cases").meta.dropped.samples;

    expect(samples).toContainEqual({
      from: "fixtures/edge-cases/externals.ts#Mixed",
      name: "mixin(Object)",
      line: 14,
    });
  });
});

describe("output", () => {
  it("is deterministic across runs and sorted", () => {
    const a = JSON.stringify(extract("classes"));
    const b = JSON.stringify(extract("classes"));

    expect(a).toBe(b);

    const g = extract("classes");
    const ids = g.nodes.map((n) => n.id);

    expect(ids).toEqual([...ids].sort());
  });
});

describe("fixtures/fixtures.graph.json", () => {
  // The UI tests and the demo app's sample read this file, so it must match what the parser produces.
  // Regenerate with `npx vitest run --project parser -u`.
  it("is up to date", async () => {
    const g = extractGraph({ files: ["fixtures/**/*.ts"], root: repoRoot });
    // `meta.root` is absolute; keep the committed file machine-independent.
    const json = `${JSON.stringify({ ...g, meta: { ...g.meta, root: "." } }, null, 2)}\n`;

    await expect(json).toMatchFileSnapshot(path.join(repoRoot, "fixtures/fixtures.graph.json"));
  });
});
