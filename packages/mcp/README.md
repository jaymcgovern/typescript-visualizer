# @tsviz/mcp

Serves a TypeScript declaration graph to an AI agent over MCP (stdio). It
analyzes the project with [`@tsviz/parser`](../parser) on startup and takes the
same arguments as the `tsviz-graph` CLI.

For Claude Code:

```sh
claude mcp add tsviz -- npx -y @tsviz/mcp "src/**/*.ts" --root /path/to/project
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

## Library

`createServer(load)` returns an `McpServer` over any graph source, such as a
saved `graph.json`:

```ts
import { readFileSync } from "node:fs";
import { createServer } from "@tsviz/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = createServer(() => JSON.parse(readFileSync("graph.json", "utf8")));
await server.connect(new StdioServerTransport());
```
