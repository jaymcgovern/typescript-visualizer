import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GraphLoadError, initialGraphUrl, loadGraphFromUrl, parseGraph } from "../src/data/loadGraph";

const sample = JSON.parse(readFileSync(new URL("../../graph.json", import.meta.url), "utf8"));

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
});

const respond = (body: string, init?: ResponseInit) => (async () => new Response(body, init)) as typeof fetch;

describe("loadGraphFromUrl", () => {
  it("loads and parses JSON", async () => {
    const loaded = await loadGraphFromUrl("/g.json", respond(JSON.stringify(minimal())));

    expect(loaded.source).toBe("/g.json");
    expect(loaded.graph.nodes).toHaveLength(2);
  });

  it("reports HTTP errors, bad JSON and network failures", async () => {
    await expect(loadGraphFromUrl("/g.json", respond("nope", { status: 404 }))).rejects.toThrow(/HTTP 404/);
    await expect(loadGraphFromUrl("/g.json", respond("{"))).rejects.toThrow(/invalid JSON/);
    const offline = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    await expect(loadGraphFromUrl("/g.json", offline)).rejects.toThrow(/Failed to fetch/);
  });
});

describe("initialGraphUrl", () => {
  it("prefers ?graph= and falls back to the sample", () => {
    expect(initialGraphUrl("?graph=https%3A%2F%2Fx.dev%2Fg.json")).toBe("https://x.dev/g.json");
    expect(initialGraphUrl("")).toBe("/graph.json");
    expect(initialGraphUrl("?graph=")).toBe("/graph.json");
  });
});
