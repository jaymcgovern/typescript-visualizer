import { describe, expect, it } from "vitest";
import { initialFocusId, initialGraphUrl, loadGraphFromUrl } from "../src/data/loadGraph";

const minimal = () => ({
  version: 1,
  meta: { root: "/r", files: ["a.ts"], includeExternal: false, dropped: { external: 0, unresolved: 0, samples: [] } },
  nodes: [
    { id: "a.ts#A", name: "A", kind: "interface", exported: true },
    { id: "a.ts#B", name: "B", kind: "class", exported: true },
  ],
  edges: [{ source: "a.ts#B", target: "a.ts#A", kind: "implements" }],
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

describe("initialFocusId", () => {
  it("reads ?focus=, ignoring an empty one", () => {
    expect(initialFocusId("?focus=src%2Fa.ts%23A")).toBe("src/a.ts#A");
    expect(initialFocusId("?graph=/g.json&focus=a.ts%23B")).toBe("a.ts#B");
    expect(initialFocusId("?focus=")).toBeUndefined();
    expect(initialFocusId("")).toBeUndefined();
  });
});
