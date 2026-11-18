#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { EXTRACT_ARG_OPTIONS, EXTRACT_ARG_USAGE, hasInputs, toExtractOptions } from "./args";
import { extractGraph } from "./extract";

const USAGE = `Usage: ts-graph [options] [files...]

Extract TypeScript declarations and their relationships as graph JSON.

${EXTRACT_ARG_USAGE}
  -o, --output <path>      Write JSON to a file instead of stdout
  -h, --help               Show this help
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    ...EXTRACT_ARG_OPTIONS,
    output: { type: "string", short: "o" },
    help: { type: "boolean", short: "h" },
  },
});

if (values.help) {
  process.stdout.write(USAGE);
  process.exit(0);
}

if (!hasInputs(values, positionals)) {
  process.stderr.write(USAGE);
  process.exit(1);
}

const graph = extractGraph(toExtractOptions(values, positionals));
const json = `${JSON.stringify(graph, null, 2)}\n`;

if (values.output) {
  writeFileSync(values.output, json);
} else {
  process.stdout.write(json);
}
