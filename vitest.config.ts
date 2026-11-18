import { defaultClientConditions, defaultServerConditions } from "vite";
import { defineConfig } from "vitest/config";

/** Resolve workspace packages to their TypeScript sources, so tests need no build. */
const SOURCE = "@tsviz/source";

export default defineConfig({
  resolve: { conditions: [SOURCE, ...defaultClientConditions] },
  ssr: { resolve: { conditions: [SOURCE, ...defaultServerConditions] } },
  test: {
    projects: [
      ...["graph", "parser", "mcp", "ui"].map((name) => ({
        extends: true,
        test: { name, root: `packages/${name}`, include: ["test/**/*.test.ts"] },
      })),
      // The demo app has its own Vite config.
      "apps/web",
    ],
  },
});
