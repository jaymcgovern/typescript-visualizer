/// <reference types="vitest/config" />
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const sampleGraph = fileURLToPath(new URL("../graph.json", import.meta.url));

/**
 * Serves the repo's `graph.json` at `/graph.json` (and copies it into the
 * build) so the sample stays a single file produced by `npm run graph`.
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
            res.end("graph.json not found; run `npm run graph` in the repo root");
          },
        );
      });
    },
    async generateBundle() {
      try {
        this.emitFile({ type: "asset", fileName: "graph.json", source: await readFile(sampleGraph, "utf8") });
      } catch {
        this.warn("graph.json not found; the build will not include a sample graph");
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), sampleGraphPlugin()],
  resolve: {
    alias: { "@core": fileURLToPath(new URL("../src/query/index.ts", import.meta.url)) },
  },
  server: {
    fs: { allow: [repoRoot] },
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
