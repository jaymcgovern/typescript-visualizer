# typescript-visualizer

Tools for exploring TypeScript code as a graph of declarations (interfaces,
classes, type aliases, enums, functions, variables, namespaces) and the
relationships between them.

| package                            | what it does                                                 |
| ---------------------------------- | ------------------------------------------------------------ |
| [`@tsviz/parser`](packages/parser) | Extracts the graph from TypeScript source; library and CLI   |
| [`@tsviz/mcp`](packages/mcp)       | Serves the graph to AI agents over MCP                       |
| [`@tsviz/ui`](packages/ui)         | React component that draws the graph                         |
| [`@tsviz/graph`](packages/graph)   | The graph format they share: types, validation and queries   |
| [`apps/web`](apps/web)             | Demo app: open a `graph.json` in the browser (not published) |

```
@tsviz/parser ──▶ @tsviz/graph ◀── @tsviz/ui ◀── apps/web
      ▲                ▲
      └── @tsviz/mcp ──┘
```

## Quick start

```sh
npm install
npm run graph -- "src/**/*.ts" '!**/*.test.ts' --root /path/to/project -o graph.json
npm run web       # http://localhost:5173 — drop graph.json on the page
```

## Development

This is an npm workspaces monorepo.

```sh
npm test            # every package and the demo app (Vitest)
npm run typecheck
npm run lint        # oxlint; npm run format for oxfmt
npm run build       # dist/ for each package
npm run graph -- …  # the parser CLI, from source
npm run mcp -- …    # the MCP server, from source
npm run web         # the demo app
npm run graph:self  # this repo's own graph, for the demo: ?graph=/self.graph.json
```

Packages import each other by name. The `@tsviz/source` export condition points
those imports at `src/`, and tsx, Vitest, Vite and `tsc --noEmit` all enable it,
so nothing needs building during development. Published builds resolve to
`dist/` instead.

[fixtures/](fixtures) holds the TypeScript the tests analyze.
`fixtures/fixtures.graph.json` is their graph. The UI tests and the demo's
sample use it, and a parser test fails when it is out of date. Regenerate it
with `npx vitest run --project parser -u`.

## License

[MIT](LICENSE) © Jay McGovern
