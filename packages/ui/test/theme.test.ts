import { readFileSync } from "node:fs";
import { NODE_KINDS } from "@tsviz/graph";
import { describe, expect, it } from "vitest";
import { REL_STYLES } from "../src/graph/relationships.ts";
import { THEME_TOKENS, themeStyle } from "../src/theme.ts";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const rootBlock = css.slice(css.indexOf(".tsviz {"), css.indexOf("}", css.indexOf(".tsviz {")));
const declaredOnRoot = new Set(rootBlock.match(/--tsviz-[\w-]+(?=:)/g));
const declaredAnywhere = new Set(css.match(/--tsviz-[\w-]+(?=:)/g));
const families = [...new Set(Object.values(REL_STYLES).map((s) => s.family))];
// Set inline by components rather than in the stylesheet.
const SET_FROM_TSX = ["--tsviz-chars"];

const capitalize = (s: string) => s[0]!.toUpperCase() + s.slice(1);

describe("styles.css and the theme stay in sync", () => {
  it("declares every theme token on the .tsviz root, and nothing else there", () => {
    expect([...declaredOnRoot].toSorted()).toEqual(Object.values(THEME_TOKENS).toSorted());
  });

  it("defines every custom property it uses", () => {
    const used = new Set(css.match(/(?<=var\()--tsviz-[\w-]+/g));
    const undefinedProps = [...used].filter((p) => !declaredAnywhere.has(p) && !SET_FROM_TSX.includes(p));

    expect(undefinedProps).toEqual([]);
  });

  it.each(NODE_KINDS)("styles node kind %s", (kind) => {
    expect(THEME_TOKENS).toHaveProperty(`kind${capitalize(kind)}`);
    expect(css).toContain(`.tsviz .decl--${kind} {`);
  });

  it.each(families)("styles relationship family %s", (family) => {
    expect(THEME_TOKENS).toHaveProperty(`rel${capitalize(family)}`);
    expect(css).toContain(`.tsviz .rel-family--${family} {`);
  });

  it("scopes every rule under .tsviz", () => {
    const selectors = css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/@(media|container)[^{]*\{/g, "")
      .match(/[^{}]+(?=\{)/g)!
      // Commas outside parentheses, so `:not(.a, .b)` stays whole.
      .flatMap((s) => s.split(/,(?![^(]*\))/))
      .map((s) => s.trim())
      .filter(Boolean);

    expect(selectors.filter((s) => !s.startsWith(".tsviz") && !s.startsWith(":where(.tsviz)"))).toEqual([]);
  });
});

describe("themeStyle", () => {
  it("maps theme keys to custom properties", () => {
    expect(themeStyle({ kindClass: "hotpink", fontSans: "Inter" })).toEqual({
      "--tsviz-kind-class": "hotpink",
      "--tsviz-font-sans": "Inter",
    });
  });

  it("ignores unknown keys and undefined values", () => {
    expect(themeStyle({ bg: undefined, nope: "x" } as never)).toEqual({});
    expect(themeStyle(undefined)).toBeUndefined();
  });
});
