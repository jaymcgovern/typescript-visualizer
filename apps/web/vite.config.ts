/// <reference types="vitest/config" />
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defaultClientConditions, defaultServerConditions, defineConfig, type Plugin } from "vite";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const sampleGraph = fileURLToPath(new URL("../../fixtures/fixtures.graph.json", import.meta.url));

/** Resolve workspace packages to their TypeScript sources, so dev and tests need no build. */
const SOURCE = "@tsviz/source";

/**
 * Serves the committed fixture graph at `/graph.json` (and copies it into the
 * build) so the sample stays a single file, kept current by the parser tests.
 */
function sampleGraphPlugin(): Plugin {
  return {
    name: "sample-graph",
    configureServer(server) {
      server.middlewares.use("/graph.json", (_req, res) => {
        readFile(sampleGraph, "utf8").then(
          (json) => {
            res.setHeader("Content-Type", "application/json");
            res.end(json);
          },
          () => {
            res.statusCode = 404;
            res.end("fixtures/fixtures.graph.json not found");
          },
        );
      });
    },
    async generateBundle() {
      try {
        this.emitFile({ type: "asset", fileName: "graph.json", source: await readFile(sampleGraph, "utf8") });
      } catch {
        this.warn("fixtures/fixtures.graph.json not found; the build will not include a sample graph");
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), sampleGraphPlugin()],
  resolve: { conditions: [SOURCE, ...defaultClientConditions] },
  ssr: { resolve: { conditions: [SOURCE, ...defaultServerConditions] } },
  server: {
    fs: { allow: [repoRoot] },
  },
  test: {
    name: "web",
    include: ["test/**/*.test.ts"],
  },
});
