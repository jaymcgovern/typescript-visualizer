import { Node, SyntaxKind } from "ts-morph";

const MAX_LENGTH = 300;

/**
 * The declaration's header as written, without its body or initializer:
 * `export class Dog extends Base`, `export const x: T`, `type A = B | C`.
 */
export function signatureOf(decl: Node): string | undefined {
  return cap(rawSignature(decl));
}

/** First paragraph of the declaration's JSDoc description. */
export function docOf(decl: Node): string | undefined {
  const host = Node.isVariableDeclaration(decl) ? decl.getVariableStatement() : decl;

  if (!host || !Node.isJSDocable(host)) return undefined;

  const description = host.getJsDocs().at(-1)?.getDescription().trim();

  if (!description) return undefined;

  return cap(description.split(/\n\s*\n/)[0]);
}

function rawSignature(decl: Node): string | undefined {
  if (Node.isInterfaceDeclaration(decl) || Node.isClassDeclaration(decl) || Node.isEnumDeclaration(decl)) {
    return textBefore(decl, decl.getFirstChildByKind(SyntaxKind.OpenBraceToken));
  }

  if (Node.isModuleDeclaration(decl)) {
    return textBefore(decl, decl.getBody());
  }

  if (Node.isFunctionDeclaration(decl)) {
    return textBefore(decl, decl.getBody());
  }

  if (Node.isTypeAliasDeclaration(decl)) {
    return decl.getText();
  }

  if (Node.isVariableDeclaration(decl)) {
    const stmt = decl.getVariableStatement();
    const exported = stmt?.isExported() ? "export " : "";
    const keyword = stmt?.getDeclarationKind() ?? "const";
    const type = decl.getTypeNode();

    return `${exported}${keyword} ${decl.getName()}${type ? `: ${type.getText()}` : ""}`;
  }

  return undefined;
}

/** Text from the declaration's start (after JSDoc) up to `stop`, or all of it. */
function textBefore(decl: Node, stop: Node | undefined): string {
  if (!stop) return decl.getText();

  return decl.getSourceFile().getFullText().slice(decl.getStart(), stop.getStart());
}

function cap(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;

  const flat = text.replace(/\s+/g, " ").replace(/;$/, "").trim();

  if (!flat) return undefined;

  return flat.length > MAX_LENGTH ? `${flat.slice(0, MAX_LENGTH - 1)}…` : flat;
}
