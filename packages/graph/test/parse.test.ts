import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GraphLoadError, parseGraph } from "../src/parse.ts";

const sample = JSON.parse(readFileSync(new URL("../../../fixtures/fixtures.graph.json", import.meta.url), "utf8"));

const minimal = () => ({
  version: 1,
  meta: { root: "/r", files: ["a.ts"], includeExternal: false, dropped: { external: 0, unresolved: 0, samples: [] } },
  nodes: [
    { id: "a.ts#A", name: "A", kind: "interface", exported: true },
    { id: "a.ts#B", name: "B", kind: "class", exported: true },
  ],
  edges: [{ source: "a.ts#B", target: "a.ts#A", kind: "implements" }],
});

describe("parseGraph", () => {
  it("accepts the repo sample without warnings", () => {
    const { graph, warnings } = parseGraph(sample, "graph.json");

    expect(graph.nodes).toHaveLength(sample.nodes.length);
    expect(graph.edges).toHaveLength(sample.edges.length);
    expect(warnings).toEqual([]);
  });

  it.each([
    ["a non-object", [], /expected a JSON object/],
    ["another version", { ...minimal(), version: 2 }, /unsupported graph version 2/],
    ["missing meta", { ...minimal(), meta: undefined }, /missing "meta"/],
    ["nodes not an array", { ...minimal(), nodes: {} }, /"nodes" must be an array/],
    ["a node without an id", { ...minimal(), nodes: [{ name: "A", kind: "class" }] }, /nodes\[0\]/],
    [
      "an unknown node kind",
      { ...minimal(), nodes: [{ id: "x", name: "x", kind: "module" }] },
      /unknown kind "module"/,
    ],
    ["an unknown edge kind", { ...minimal(), edges: [{ source: "a.ts#A", target: "a.ts#B", kind: "uses" }] }, /"uses"/],
  ])("rejects %s", (_label, data, message) => {
    expect(() => parseGraph(data, "g.json")).toThrow(GraphLoadError);
    expect(() => parseGraph(data, "g.json")).toThrow(message);
  });

  it("skips dangling edges and duplicate nodes with warnings", () => {
    const data = minimal();
    data.nodes.push({ id: "a.ts#A", name: "A2", kind: "type", exported: false });
    data.edges.push({ source: "a.ts#B", target: "a.ts#Gone", kind: "implements" });

    const { graph, warnings } = parseGraph(data, "g.json");

    expect(graph.nodes.map((n) => n.name)).toEqual(["A", "B"]);
    expect(graph.edges).toHaveLength(1);
    expect(warnings).toEqual([
      "Duplicate node id a.ts#A; kept the first",
      "1 edge(s) referenced missing nodes and were skipped",
    ]);
  });

  it("fills in a missing dropped and files with warnings", () => {
    const { graph, warnings } = parseGraph({ ...minimal(), meta: { root: "." } }, "g.json");

    expect(graph.meta).toEqual({
      root: ".",
      files: [],
      includeExternal: false,
      dropped: { external: 0, unresolved: 0, samples: [] },
    });
    expect(warnings).toEqual([
      '"meta.dropped" is missing or malformed; no dropped references are reported',
      '"meta.files" is missing or malformed; treated as []',
      '"meta.includeExternal" is missing or malformed; treated as false',
    ]);
  });

  it("skips malformed dropped entries with warnings", () => {
    const data = minimal();
    const meta = {
      ...data.meta,
      dropped: {
        external: "2",
        unresolved: 1,
        samples: [{ from: "a.ts#A", name: "X", line: 1 }, { name: "Y" }],
        names: [
          { reason: "unresolved", name: "X", count: 1, sites: [{ from: "a.ts#A", line: 1 }] },
          { reason: "typo", name: "Z", count: 1, sites: [] },
        ],
      },
    };

    const { graph, warnings } = parseGraph({ ...data, meta }, "g.json");

    expect(graph.meta.dropped.external).toBe(0);
    expect(graph.meta.dropped.samples).toHaveLength(1);
    expect(graph.meta.dropped.names).toHaveLength(1);
    expect(warnings).toEqual([
      '"meta.dropped.external" is missing or malformed; treated as 0',
      'Skipped 1 malformed "meta.dropped.samples" entries',
      'Skipped 1 malformed "meta.dropped.names" entries',
    ]);
  });
});
