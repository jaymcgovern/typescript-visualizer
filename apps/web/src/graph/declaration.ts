import type { GraphNode, Member, NodeKind } from "@tsviz/graph";

export const KIND_BADGE: Record<NodeKind, string> = {
  interface: "I",
  class: "C",
  type: "T",
  enum: "E",
  function: "fn",
  variable: "V",
  namespace: "NS",
  external: "ext",
};

/** One member as a line of TypeScript-ish text. */
export function memberText(m: Member): string {
  switch (m.kind) {
    case "property":
      return m.type ? `${m.name}: ${m.type}` : m.name;
    case "method":
      return `${m.name}${m.type ?? "()"}`;
    case "index":
      return m.type ? `${m.name}: ${m.type}` : m.name;
    case "call":
      return m.type ?? "()";
    case "construct":
      return `new ${m.type ?? "()"}`;
    case "enumMember":
      return m.name;
  }
}

/**
 * What a card shows of the signature: the text after the declaration's name
 * (and its type parameters, which the header shows), one entry per overload.
 *
 * - class / interface: the heritage clause, `extends Base implements Animal`
 * - function: `(name: string): Pet`
 * - type alias: `= User | null`
 * - variable: `: Pet`
 */
export function signatureTails(node: GraphNode): string[] {
  if (!node.signature) return [];

  return node.signature
    .split("\n")
    .map((line) => tail(line, node.name))
    .filter((t) => t !== "");
}

function tail(line: string, name: string): string {
  const at = findName(line, name);

  if (at < 0) return "";

  let rest = line.slice(at + name.length);

  if (rest.startsWith("<")) rest = rest.slice(closingAngle(rest) + 1);

  return rest.trim();
}

/** Index of `name` as a whole word (the first occurrence after any keywords). */
function findName(line: string, name: string): number {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(^|[^\\w$])(${escaped})(?![\\w$])`).exec(line);

  return match ? match.index + match[1]!.length : -1;
}

/** Index of the `>` closing the `<` at position 0, ignoring `=>`. */
function closingAngle(text: string): number {
  let depth = 0;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (c === "<") depth++;
    else if (c === ">" && text[i - 1] !== "=") {
      depth--;
      if (depth === 0) return i;
    }
  }

  return text.length - 1;
}

const ABBREVIATION = /\b(?:e\.g|i\.e|etc|vs|cf)$/i;

/**
 * The first sentence of a doc comment, for the card's summary line.
 * `{@link X}` becomes `X`. A sentence ends at `.`, `!` or `?` followed by a
 * capital letter or the end, but not after an abbreviation such as `e.g.`.
 */
export function docSummary(doc: string | undefined): string | undefined {
  const text = doc
    ?.replace(/\{@link(?:code|plain)?\s+([^\s|}]+)[^}]*\}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return undefined;

  for (const match of text.matchAll(/[.!?](?=\s+[A-Z]|$)/g)) {
    if (!ABBREVIATION.test(text.slice(0, match.index))) return text.slice(0, match.index + 1);
  }

  return text;
}

/** Splits text on backticks: odd-indexed parts were inline code. */
export function codeSpans(text: string): { text: string; code: boolean }[] {
  return text
    .split("`")
    .map((part, i) => ({ text: part, code: i % 2 === 1 }))
    .filter((p) => p.text !== "");
}
