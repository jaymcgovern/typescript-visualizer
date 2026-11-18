import { Node } from "ts-morph";
import { paramRoots, returnRoot, walkMembers, type Meaning, type Root } from "./members";
import type { EdgeKind, GraphEdge } from "./types";

export type DropReason = "typeParam" | "external" | "unresolved";

/** The declaration a reference denotes, or why it produces no edge. */
export type Resolution = { id: string } | { dropped: DropReason };

/** Maps a name/reference node to the id of the declaration it denotes. */
export type Resolver = (ref: Node, meaning: Meaning) => Resolution;

export interface Drop {
  reason: DropReason;
  from: string;
  name: string;
  line: number;
}

/** Resolves `ref` and records an edge, or reports the drop. */
type Emit = (ref: Node, meaning: Meaning, kind: EdgeKind, label: string | undefined) => void;

export function edgesFor(
  sourceId: string,
  decl: Node,
  resolve: Resolver,
  onDrop: (drop: Drop) => void = () => {},
): GraphEdge[] {
  const out: GraphEdge[] = [];
  const emit: Emit = (ref, meaning, kind, label) => {
    const resolution = resolve(ref, meaning);
    const line = ref.getStartLineNumber();

    if ("dropped" in resolution) {
      onDrop({
        reason: resolution.dropped,
        from: sourceId,
        name: ref.getText(),
        line,
      });

      return;
    }

    out.push({
      source: sourceId,
      target: resolution.id,
      kind,
      ...(label !== undefined ? { label } : {}),
      line,
    });
  };

  for (const root of rootsOf(decl)) {
    if (Node.isExpressionWithTypeArguments(root.node)) {
      // Heritage clause: `extends Base<X>` / `implements I`.
      emit(root.node.getExpression(), root.meaning ?? "type", root.kind, root.label);

      for (const arg of root.node.getTypeArguments()) {
        walkType(arg, "typeArg", root.label, emit);
      }
    } else {
      walkType(root.node, root.kind, root.label, emit);
    }
  }

  return out;
}

/** Finds every type reference, `typeof` query and `import()` type inside a type node, including the node itself. */
function walkType(node: Node, kind: EdgeKind, label: string | undefined, emit: Emit): void {
  for (const n of [node, ...node.getDescendants()]) {
    if (Node.isTypeReference(n)) {
      emit(n.getTypeName(), "type", isTypeArgument(n) ? "typeArg" : kind, label);
    } else if (Node.isTypeQuery(n)) {
      emit(n.getExprName(), "value", "typeof", label);
    } else if (Node.isImportTypeNode(n)) {
      // `import("./x").Foo`; a bare `typeof import("./x")` names a module, not a declaration.
      const qualifier = n.getQualifier();

      if (!qualifier) continue;

      const isTypeOf = n.compilerNode.isTypeOf === true;

      emit(qualifier, isTypeOf ? "value" : "type", isTypeOf ? "typeof" : isTypeArgument(n) ? "typeArg" : kind, label);
    }
  }
}

function isTypeArgument(n: Node): boolean {
  const parent = n.getParent();

  return (
    parent !== undefined &&
    (Node.isTypeReference(parent) || Node.isExpressionWithTypeArguments(parent) || Node.isImportTypeNode(parent))
  );
}

export function rootsOf(decl: Node): Root[] {
  if (Node.isInterfaceDeclaration(decl)) {
    return [
      ...decl.getExtends().map((n): Root => ({ node: n, kind: "extends", meaning: "type" })),
      ...walkMembers(decl).roots,
      ...typeParamRoots(decl),
    ];
  }

  if (Node.isClassDeclaration(decl)) {
    const ext = decl.getExtends();

    return [
      // A class extends a constructor value, which may share its name with an unrelated type.
      ...(ext ? [{ node: ext, kind: "extends", meaning: "value" } satisfies Root] : []),
      ...decl.getImplements().map((n): Root => ({ node: n, kind: "implements", meaning: "type" })),
      ...walkMembers(decl).roots,
      ...typeParamRoots(decl),
    ];
  }

  if (Node.isTypeAliasDeclaration(decl)) {
    const body = decl.getTypeNode();
    const tps = typeParamRoots(decl);

    if (!body) return tps;

    if (Node.isUnionTypeNode(body)) {
      return [...body.getTypeNodes().map((n): Root => ({ node: n, kind: "union" })), ...tps];
    }

    if (Node.isIntersectionTypeNode(body)) {
      return [...body.getTypeNodes().map((n): Root => ({ node: n, kind: "intersection" })), ...tps];
    }

    return [{ node: body, kind: "references" }, ...tps];
  }

  if (Node.isVariableDeclaration(decl)) {
    const t = decl.getTypeNode();

    return t ? [{ node: t, kind: "references" }] : [];
  }

  if (Node.isFunctionDeclaration(decl)) {
    return [
      ...paramRoots(decl.getParameters()),
      ...returnRoot(decl, decl.getName() ?? "default"),
      ...typeParamRoots(decl),
    ];
  }

  // Enums and namespaces carry no type references of their own; their members are separate nodes.
  return [];
}

/** Constraints and defaults of type parameters, e.g. `<B extends Keyed = Keyed>`. */
function typeParamRoots(decl: Node): Root[] {
  if (!Node.isTypeParametered(decl)) return [];

  return decl.getTypeParameters().flatMap((tp) => {
    const name = tp.getName();
    const roots: Root[] = [];
    const constraint = tp.getConstraint();
    const def = tp.getDefault();

    if (constraint) roots.push({ node: constraint, kind: "references", label: name });
    if (def) roots.push({ node: def, kind: "references", label: name });

    return roots;
  });
}
