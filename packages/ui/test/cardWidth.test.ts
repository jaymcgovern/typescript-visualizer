import { describe, expect, it } from "vitest";
import { canWiden, widthRange } from "../src/graph/cardWidth.ts";

const fits = { scrollWidth: 40, clientWidth: 40 };

describe("widthRange", () => {
  it("cannot widen a card whose rows all fit", () => {
    const range = widthRange(200, [[fits, fits], [fits]], false);

    expect(range).toEqual({ min: 200, max: 200 });
    expect(canWiden(range)).toBe(false);
  });

  it("widens by what the most cut-off row lacks, summed over its parts, plus a pixel per cut-off part", () => {
    const range = widthRange(
      320,
      [
        [fits, { scrollWidth: 100, clientWidth: 60 }],
        [
          { scrollWidth: 50, clientWidth: 30 },
          { scrollWidth: 90, clientWidth: 60 },
        ],
      ],
      false,
    );

    expect(range).toEqual({ min: 320, max: 372 });
    expect(canWiden(range)).toBe(true);
  });

  it("keeps the original width as the minimum once resized", () => {
    const range = widthRange(350, [[{ scrollWidth: 80, clientWidth: 60 }]], true, { min: 320, max: 370 });

    expect(range).toEqual({ min: 320, max: 371 });
  });

  it("has nothing to widen without rows", () => {
    expect(widthRange(180, [], false)).toEqual({ min: 180, max: 180 });
    expect(canWiden(undefined)).toBe(false);
  });
});
