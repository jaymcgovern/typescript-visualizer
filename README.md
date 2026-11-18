# typescript-visualizer

A web based tool for visualizing TypeScript entities and their relationships.

It extracts declarations (interfaces, classes, type aliases, enums, functions,
variables, namespaces) and the relationships between them into a graph. The
graph can be written as JSON, or served to an AI agent over MCP.

## Extract a graph

```sh
npm install
npm run graph -- "src/**/*.ts" '!**/*.test.ts' --root . -o graph.json
```

| option                  | meaning                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `files...`              | Globs relative to `--root`; prefix with `!` to exclude                                       |
| `-p, --tsconfig <path>` | Compiler options (and files, if no globs) from a tsconfig, relative to the current directory |
| `--root <dir>`          | Base for ids and file paths (default: current directory)                                     |
| `--include-external`    | Add placeholder nodes for library and out-of-scope types (`external:<origin>#<name>`)        |

The output is described by `Graph` in [src/types.ts](src/types.ts):

- **nodes:** id (`<file>#<qualified name>`), kind, location (`line`–`endLine`), `signature`, `doc` and members.
- **edges:** `source --kind:label--> target`, plus the `line` of the reference.
- **meta:** what was analyzed, and how many references produced no edge (`dropped`). When those counts are non-zero, a missing edge does not prove two declarations are unrelated.

## Visualize it in the browser

```sh
npm --prefix web install
npm run web        # http://localhost:5173
```

The app opens the repo's `graph.json`. To view another graph, drop a file on
the page, use **Open graph.json…**, or pass a URL: `?graph=https://…/graph.json`.
`npm run graph:self` writes this repo's own graph to `web/public/self.graph.json`
(open it with `?graph=/self.graph.json`), a larger sample.
It reuses the queries in [src/query](src/query) through their browser-safe
entry point, [src/query/index.ts](src/query/index.ts).

## Use it from an AI agent (MCP)

`src/mcp/server.ts` serves the graph over stdio. It takes the same arguments as
the CLI. For Claude Code:

```sh
claude mcp add ts-graph -- npx tsx /path/to/typescript-visualizer/src/mcp/server.ts "src/**/*.ts" --root /path/to/project
```

| tool                | purpose                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `graph_summary`     | Counts by kind and dropped references; a good first call                                    |
| `find_declarations` | Search by name                                                                              |
| `get_declaration`   | One declaration with its signature, doc, members and all edges                              |
| `get_neighbors`     | What a declaration uses (`out`), what uses it (`in`), up to 3 hops, filterable by edge kind |
| `find_path`         | Shortest chain of relationships between two declarations                                    |
| `refresh_graph`     | Re-analyze after editing code                                                               |

Tools accept an id, a name (`Dog`) or a qualified name (`NS.Inner`). An
ambiguous name returns the matching ids to choose from. Results are compact
text for the model, plus `structuredContent` that matches each tool's output
schema.

The same queries are available as a library (`GraphIndex`, `find`,
`neighbors`, `path`, `formatSubgraph`) from [src/index.ts](src/index.ts). They also
work on a saved `graph.json`.

## Development

```sh
npm test          # vitest
npm run typecheck
npm run web:test  # web app tests (also web:typecheck, web:build)
```
