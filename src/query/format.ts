import type { GraphEdge, GraphNode } from "../types";
import type { GraphIndex } from "./graph-index";
import type { Subgraph, Summary } from "./queries";

/**
 * Compact text views for a language model. Nodes are referred to by short
 * name, or by id when two nodes in the same output share a name; every node
 * line includes its id so the model can pass it to a follow-up call.
 */

export function formatSubgraph(sub: Pick<Subgraph, "nodes" | "edges"> & Partial<Subgraph>, index: GraphIndex): string {
  const label = labeller(sub.nodes, index);
  const lines = sub.nodes.map((n) => formatNode(n));

  if (sub.edges.length > 0) {
    lines.push("", ...sub.edges.map((e) => formatEdge(e, label)));
  } else {
    lines.push("", "(no edges)");
  }

  if (sub.truncated) {
    lines.push(`… ${sub.omitted ?? "more"} more edges (raise limit or narrow kinds)`);
  }

  return lines.join("\n");
}

export function formatDescribe(
  result: { node: GraphNode; outgoing: GraphEdge[]; incoming: GraphEdge[] },
  index: GraphIndex,
): string {
  const { node, outgoing, incoming } = result;
  const related = [...outgoing, ...incoming].flatMap((e) => [e.source, e.target]);
  const label = labeller(
    [...new Set(related)].map((id) => index.byId.get(id)).filter((n) => !!n),
    index,
  );
  const lines = [formatNode(node, { members: true })];

  lines.push("", `uses (${outgoing.length}):`);
  lines.push(...outgoing.map((e) => `  ${formatEdge(e, label)}`));
  lines.push("", `used by (${incoming.length}):`);
  lines.push(...incoming.map((e) => `  ${formatEdge(e, label)}`));

  return lines.join("\n");
}

export function formatMatches(matches: GraphNode[], total?: number): string {
  if (matches.length === 0) return "No matches.";

  const lines = matches.map((n) => `${header(n)}${n.signature ? `\n  ${firstLine(n.signature)}` : ""}`);

  if (total !== undefined && total > matches.length) {
    lines.push(`… ${total - matches.length} more (raise limit or refine query)`);
  }

  return lines.join("\n");
}

export function formatPath(edges: GraphEdge[], index: GraphIndex): string {
  if (edges.length === 0) return "Same node.";

  const ids = new Set(edges.flatMap((e) => [e.source, e.target]));
  const nodes = [...ids].map((id) => index.byId.get(id)).filter((n) => !!n);
  const label = labeller(nodes, index);

  return [
    `${edges.length} step${edges.length === 1 ? "" : "s"}:`,
    ...edges.map((e) => `  ${formatEdge(e, label)}`),
  ].join("\n");
}

export function formatSummary(s: Summary): string {
  const { meta } = s;
  const lines = [
    `root: ${meta.root}`,
    `files: ${meta.files.length}`,
    `nodes: ${s.nodeCount} (${entries(s.nodeKinds)})`,
    `edges: ${s.edgeCount} (${entries(s.edgeKinds)})`,
    `external references ${meta.includeExternal ? "included as nodes" : `omitted: ${meta.dropped.external}`}`,
    `unresolved references: ${meta.dropped.unresolved}`,
  ];

  for (const d of meta.dropped.samples) {
    lines.push(`  ${d.name} in ${d.from} (line ${d.line})`);
  }

  return lines.join("\n");
}

function formatNode(n: GraphNode, opts: { members?: boolean } = {}): string {
  const lines = [header(n)];

  if (n.signature) lines.push(...n.signature.split("\n").map((s) => `  ${s}`));
  if (n.doc) lines.push(`  doc: ${n.doc}`);
  if (opts.members && n.members && n.members.length > 0) {
    lines.push("  members:");

    for (const m of n.members) {
      lines.push(`    ${m.name}${m.type ? `: ${m.type}` : ""}`);
    }
  }

  return lines.join("\n");
}

function header(n: GraphNode): string {
  const where = n.file
    ? `${n.file}:${n.line}${n.endLine && n.endLine !== n.line ? `-${n.endLine}` : ""}`
    : `(${n.origin ?? "external"})`;

  return `[${n.kind}] ${n.name}  id=${n.id}  ${where}`;
}

function formatEdge(e: GraphEdge, label: (id: string) => string): string {
  const kind = e.label ? `${e.kind}:${e.label}` : e.kind;
  const at = e.line !== undefined ? `  (line ${e.line})` : "";

  return `${label(e.source)} --${kind}--> ${label(e.target)}${at}`;
}

/** Short names, falling back to ids for names that collide within `nodes`. */
function labeller(nodes: GraphNode[], index: GraphIndex): (id: string) => string {
  const counts = new Map<string, number>();

  for (const n of nodes) counts.set(n.name, (counts.get(n.name) ?? 0) + 1);

  return (id) => {
    const n = index.byId.get(id);

    return n && counts.get(n.name) === 1 ? n.name : id;
  };
}

function firstLine(text: string): string {
  return text.split("\n")[0]!;
}

function entries(counts: Record<string, number>): string {
  return Object.entries(counts)
    .map(([k, v]) => `${k} ${v}`)
    .join(", ");
}
