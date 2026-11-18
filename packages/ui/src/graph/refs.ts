import type { NodeKind } from "@tsviz/graph";

/** A declaration a card has an edge to, which its text can link to by name. */
export interface Ref {
  id: string;
  name: string;
  kind: NodeKind;
}

export type RefPart = string | { text: string; ref: Ref };

/** String literals (skipped: `"Dog"` names no declaration), or an identifier. */
const TOKEN = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|[A-Za-z_$][\w$]*/g;

/**
 * Splits type text into plain text and links to `refs`, by name. A name
 * directly followed by `:` or `?:` is a parameter or property name
 * (`pet: Animal`), not a type, so it is not linked; conditional types write
 * ` : ` with spaces. When two refs share a name, the first wins.
 */
export function splitRefs(text: string, refs: Ref[]): RefPart[] {
  if (refs.length === 0) return [text];

  const byName = new Map<string, Ref>();

  for (const ref of refs) if (!byName.has(ref.name)) byName.set(ref.name, ref);

  const parts: RefPart[] = [];
  let last = 0;

  for (const match of text.matchAll(TOKEN)) {
    if (match[1] !== undefined) continue;
    const ref = byName.get(match[0]);
    const end = match.index + match[0].length;

    if (!ref || /^\??:/.test(text.slice(end))) continue;
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push({ text: match[0], ref });
    last = end;
  }
  if (last < text.length) parts.push(text.slice(last));

  return parts;
}
