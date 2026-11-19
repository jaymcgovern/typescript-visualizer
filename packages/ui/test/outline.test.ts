import type { GraphNode } from "@tsviz/graph";
import { describe, expect, it } from "vitest";
import { matchEntry, outlineEntries, outlineGroups, shortPath } from "../src/graph/outline.ts";

const nodes: GraphNode[] = [
  {
    id: "src/pets/dog.ts#Dog",
    name: "Dog",
    kind: "class",
    file: "src/pets/dog.ts",
    exported: true,
    members: [
      { name: "owner", kind: "property" },
      { name: "speak", kind: "method" },
    ],
  },
  { id: "src/pets/animal.ts#Animal", name: "Animal", kind: "interface", file: "src/pets/animal.ts", exported: true },
  { id: "src/people/owner.ts#Owner", name: "Owner", kind: "class", file: "src/people/owner.ts", exported: true },
  { id: "src/pets/dog.ts#Hotdog", name: "Hotdog", kind: "type", file: "src/pets/dog.ts", exported: false },
  { id: "src/geo.ts#Shapes.Circle", name: "Circle", kind: "interface", file: "src/geo.ts", exported: true },
  { id: "src/fn.ts#lookup@fn", name: "lookup", kind: "function", file: "src/fn.ts", exported: true },
  { id: "ext:react#FC", name: "FC", kind: "external", origin: "react", exported: true },
];
const entries = outlineEntries(nodes);
const names = (query: string) => outlineGroups(entries, query).map((g) => [g.kind, g.items.map((i) => i.name)]);

describe("outlineEntries", () => {
  it("uses qualified names, the file (or origin), and member names", () => {
    const byId = new Map(entries.map((e) => [e.id, e]));

    expect(byId.get("src/geo.ts#Shapes.Circle")).toMatchObject({ name: "Shapes.Circle", where: "src/geo.ts" });
    expect(byId.get("src/fn.ts#lookup@fn")?.name).toBe("lookup");
    expect(byId.get("ext:react#FC")?.where).toBe("react");
    expect(byId.get("src/pets/dog.ts#Dog")?.members).toEqual(["owner", "speak"]);
  });
});

describe("outlineGroups", () => {
  it("lists everything by kind in legend order, alphabetically, with empty kinds left out", () => {
    expect(names("")).toEqual([
      ["interface", ["Animal", "Shapes.Circle"]],
      ["class", ["Dog", "Owner"]],
      ["type", ["Hotdog"]],
      ["function", ["lookup"]],
      ["external", ["FC"]],
    ]);
  });

  it("puts names starting with the query first, then other name matches, then file and member matches", () => {
    // Dog: name starts with "dog"; Hotdog: name contains it; none match only by file here.
    expect(names("dog")).toEqual([
      ["class", ["Dog"]],
      ["type", ["Hotdog"]],
    ]);
    // Owner's name matches; Dog only has an `owner` member, so it comes after.
    expect(names("owner")).toEqual([["class", ["Owner", "Dog"]]]);
  });

  it("counts every declaration of a kind, not just the matches", () => {
    const [classes] = outlineGroups(entries, "owner");

    expect(classes).toMatchObject({ kind: "class", total: 2 });
  });

  it("matches files and requires every term", () => {
    expect(names("pets/")).toEqual([
      ["interface", ["Animal"]],
      ["class", ["Dog"]],
      ["type", ["Hotdog"]],
    ]);
    expect(names("pets speak")).toEqual([["class", ["Dog"]]]);
    expect(names("people speak")).toEqual([]);
  });
});

describe("matchEntry", () => {
  const dog = entries.find((e) => e.name === "Dog")!;

  it("says why an entry matches, ignoring case", () => {
    expect(matchEntry(dog, "DO")).toEqual({ via: "name" });
    expect(matchEntry(dog, "pets/dog")).toEqual({ via: "where" });
    expect(matchEntry(dog, "Speak")).toEqual({ via: "member", member: "speak" });
    expect(matchEntry(dog, "dog speak")).toEqual({ via: "member", member: "speak" });
    expect(matchEntry(dog, "cat")).toBeUndefined();
  });
});

describe("shortPath", () => {
  it("keeps the last two segments", () => {
    expect(shortPath("src/pets/dog.ts")).toBe("pets/dog.ts");
    expect(shortPath("dog.ts")).toBe("dog.ts");
  });
});
