import { describe, expect, it } from "vitest";
import { splitRefs, type Ref } from "../src/graph/refs";

const ref = (name: string, kind: Ref["kind"] = "interface"): Ref => ({ id: `a.ts#${name}`, name, kind });
const refs = [ref("Animal"), ref("Dog", "class"), ref("Status", "enum"), ref("User")];
/** Linked names in brackets. */
const show = (text: string, rs = refs) =>
  splitRefs(text, rs)
    .map((p) => (typeof p === "string" ? p : `[${p.text}]`))
    .join("");

describe("splitRefs", () => {
  it.each([
    ["(pet: Animal): Dog", "(pet: [Animal]): [Dog]"],
    [": Map<string, User>", ": Map<string, [User]>"],
    ["extends Base implements Animal, Walkable", "extends Base implements [Animal], Walkable"],
    ["Dogs | DogX | Dog[]", "Dogs | DogX | [Dog][]"],
    ["T extends Dog ? Animal : never", "T extends [Dog] ? [Animal] : never"],
    ["NS.User", "NS.[User]"],
    ['"Dog" | Dog', '"Dog" | [Dog]'],
    ["'it\\'s Dog' | `Dog`", "'it\\'s Dog' | `Dog`"],
  ])("%s", (text, expected) => {
    expect(show(text)).toBe(expected);
  });

  it("does not link parameter and property names", () => {
    expect(show("(Status: Status, User?: User)")).toBe("(Status: [Status], User?: [User])");
  });

  it("keeps the text intact", () => {
    const text = "(a: Animal, b: Dog): Promise<User>";

    expect(
      splitRefs(text, refs)
        .map((p) => (typeof p === "string" ? p : p.text))
        .join(""),
    ).toBe(text);
  });

  it("returns the text alone when nothing links", () => {
    expect(splitRefs(": string", refs)).toEqual([": string"]);
    expect(splitRefs(": Dog", [])).toEqual([": Dog"]);
  });

  it("links a name shared by two refs to the first", () => {
    const parts = splitRefs(": Dog", [ref("Dog", "class"), { ...ref("Dog", "variable"), id: "b.ts#Dog" }]);

    expect(parts).toEqual([": ", { text: "Dog", ref: ref("Dog", "class") }]);
  });
});
