/**
 * Extracts TypeScript declarations and their relationships into a `Graph`
 * (see `@tsviz/graph` for the format).
 */
export { extractGraph, type ExtractOptions } from "./extract.ts";
export { EXTRACT_ARG_OPTIONS, EXTRACT_ARG_USAGE, hasInputs, toExtractOptions } from "./args.ts";
