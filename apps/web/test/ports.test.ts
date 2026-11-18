import { readFileSync } from "node:fs";
import type { GraphNode } from "@tsviz/graph";
import { describe, expect, it } from "vitest";
import { parseGraph } from "../src/data/loadGraph";
import { COLLAPSED_ROWS } from "../src/graph/cardBody";
import { assignPorts, MORE_HANDLE, OUT_HANDLE, rowHandle } from "../src/graph/ports";
import { groupRelationships } from "../src/graph/relationships";
import { layoutInput, sourceHandles, toFlow } from "../src/graph/toFlow";
import { extraPort, outPort, toElkGraph } from "../src/layout/elkGraph";

const { graph } = parseGraph(
  JSON.parse(readFileSync(new URL("../../../fixtures/fixtures.graph.json", import.meta.url), "utf8")),
  "graph.json",
);
const nodeOf = (name: string, kind: string) => graph.nodes.find((n) => n.name === name && n.kind === kind)!;
const outOf = (decl: GraphNode) => groupRelationships(graph.edges).filter((r) => r.source === decl.id);
/** Port per target name. */
const portsByName = (decl: GraphNode, expanded = false) =>
  Object.fromEntries(
    [...assignPorts(decl, expanded, outOf(decl))].map(([target, handle]) => [target.split("#")[1], handle]),
  );

describe("assignPorts", () => {
  it("sends inheritance to the main port and members to their rows", () => {
    // Dog rows: name, owner | speak, walk, adopt. Dog -> Animal is both `implements` and adopt's `pet`.
    expect(portsByName(nodeOf("Dog", "class"))).toEqual({
      Animal: OUT_HANDLE,
      Base: OUT_HANDLE,
      Walkable: OUT_HANDLE,
      Owner: rowHandle(1),
      Dog: rowHandle(4),
    });
  });

  it("indexes rows across overloads", () => {
    // lookup rows: name, → Pet | name, owner, → Pet
    expect(portsByName(nodeOf("lookup", "function"), true)).toEqual({ Pet: rowHandle(1), Person: rowHandle(3) });
  });

  it("uses union variant rows", () => {
    expect(portsByName(nodeOf("Shape", "type"))).toEqual({ Circle: rowHandle(0), Square: rowHandle(1) });
  });

  it("sends edges from hidden rows to '+N more' until the card is expanded", () => {
    const decl: GraphNode = {
      id: "a.ts#Big",
      name: "Big",
      kind: "interface",
      exported: true,
      members: Array.from({ length: COLLAPSED_ROWS + 3 }, (_, i) => ({ kind: "property" as const, name: `p${i}` })),
    };
    const last = `p${COLLAPSED_ROWS + 2}`;
    const out = [
      {
        source: decl.id,
        target: "a.ts#T",
        kind: "property" as const,
        edges: [{ source: decl.id, target: "a.ts#T", kind: "property" as const, label: last }],
      },
    ];

    expect(assignPorts(decl, false, out).get("a.ts#T")).toBe(MORE_HANDLE);
    expect(assignPorts(decl, true, out).get("a.ts#T")).toBe(rowHandle(COLLAPSED_ROWS + 2));
  });
});

describe("sourceHandles", () => {
  const { nodes, edges } = toFlow(graph);

  it("routes from rows only in the RIGHT layout", () => {
    expect(sourceHandles(nodes, "DOWN").size).toBe(0);

    const right = sourceHandles(nodes, "RIGHT");
    const dog = nodeOf("Dog", "class").id;
    const owner = nodeOf("Owner", "class").id;

    expect(right.get(`${dog}->${owner}`)).toBe(rowHandle(1));
    expect(right.size).toBe(edges.length);
  });

  it("gives ELK an east port per row port, and points the edge at it", () => {
    const right = sourceHandles(nodes, "RIGHT");
    const dog = nodeOf("Dog", "class").id;
    const portsOf = (id: string) => (id === dog ? [{ id: rowHandle(1), x: 300, y: 70 }] : []);
    const input = layoutInput(nodes, edges, { handles: right, portsOf });
    const elk = toElkGraph(input, "RIGHT");
    const dogNode = elk.children!.find((c) => c.id === dog)!;
    const port = dogNode.ports!.find((p) => p.id === extraPort(dog, rowHandle(1)))!;

    // Clamped onto the border: React Flow's anchor is a few pixels outside it.
    expect(port).toMatchObject({ x: Math.min(300, dogNode.width!), y: 70 });
    expect(port.layoutOptions).toEqual({ "elk.port.side": "EAST" });
    expect(elk.edges!.find((e) => e.id === `${dog}->${nodeOf("Owner", "class").id}`)!.sources).toEqual([
      extraPort(dog, rowHandle(1)),
    ]);
    // Inheritance keeps the main port.
    expect(elk.edges!.find((e) => e.id === `${dog}->${nodeOf("Base", "class").id}`)!.sources).toEqual([outPort(dog)]);
  });
});
