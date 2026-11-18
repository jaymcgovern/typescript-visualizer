import type { ElkExtendedEdge, ElkNode, ElkPoint, LayoutOptions } from "elkjs/lib/elk-api.js";

export type Direction = "DOWN" | "RIGHT";

export interface XY {
  x: number;
  y: number;
}

export interface Box extends XY {
  width: number;
  height: number;
}

export interface LayoutInput {
  nodes: {
    id: string;
    width: number;
    height: number;
    /** Extra output ports on the east side (member rows), relative to the node's top-left corner. */
    ports?: { id: string; x: number; y: number }[];
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
    label?: string;
    /** One of the source node's extra `ports`; the main output port when absent. */
    sourcePort?: string;
  }[];
}

export interface EdgeRoute {
  /** Start, bend points and end, in flow coordinates. */
  points: XY[];
  /** Where ELK placed the label (top-left corner and size). */
  label?: Box;
}

export interface LayoutResult {
  direction: Direction;
  positions: Map<string, XY>;
  routes: Map<string, EdgeRoute>;
}

/**
 * Layered, orthogonally routed layout. Dependencies flow along `direction`:
 * a declaration sits before (above / left of) the declarations it uses.
 */
export function layoutOptions(direction: Direction): LayoutOptions {
  return {
    "elk.algorithm": "layered",
    "elk.direction": direction,
    "elk.edgeRouting": "ORTHOGONAL",
    "elk.spacing.nodeNode": "32",
    "elk.spacing.edgeNode": "16",
    "elk.spacing.edgeEdge": "12",
    "elk.spacing.edgeLabel": "4",
    "elk.spacing.componentComponent": "48",
    "elk.layered.spacing.nodeNodeBetweenLayers": "56",
    "elk.layered.spacing.edgeNodeBetweenLayers": "20",
    "elk.edgeLabels.placement": "CENTER",
    // Keep input order as a tie-breaker so relayouts of similar graphs look similar.
    "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
  };
}

/** Rough label size for the default edge label font; good enough for spacing. */
export function estimateLabelSize(text: string): { width: number; height: number } {
  return { width: Math.ceil(text.length * 6.2) + 10, height: 16 };
}

export const inPort = (id: string) => `${id}::in`;
export const outPort = (id: string) => `${id}::out`;
export const extraPort = (id: string, port: string) => `${id}::port:${port}`;

/**
 * Builds the ELK input. Each node gets one fixed input and one output port at
 * the centre of the side where React Flow draws its target/source handle, so
 * ELK's routes end exactly where React Flow's edges do, plus any extra output
 * ports its member rows have.
 */
export function toElkGraph(input: LayoutInput, direction: Direction, measureLabel = estimateLabelSize): ElkNode {
  const down = direction === "DOWN";

  const children: ElkNode[] = input.nodes.map(({ id, width, height, ports = [] }) => ({
    id,
    width,
    height,
    layoutOptions: { "elk.portConstraints": "FIXED_POS" },
    ports: [
      {
        id: inPort(id),
        width: 0,
        height: 0,
        ...(down ? { x: width / 2, y: 0 } : { x: 0, y: height / 2 }),
        layoutOptions: { "elk.port.side": down ? "NORTH" : "WEST" },
      },
      {
        id: outPort(id),
        width: 0,
        height: 0,
        ...(down ? { x: width / 2, y: height } : { x: width, y: height / 2 }),
        layoutOptions: { "elk.port.side": down ? "SOUTH" : "EAST" },
      },
      // React Flow draws a row's handle a few pixels outside the border; ELK wants ports on it.
      ...ports.map((p) => ({
        id: extraPort(id, p.id),
        width: 0,
        height: 0,
        x: Math.min(p.x, width),
        y: p.y,
        layoutOptions: { "elk.port.side": "EAST" },
      })),
    ],
  }));

  const edges: ElkExtendedEdge[] = input.edges.map((e) => ({
    id: e.id,
    sources: [e.sourcePort ? extraPort(e.source, e.sourcePort) : outPort(e.source)],
    targets: [inPort(e.target)],
    ...(e.label ? { labels: [{ text: e.label, ...measureLabel(e.label) }] } : {}),
  }));

  return { id: "root", layoutOptions: layoutOptions(direction), children, edges };
}

/** Reads node positions and edge routes out of a laid-out ELK graph (flat, so all coordinates are absolute). */
export function readLayout(laidOut: ElkNode, direction: Direction): LayoutResult {
  const positions = new Map<string, XY>();
  const routes = new Map<string, EdgeRoute>();

  for (const child of laidOut.children ?? []) {
    positions.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
  }

  for (const edge of laidOut.edges ?? []) {
    const points = sectionPoints(edge);

    if (points.length < 2) continue;

    const l = edge.labels?.[0];
    const label =
      l && l.x !== undefined && l.y !== undefined
        ? { x: l.x, y: l.y, width: l.width ?? 0, height: l.height ?? 0 }
        : undefined;

    routes.set(edge.id, label ? { points, label } : { points });
  }

  return { direction, positions, routes };
}

/** Joins an edge's sections into one polyline, dropping duplicate joints. */
function sectionPoints(edge: ElkExtendedEdge): XY[] {
  const points: XY[] = [];
  const add = (p: ElkPoint) => {
    const last = points.at(-1);

    if (!last || last.x !== p.x || last.y !== p.y) points.push({ x: p.x, y: p.y });
  };

  for (const s of edge.sections ?? []) {
    add(s.startPoint);
    for (const b of s.bendPoints ?? []) add(b);
    add(s.endPoint);
  }

  return points;
}
