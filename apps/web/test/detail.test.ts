import { describe, expect, it } from "vitest";
import { DETAIL_MIN_ZOOM, detailAt } from "../src/graph/detail";

describe("detailAt", () => {
  it.each([
    [2, "full"],
    [1, "full"],
    [DETAIL_MIN_ZOOM.full, "full"],
    [DETAIL_MIN_ZOOM.full - 0.01, "outline"],
    [DETAIL_MIN_ZOOM.outline, "outline"],
    [DETAIL_MIN_ZOOM.outline - 0.01, "overview"],
    [0.05, "overview"],
  ])("zoom %f → %s", (zoom, detail) => {
    expect(detailAt(zoom)).toBe(detail);
  });
});
