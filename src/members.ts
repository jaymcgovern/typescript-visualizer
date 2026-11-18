import { Node, type ParameterDeclaration } from "ts-morph";
import type { EdgeKind, Member } from "./types";

/** Which declaration space a reference looks in: `typeof X` and `class extends X` want values. */
export type Meaning = "type" | "value";

/**
 * A type-bearing position in a declaration (heritage clause, property type,
 * parameter type, return type, alias body, ...). `label` names the member,
 * parameter, or type parameter it comes from.
 */
export interface Root {
  node: Node;
  kind: EdgeKind;
  label?: string;
  /** Only meaningful for heritage clauses; type positions decide their own meaning. */
  meaning?: Meaning;
}

type SignatureLike = Node & {
  getParameters(): ParameterDeclaration[];
  getReturnTypeNode(): Node | undefined;
};

/**
 * Single source of truth for class/interface/enum members: produces both the
 * `members` metadata on a node and the type roots its edges come from, so the
 * two can't drift apart.
 */
export function walkMembers(decl: Node): { members: Member[]; roots: Root[] } {
  const members: Member[] = [];
  const roots: Root[] = [];

  if (Node.isEnumDeclaration(decl)) {
    for (const m of decl.getMembers()) members.push({ name: m.getName(), kind: "enumMember" });

    return { members, roots };
  }

  const addProperty = (name: string, kind: Member["kind"], typeNode: Node | undefined) => {
    members.push({ name, kind, type: text(typeNode) });

    if (typeNode) roots.push({ node: typeNode, kind: "property", label: name });
  };

  const addSignature = (name: string, kind: Member["kind"], sig: SignatureLike, label: string) => {
    members.push({ name, kind, type: signatureText(sig) });
    roots.push(...paramRoots(sig.getParameters()), ...returnRoot(sig, label));
  };

  const accessorsSeen = new Set<string>();

  for (const m of rawMembers(decl)) {
    // Overload signatures are the public API; the implementation signature is not.
    if (isOverloadedImplementation(m)) continue;

    if (Node.isConstructorDeclaration(m)) {
      for (const p of m.getParameters()) {
        if (p.isParameterProperty()) {
          addProperty(p.getName(), "property", p.getTypeNode());
        } else {
          roots.push(...paramRoots([p]));
        }
      }
    } else if (Node.isPropertySignature(m) || Node.isPropertyDeclaration(m)) {
      addProperty(m.getName(), "property", m.getTypeNode());
    } else if (Node.isGetAccessorDeclaration(m) || Node.isSetAccessorDeclaration(m)) {
      const name = m.getName();
      const typeNode = Node.isGetAccessorDeclaration(m) ? m.getReturnTypeNode() : m.getParameters()[0]?.getTypeNode();

      if (accessorsSeen.has(name)) {
        if (typeNode) roots.push({ node: typeNode, kind: "property", label: name });
      } else {
        accessorsSeen.add(name);
        addProperty(name, "property", typeNode);
      }
    } else if (Node.isMethodSignature(m) || Node.isMethodDeclaration(m)) {
      addSignature(m.getName(), "method", m, m.getName());
    } else if (Node.isCallSignatureDeclaration(m)) {
      addSignature("call", "call", m, "call");
    } else if (Node.isConstructSignatureDeclaration(m)) {
      addSignature("new", "construct", m, "new");
    } else if (Node.isIndexSignatureDeclaration(m)) {
      addProperty(`[${m.getKeyName()}: ${m.getKeyTypeNode().getText()}]`, "index", m.getReturnTypeNode());
    }
  }

  return { members, roots };
}

/**
 * The compiler's member list. ts-morph's `getMembers()` omits overload
 * signatures, index signatures, and parameter properties.
 */
function rawMembers(decl: Node): Node[] {
  if (Node.isClassDeclaration(decl)) return decl.getNodeProperty("members") ?? [];
  if (Node.isInterfaceDeclaration(decl)) return decl.getNodeProperty("members") ?? [];

  return [];
}

function isOverloadedImplementation(m: Node): boolean {
  return (
    (Node.isMethodDeclaration(m) || Node.isConstructorDeclaration(m)) &&
    m.isImplementation() &&
    m.getOverloads().length > 0
  );
}

export function paramRoots(params: ParameterDeclaration[]): Root[] {
  return params.flatMap((p) => {
    const t = p.getTypeNode();

    return t ? [{ node: t, kind: "param" as const, label: p.getName() }] : [];
  });
}

export function returnRoot(fn: SignatureLike, label: string): Root[] {
  const t = fn.getReturnTypeNode();

  return t ? [{ node: t, kind: "returns", label }] : [];
}

function signatureText(sig: SignatureLike): string {
  const params = sig
    .getParameters()
    .map((p) => p.getText())
    .join(", ");
  const ret = text(sig.getReturnTypeNode());

  return `(${params})${ret ? `: ${ret}` : ""}`;
}

/** Single-line source text of a type node, or undefined when absent. */
function text(n: Node | undefined): string | undefined {
  return n?.getText().replace(/\s+/g, " ");
}
