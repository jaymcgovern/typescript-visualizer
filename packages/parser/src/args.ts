import type { ExtractOptions } from "./extract.ts";

/** `node:util` parseArgs options shared by the CLI and the MCP server. */
export const EXTRACT_ARG_OPTIONS = {
  tsconfig: { type: "string", short: "p" },
  root: { type: "string" },
  "include-external": { type: "boolean", default: false },
} as const;

export const EXTRACT_ARG_USAGE = `Arguments:
  files                    Globs of .ts files to analyze, relative to --root (prefix with ! to exclude)

Options:
  -p, --tsconfig <path>    Load compiler options (and files, if none given) from a tsconfig,
                           relative to the current directory
      --root <dir>         Base directory for ids and file paths (default: cwd)
      --include-external   Include placeholder nodes for referenced declarations outside the analyzed files`;

export function toExtractOptions(
  values: {
    tsconfig?: string;
    root?: string;
    "include-external"?: boolean;
  },
  positionals: string[],
): ExtractOptions {
  return {
    files: positionals,
    tsConfigFilePath: values.tsconfig,
    root: values.root,
    includeExternal: values["include-external"],
  };
}

export function hasInputs(values: { tsconfig?: string }, positionals: string[]): boolean {
  return positionals.length > 0 || values.tsconfig !== undefined;
}
