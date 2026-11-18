import path from "node:path";
import { Node, Project, ts, type CompilerOptions, type SourceFile } from "ts-morph";
import { edgesFor, type Drop, type Resolver } from "./edges.ts";
import { relativePath } from "./ids.ts";
import type { Meaning } from "./members.ts";
import { collectEntities } from "./nodes.ts";
import { groupDropped, type Graph, type GraphEdge, type GraphNode, type ReasonedReference } from "@tsviz/graph";

export interface ExtractOptions {
  /** Globs of files to analyze, relative to `root` (or absolute). Prefix with `!` to exclude. */
  files?: string[];
  /** tsconfig to load compiler options from, relative to the current directory. Analyzes its files when `files` is empty. */
  tsConfigFilePath?: string;
  /** Base for relative ids, paths and `files` globs. Defaults to the current directory. */
  root?: string;
  /** Add placeholder nodes (kind `external`) for referenced declarations outside the analyzed files. */
  includeExternal?: boolean;
}

const MAX_DROP_SAMPLES = 20;

const DEFAULT_COMPILER_OPTIONS: CompilerOptions = {
  strict: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  // Needed so bare package imports resolve through node_modules.
  moduleResolution: ts.ModuleResolutionKind.Bundler,
};

export function extractGraph(options: ExtractOptions = {}): Graph {
  const root = path.resolve(options.root ?? process.cwd());
  const globs = options.files ?? [];

  const project = options.tsConfigFilePath
    ? new Project({
        tsConfigFilePath: path.resolve(options.tsConfigFilePath),
        skipAddingFilesFromTsConfig: globs.length > 0,
      })
    : new Project({ compilerOptions: DEFAULT_COMPILER_OPTIONS });

  const analyzed =
    globs.length > 0 ? project.addSourceFilesAtPaths(globs.map((g) => resolveGlob(root, g))) : project.getSourceFiles();

  // Dependencies are loaded so types resolve across files, but only non-library files emit nodes.
  const sources = analyzed.filter((sf) => !sf.isInNodeModules() && !sf.isFromExternalLibrary());

  const entities = collectEntities(sources, root);

  // Keyed by the underlying compiler node so symbol lookups hit regardless of wrapper identity.
  const idByCompilerNode = new Map<object, string>();

  for (const e of entities) {
    for (const d of e.declarations) idByCompilerNode.set(d.compilerNode, e.node.id);
  }

  const externals = new Map<string, GraphNode>();

  const resolve: Resolver = (ref, meaning) => {
    const symbol = referenceName(ref).getSymbol();
    const target = symbol?.isAlias() ? symbol.getAliasedSymbol() : symbol;
    // A merged symbol (e.g. `const X` + `type X`) has declarations in both spaces; prefer the one asked for.
    const all = target?.getDeclarations() ?? [];
    const candidates = [...all.filter((d) => inSpace(d, meaning)), ...all.filter((d) => !inSpace(d, meaning))];

    // Type parameters are local to their declaration; they are not graph nodes.
    if (candidates.some((d) => Node.isTypeParameterDeclaration(d))) return { dropped: "typeParam" };

    for (const d of candidates) {
      const id = idByCompilerNode.get(d.compilerNode);

      if (id !== undefined) return { id };
    }

    // Unresolvable expressions (e.g. `extends mixin(Base)`) never become placeholders.
    const decl = candidates[0];

    if (!target || !decl) return { dropped: "unresolved" };

    const origin = originOf(decl.getSourceFile(), root);

    if (!options.includeExternal) return { dropped: "external", origin };

    const name = target.getName();
    const id = `external:${origin}#${name}`;

    if (!externals.has(id)) {
      externals.set(id, {
        id,
        name,
        kind: "external",
        exported: false,
        origin,
      });
    }
    return { id };
  };

  // Keyed like edges, so a reference seen twice (e.g. merged declarations) counts once.
  const drops = new Map<string, ReasonedReference>();
  const onDrop = (drop: Drop) => {
    const { reason } = drop;
    if (reason === "typeParam") return;
    const key = JSON.stringify([reason, drop.from, drop.name, drop.line]);
    if (!drops.has(key)) drops.set(key, { ...drop, reason });
  };

  const edgeByKey = new Map<string, GraphEdge>();

  for (const e of entities) {
    for (const source of e.sources) {
      for (const edge of edgesFor(e.node.id, source, resolve, onDrop)) {
        const key = JSON.stringify([edge.source, edge.target, edge.kind, edge.label ?? null]);

        if (!edgeByKey.has(key)) edgeByKey.set(key, edge);
      }
    }
  }

  const unresolved = [...drops.values()]
    .filter((d) => d.reason === "unresolved")
    .map(({ from, name, line }) => ({ from, name, line }))
    .sort((a, b) => compare(a.from, b.from) || a.line - b.line || compare(a.name, b.name));

  return {
    version: 1,
    meta: {
      root,
      files: sources.map((sf) => relativePath(root, sf.getFilePath())).sort(compare),
      includeExternal: options.includeExternal ?? false,
      dropped: {
        external: drops.size - unresolved.length,
        unresolved: unresolved.length,
        samples: unresolved.slice(0, MAX_DROP_SAMPLES),
        names: groupDropped(drops.values()),
      },
    },
    nodes: [...entities.map((e) => e.node), ...externals.values()].sort((a, b) => compare(a.id, b.id)),
    edges: [...edgeByKey.values()].sort(compareEdges),
  };
}

/** Resolves a glob against root while keeping a leading `!` (exclusion) in front. */
function resolveGlob(root: string, glob: string): string {
  return glob.startsWith("!") ? `!${path.resolve(root, glob.slice(1))}` : path.resolve(root, glob);
}

/** For `NS.Foo` or `obj.Foo`, the symbol lives on the right-hand name. */
function referenceName(ref: Node): Node {
  if (Node.isQualifiedName(ref)) return ref.getRight();
  if (Node.isPropertyAccessExpression(ref)) return ref.getNameNode();

  return ref;
}

function inSpace(d: Node, meaning: Meaning): boolean {
  if (Node.isClassDeclaration(d) || Node.isEnumDeclaration(d)) return true;

  return meaning === "type"
    ? Node.isInterfaceDeclaration(d) || Node.isTypeAliasDeclaration(d) || Node.isTypeParameterDeclaration(d)
    : Node.isVariableDeclaration(d) || Node.isFunctionDeclaration(d) || Node.isModuleDeclaration(d);
}

/** `lib` for TypeScript's built-in libs, the package name for node_modules, else a root-relative path. */
function originOf(sf: SourceFile, root: string): string {
  const file = sf.getFilePath();
  const marker = "/node_modules/";
  const at = file.lastIndexOf(marker);

  if (at < 0) return relativePath(root, file);

  const [scopeOrName = "", name = ""] = file.slice(at + marker.length).split("/");
  const pkg = scopeOrName.startsWith("@") ? `${scopeOrName}/${name}` : scopeOrName;

  return pkg === "typescript" && /\/lib\/lib\.[^/]+\.d\.ts$/.test(file) ? "lib" : pkg;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareEdges(a: GraphEdge, b: GraphEdge): number {
  return (
    compare(a.source, b.source) ||
    compare(a.target, b.target) ||
    compare(a.kind, b.kind) ||
    compare(a.label ?? "", b.label ?? "")
  );
}
