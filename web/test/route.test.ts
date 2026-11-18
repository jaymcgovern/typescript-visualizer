import { describe, expect, it } from "vitest";
import { ENDPOINT_TOLERANCE, fitRoute, midpoint, roundedPath } from "../src/layout/route";

const route = {
  points: [
    { x: 0, y: 0 },
    { x: 0, y: 50 },
    { x: 100, y: 50 },
    { x: 100, y: 100 },
  ],
};

describe("fitRoute", () => {
  it("snaps the ends to React Flow's handle positions", () => {
    expect(fitRoute(route, { x: 0, y: 3 }, { x: 100, y: 97 })).toEqual([
      { x: 0, y: 3 },
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      { x: 100, y: 97 },
    ]);
  });

  it("gives up once a node has moved away from its route", () => {
    expect(fitRoute(route, { x: 0, y: ENDPOINT_TOLERANCE + 1 }, { x: 100, y: 100 })).toBeUndefined();
    expect(fitRoute(route, { x: 0, y: 0 }, { x: 140, y: 100 })).toBeUndefined();
    expect(fitRoute(undefined, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeUndefined();
  });
});

describe("roundedPath", () => {
  it("draws straight lines without curves", () => {
    expect(
      roundedPath([
        { x: 0, y: 0 },
        { x: 0, y: 10 },
      ]),
    ).toBe("M 0 0 L 0 10");
  });

  it("rounds corners, never by more than half a segment", () => {
    expect(roundedPath(route.points, 8)).toBe("M 0 0 L 0 42 Q 0 50 8 50 L 92 50 Q 100 50 100 58 L 100 100");
    expect(
      roundedPath(
        [
          { x: 0, y: 0 },
          { x: 0, y: 4 },
          { x: 50, y: 4 },
        ],
        8,
      ),
    ).toBe("M 0 0 L 0 2 Q 0 4 2 4 L 50 4");
  });

  it("handles empty input", () => {
    expect(roundedPath([])).toBe("");
  });
});

describe("midpoint", () => {
  it("finds the point halfway along the polyline", () => {
    expect(midpoint(route.points)).toEqual({ x: 50, y: 50 });
    expect(midpoint([{ x: 3, y: 4 }])).toEqual({ x: 3, y: 4 });
  });
});
