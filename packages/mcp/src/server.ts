#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseArgs } from "node:util";
import { EXTRACT_ARG_OPTIONS, EXTRACT_ARG_USAGE, extractGraph, hasInputs, toExtractOptions } from "@tsviz/parser";
import { createServer } from "./tools.ts";

const USAGE = `Usage: tsviz-mcp [options] [files...]

Serve the TypeScript declaration graph to an AI agent over MCP (stdio).

${EXTRACT_ARG_USAGE}
  -h, --help               Show this help
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    ...EXTRACT_ARG_OPTIONS,
    help: { type: "boolean", short: "h" },
  },
});

// stdout carries the protocol, so usage goes to stderr.
if (values.help) {
  process.stderr.write(USAGE);
  process.exit(0);
}

if (!hasInputs(values, positionals)) {
  process.stderr.write(USAGE);
  process.exit(1);
}

const options = toExtractOptions(values, positionals);
const server = createServer(() => extractGraph(options));

await server.connect(new StdioServerTransport());
