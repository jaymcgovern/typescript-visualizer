import type { EdgeRoute, XY } from "./elkGraph.ts";

/**
 * React Flow places edge endpoints a few pixels off the node border (on the
 * handle's outer edge); anything further means the node moved since layout.
 */
export const ENDPOINT_TOLERANCE = 8;

/**
 * The route's polyline with its ends snapped to React Flow's endpoints, or
 * `undefined` when the route no longer fits (a node was dragged).
 */
export function fitRoute(route: EdgeRoute | undefined, source: XY, target: XY): XY[] | undefined {
  if (!route) return undefined;

  const first = route.points[0];
  const last = route.points.at(-1);

  if (!first || !last || distance(first, source) > ENDPOINT_TOLERANCE || distance(last, target) > ENDPOINT_TOLERANCE) {
    return undefined;
  }

  return [source, ...route.points.slice(1, -1), target];
}

/** SVG path through `points` with corners rounded by up to `radius`. */
export function roundedPath(points: XY[], radius = 8): string {
  const [first, ...rest] = points;

  if (!first) return "";

  let d = `M ${first.x} ${first.y}`;

  for (let i = 0; i < rest.length; i++) {
    const corner = rest[i]!;
    const next = rest[i + 1];

    if (!next) {
      d += ` L ${corner.x} ${corner.y}`;
      break;
    }

    const prev = i === 0 ? first : rest[i - 1]!;
    // Never round more than half of either adjoining segment.
    const r = Math.min(radius, distance(prev, corner) / 2, distance(corner, next) / 2);
    const a = towards(corner, prev, r);
    const b = towards(corner, next, r);

    d += ` L ${a.x} ${a.y} Q ${corner.x} ${corner.y} ${b.x} ${b.y}`;
  }

  return d;
}

/** The point halfway along the polyline, for labels without an ELK position. */
export function midpoint(points: XY[]): XY {
  const lengths = points.slice(1).map((p, i) => distance(points[i]!, p));
  let remaining = lengths.reduce((a, b) => a + b, 0) / 2;

  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i]!;

    if (remaining <= len && len > 0) return towards(points[i]!, points[i + 1]!, remaining);
    remaining -= len;
  }

  return points[0] ?? { x: 0, y: 0 };
}

function distance(a: XY, b: XY): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** The point `by` pixels from `from` in the direction of `to`. */
function towards(from: XY, to: XY, by: number): XY {
  const d = distance(from, to);

  if (d === 0) return from;

  return { x: from.x + ((to.x - from.x) * by) / d, y: from.y + ((to.y - from.y) * by) / d };
}
