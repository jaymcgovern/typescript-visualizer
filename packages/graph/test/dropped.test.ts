import { describe, expect, it } from "vitest";
import { groupDropped, MAX_DROP_SITES } from "../src/index.ts";

describe("groupDropped", () => {
  it("groups by reason, name and origin, most frequent first, keeping the first sites", () => {
    const promise = Array.from({ length: MAX_DROP_SITES + 2 }, (_, i) => ({
      reason: "external" as const,
      from: `a.ts#F${9 - i}`,
      name: "Promise",
      line: i + 1,
      origin: "lib",
    }));
    const names = groupDropped([
      { reason: "unresolved", from: "a.ts#X", name: "Missing", line: 1 },
      { reason: "external", from: "a.ts#X", name: "Map", line: 2, origin: "lib" },
      ...promise,
      { reason: "external", from: "a.ts#X", name: "Promise", line: 3, origin: "my-promises" },
    ]);

    expect(names.map((n) => [n.reason, n.name, n.origin, n.count])).toEqual([
      ["external", "Promise", "lib", MAX_DROP_SITES + 2],
      ["external", "Map", "lib", 1],
      ["external", "Promise", "my-promises", 1],
      ["unresolved", "Missing", undefined, 1],
    ]);
    expect(names[0]!.sites).toEqual([
      { from: "a.ts#F5", line: 5 },
      { from: "a.ts#F6", line: 4 },
      { from: "a.ts#F7", line: 3 },
    ]);
    expect(names[3]).not.toHaveProperty("origin");
  });
});
