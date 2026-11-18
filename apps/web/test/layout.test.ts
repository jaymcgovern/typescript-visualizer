import { readFileSync } from "node:fs";
import ELK from "elkjs/lib/elk.bundled.js";
import { Position } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { parseGraph } from "../src/data/loadGraph";
import { applyEdgeLayout, applyNodeLayout, layoutInput, toFlow } from "../src/graph/toFlow";
import {
  inPort,
  outPort,
  readLayout,
  toElkGraph,
  type Box,
  type Direction,
  type LayoutInput,
  type LayoutResult,
} from "../src/layout/elkGraph";

const { graph } = parseGraph(
  JSON.parse(readFileSync(new URL("../../../fixtures/fixtures.graph.json", import.meta.url), "utf8")),
  "graph.json",
);
const flow = toFlow(graph);
// Unmeasured nodes get layoutInput's fallback size; vary a few so sizes matter.
const input: LayoutInput = layoutInput(
  flow.nodes.map((n, i) => (i % 5 === 0 ? { ...n, measured: { width: 220, height: 90 } } : n)),
  flow.edges,
);
const sizes = new Map(input.nodes.map((n) => [n.id, n]));

const elk = new ELK();
const run = async (direction: Direction) => readLayout(await elk.layout(toElkGraph(input, direction)), direction);

function box(layout: LayoutResult, id: string): Box {
  const p = layout.positions.get(id)!;
  const s = sizes.get(id)!;

  return { x: p.x, y: p.y, width: s.width, height: s.height };
}

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe("toElkGraph", () => {
  it("gives each node fixed in/out ports where React Flow draws its handles", () => {
    const down = toElkGraph(input, "DOWN");
    const node = down.children![0]!;
    const { width, height } = sizes.get(node.id)!;

    expect(node.layoutOptions?.["elk.portConstraints"]).toBe("FIXED_POS");
    expect(node.ports).toMatchObject([
      { id: inPort(node.id), x: width / 2, y: 0 },
      { id: outPort(node.id), x: width / 2, y: height },
    ]);

    const right = toElkGraph(input, "RIGHT").children![0]!;
    expect(right.ports).toMatchObject([
      { x: 0, y: height / 2 },
      { x: width, y: height / 2 },
    ]);
  });

  it("connects edges port to port and sizes their labels", () => {
    const g = toElkGraph(input, "DOWN");
    const labelled = input.edges.find((e) => e.label)!;
    const e = g.edges!.find((x) => x.id === labelled.id)!;

    expect(e.sources).toEqual([outPort(labelled.source)]);
    expect(e.targets).toEqual([inPort(labelled.target)]);
    expect(e.labels?.[0]).toMatchObject({ text: labelled.label, height: 16 });
    expect(e.labels![0]!.width).toBeGreaterThan(0);
  });
});

describe.each<Direction>(["DOWN", "RIGHT"])("ELK layout (%s)", (direction) => {
  it("places every node without overlaps", async () => {
    const layout = await run(direction);
    const ids = input.nodes.map((n) => n.id);

    expect([...layout.positions.keys()].toSorted()).toEqual(ids.toSorted());
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        expect(overlaps(box(layout, ids[i]!), box(layout, ids[j]!)), `${ids[i]} / ${ids[j]}`).toBe(false);
      }
    }
  });

  it("routes every edge (self-loops included) from the source handle to the target handle", async () => {
    const layout = await run(direction);

    expect(layout.routes.size).toBe(input.edges.length);
    for (const e of input.edges) {
      const points = layout.routes.get(e.id)!.points;
      const s = box(layout, e.source);
      const t = box(layout, e.target);
      const start =
        direction === "DOWN"
          ? { x: s.x + s.width / 2, y: s.y + s.height }
          : { x: s.x + s.width, y: s.y + s.height / 2 };
      const end = direction === "DOWN" ? { x: t.x + t.width / 2, y: t.y } : { x: t.x, y: t.y + t.height / 2 };

      expect(points[0], e.id).toEqual(start);
      expect(points.at(-1), e.id).toEqual(end);
      // Orthogonal: every segment is horizontal or vertical.
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1]!;
        const b = points[i]!;
        expect(a.x === b.x || a.y === b.y, `${e.id} segment ${i}`).toBe(true);
      }
    }
  });

  it("puts most declarations before the declarations they use", async () => {
    const layout = await run(direction);
    const axis = direction === "DOWN" ? "y" : "x";
    const forward = input.edges.filter(
      (e) => e.source !== e.target && layout.positions.get(e.source)![axis] < layout.positions.get(e.target)![axis],
    );
    const nonLoops = input.edges.filter((e) => e.source !== e.target);

    expect(forward.length / nonLoops.length).toBeGreaterThan(0.9);
  });

  it("places labels clear of nodes", async () => {
    const layout = await run(direction);

    for (const e of input.edges.filter((x) => x.label)) {
      const label = layout.routes.get(e.id)!.label;
      expect(label, e.id).toBeDefined();
      for (const id of layout.positions.keys()) {
        expect(overlaps(label!, box(layout, id)), `${e.id} label over ${id}`).toBe(false);
      }
    }
  });

  it("is deterministic", async () => {
    const [a, b] = await Promise.all([run(direction), run(direction)]);

    expect([...a.positions]).toEqual([...b.positions]);
  });
});

describe("applying a layout to the flow", () => {
  it("moves nodes, turns their handles, and attaches routes to edges", async () => {
    const layout = await run("RIGHT");
    const nodes = applyNodeLayout(flow.nodes, layout);
    const edges = applyEdgeLayout(flow.edges, layout);

    for (const n of nodes) {
      expect(n.position).toEqual(layout.positions.get(n.id));
      expect(n).toMatchObject({ sourcePosition: Position.Right, targetPosition: Position.Left });
    }
    for (const e of edges) {
      expect(e.data?.route).toBe(layout.routes.get(e.id));
      expect(e.data?.rel).toBeDefined();
    }
  });
});
