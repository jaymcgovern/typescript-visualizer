import { z } from "zod";
import { EDGE_KINDS, MEMBER_KINDS, NODE_KINDS } from "@tsviz/graph";

export const NodeKindSchema = z.enum(NODE_KINDS);
export const EdgeKindSchema = z.enum(EDGE_KINDS);

export const NodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: NodeKindSchema,
  file: z.string().optional(),
  line: z.number().optional(),
  endLine: z.number().optional(),
  exported: z.boolean(),
  origin: z.string().optional(),
  signature: z.string().optional(),
  doc: z.string().optional(),
  typeParams: z.array(z.string()).optional(),
  members: z
    .array(
      z.object({
        name: z.string(),
        kind: z.enum(MEMBER_KINDS),
        type: z.string().optional(),
      }),
    )
    .optional(),
});

export const EdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  kind: EdgeKindSchema,
  label: z.string().optional(),
  line: z.number().optional(),
});

/** Returned instead of a result when a `ref` names several declarations. */
const candidates = z
  .array(NodeSchema)
  .optional()
  .describe("Set when a ref was ambiguous; retry with one of these ids.");

export const SummaryOutput = {
  root: z.string(),
  fileCount: z.number(),
  includeExternal: z.boolean(),
  nodeCount: z.number(),
  edgeCount: z.number(),
  nodeKinds: z.record(z.string(), z.number()),
  edgeKinds: z.record(z.string(), z.number()),
  dropped: z.object({
    external: z.number(),
    unresolved: z.number(),
    samples: z.array(z.object({ from: z.string(), name: z.string(), line: z.number() })),
  }),
};

export const FindOutput = {
  matches: z.array(NodeSchema),
  total: z.number(),
};

export const DeclarationOutput = {
  node: NodeSchema.optional(),
  outgoing: z.array(EdgeSchema).optional(),
  incoming: z.array(EdgeSchema).optional(),
  candidates,
};

export const NeighborsOutput = {
  nodes: z.array(NodeSchema).optional(),
  edges: z.array(EdgeSchema).optional(),
  truncated: z.boolean().optional(),
  omitted: z.number().optional(),
  candidates,
};

export const PathOutput = {
  found: z.boolean().optional(),
  edges: z.array(EdgeSchema).optional(),
  candidates,
};
