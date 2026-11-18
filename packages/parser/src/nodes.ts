import { Node, type ModuleDeclaration, type SourceFile } from "ts-morph";
import { makeId, relativePath } from "./ids.ts";
import { walkMembers } from "./members.ts";
import { docOf, signatureOf } from "./signature.ts";
import type { GraphNode, NodeKind } from "@tsviz/graph";

/** One graph node and the declarations behind it (several when TypeScript merges them). */
export interface Entity {
  node: GraphNode;
  /** Declarations whose type positions produce edges. Overload signatures replace implementations. */
  sources: Node[];
  /** Every declaration that should resolve to this entity. */
  declarations: Node[];
}

interface RawDeclaration {
  file: string;
  qualified: string;
  name: string;
  kind: NodeKind;
  exported: boolean;
  decl: Node;
  sources: Node[];
  declarations: Node[];
}

/** Same-named declarations in the same group merge into one entity (TypeScript declaration merging). */
const MERGE_GROUP: Record<NodeKind, string> = {
  interface: "classlike",
  class: "classlike",
  enum: "enum",
  namespace: "namespace",
  type: "type",
  function: "function",
  variable: "variable",
  external: "external",
};

/** When distinct entities share a name, the first in this order keeps the plain id; others get `@kind`. */
const ID_PRIORITY: NodeKind[] = ["class", "interface", "enum", "type", "function", "variable", "namespace", "external"];

const HAS_MEMBERS = new Set<NodeKind>(["class", "interface", "enum"]);

type Container = SourceFile | ModuleDeclaration;

/** Collects every named top-level and namespace-nested declaration in the files. */
export function collectEntities(files: SourceFile[], root: string): Entity[] {
  const raw: RawDeclaration[] = [];

  for (const sf of files) {
    collect(sf, relativePath(root, sf.getFilePath()), undefined, raw);
  }

  return mergeAndAssignIds(raw);
}

function collect(container: Container, file: string, prefix: string | undefined, out: RawDeclaration[]): void {
  const push = (
    decl: Node,
    name: string,
    kind: NodeKind,
    exported: boolean,
    sources: Node[] = [decl],
    declarations: Node[] = sources,
  ) => {
    const qualified = prefix ? `${prefix}.${name}` : name;

    out.push({ file, qualified, name, kind, exported, decl, sources, declarations });
  };

  for (const i of container.getInterfaces()) push(i, i.getName(), "interface", i.isExported());

  for (const c of container.getClasses()) {
    const name = c.getName();

    if (name) push(c, name, "class", c.isExported());
  }

  for (const t of container.getTypeAliases()) push(t, t.getName(), "type", t.isExported());

  for (const e of container.getEnums()) push(e, e.getName(), "enum", e.isExported());

  for (const f of container.getFunctions()) {
    const name = f.getName();

    if (!name) continue;

    // ts-morph returns only the implementation; its overload signatures carry the public types.
    const overloads = f.getOverloads();

    push(f, name, "function", f.isExported(), overloads.length > 0 ? overloads : [f], [f, ...overloads]);
  }
  for (const stmt of container.getVariableStatements()) {
    for (const d of stmt.getDeclarations()) {
      if (Node.isIdentifier(d.getNameNode())) push(d, d.getName(), "variable", stmt.isExported());
    }
  }
  for (const m of container.getModules()) {
    // `declare module "x"` ambient modules are skipped; only identifier namespaces are nodes.
    if (Node.isStringLiteral(m.getNameNode())) continue;

    const name = m.getName();

    push(m, name, "namespace", m.isExported());
    collect(m, file, prefix ? `${prefix}.${name}` : name, out);
  }
}

function mergeAndAssignIds(raw: RawDeclaration[]): Entity[] {
  // file#qualified -> merge group -> declarations
  const byName = new Map<string, Map<string, RawDeclaration[]>>();

  for (const r of raw) {
    const key = makeId(r.file, r.qualified);
    let groups = byName.get(key);

    if (!groups) byName.set(key, (groups = new Map()));

    const group = MERGE_GROUP[r.kind];

    groups.set(group, [...(groups.get(group) ?? []), r]);
  }

  const entities: Entity[] = [];

  for (const [baseId, groups] of byName) {
    const merged = [...groups.values()]
      .map(merge)
      .sort((a, b) => ID_PRIORITY.indexOf(a.node.kind) - ID_PRIORITY.indexOf(b.node.kind));

    merged.forEach((entity, i) => {
      entity.node.id = i === 0 ? baseId : `${baseId}@${entity.node.kind}`;
      entities.push(entity);
    });
  }

  return entities;
}

function merge(group: RawDeclaration[]): Entity {
  const rs = [...group].sort((a, b) => a.decl.getStart() - b.decl.getStart());
  const first = rs[0]!;
  const kind: NodeKind = rs.some((r) => r.kind === "class") ? "class" : first.kind;
  const sources = rs.flatMap((r) => r.sources);
  const declarations = rs.flatMap((r) => r.declarations);

  const typeParams =
    sources
      .map((s) => (Node.isTypeParametered(s) ? s.getTypeParameters().map((tp) => tp.getName()) : []))
      .find((tps) => tps.length > 0) ?? [];

  // Functions list every overload; merged declarations use the one matching the entity's kind.
  const signature =
    kind === "function"
      ? sources
          .map(signatureOf)
          .filter((s) => s !== undefined)
          .join("\n") || undefined
      : signatureOf(rs.find((r) => r.kind === kind)?.decl ?? first.decl);
  // Overload signatures usually carry the JSDoc, so look at sources first.
  const doc = [...sources, ...declarations].map(docOf).find((d) => d !== undefined);

  const node: GraphNode = {
    id: "", // assigned once collisions across merge groups are known
    name: first.name,
    kind,
    file: first.file,
    line: Math.min(...declarations.map((d) => d.getStartLineNumber())),
    endLine: Math.max(...declarations.map((d) => d.getEndLineNumber())),
    exported: rs.some((r) => r.exported),
    ...(signature !== undefined ? { signature } : {}),
    ...(doc !== undefined ? { doc } : {}),
    ...(typeParams.length > 0 ? { typeParams } : {}),
    ...(HAS_MEMBERS.has(kind) ? { members: rs.flatMap((r) => walkMembers(r.decl).members) } : {}),
  };

  return { node, sources, declarations };
}
