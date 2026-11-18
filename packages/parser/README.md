# @tsviz/parser

Extracts TypeScript declarations (interfaces, classes, type aliases, enums,
functions, variables, namespaces) and the relationships between them into a
graph. The format is defined in [`@tsviz/graph`](../graph).

## CLI

```sh
npx -p @tsviz/parser tsviz-graph "src/**/*.ts" '!**/*.test.ts' --root . -o graph.json
```

| option                  | meaning                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `files...`              | Globs relative to `--root`; prefix with `!` to exclude                                       |
| `-p, --tsconfig <path>` | Compiler options (and files, if no globs) from a tsconfig, relative to the current directory |
| `--root <dir>`          | Base for ids and file paths (default: current directory)                                     |
| `--include-external`    | Add placeholder nodes for library and out-of-scope types (`external:<origin>#<name>`)        |
| `-o, --output <path>`   | Write to a file instead of stdout                                                            |

## Library

```ts
import { extractGraph } from "@tsviz/parser";

const graph = extractGraph({ files: ["src/**/*.ts"], root: process.cwd() });
```

## Output

- **nodes:** id (`<file>#<qualified name>`), kind, location (`line`–`endLine`), `signature`, `doc` and members.
- **edges:** `source --kind:label--> target`, plus the `line` of the reference.
- **meta:** what was analyzed, and the references that produced no edge
  (`dropped`): counts, plus every one in `dropped.references` with its reason
  and, for external ones, where it resolved (`lib`, a package, or a file). When
  any were dropped, a missing edge does not prove two declarations are unrelated.
