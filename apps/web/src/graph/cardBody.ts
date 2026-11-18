import type { GraphNode, Member } from "@tsviz/graph";
import { signatureTails } from "./declaration";

/**
 * One line of a card body. `name` is the member or parameter name, kept apart
 * from `rest` so it can be styled (and later matched against `edge.label`).
 */
export interface BodyRow {
  /** Leading operator column: `=`, `|`, `&` for alias variants, `→` for a return type. */
  op?: string;
  name?: string;
  /** Text after the name, e.g. `: string` or `(x: number): void`. */
  rest: string;
  /** Call, construct and index signatures, and return types. */
  muted?: boolean;
}

/** Rows separated from the next group by a rule; `label` numbers overloads. */
export interface RowGroup {
  label?: string;
  rows: BodyRow[];
}

export type CardBody = { kind: "rows"; groups: RowGroup[] } | { kind: "chips"; items: string[] } | { kind: "none" };

export interface CardView {
  /** Class / interface heritage clause, shown under the name. */
  heritage?: string;
  /** Muted text after the name in the header: a variable's type, an overload count. */
  inline?: string;
  body: CardBody;
  /** Present when the body can be collapsed; `hidden` is 0 while expanded. */
  collapse?: { hidden: number; noun: string };
}

/** Rows shown on a collapsed card; the rest sit behind "+N more". */
export const COLLAPSED_ROWS = 6;
/** Enum values and literal-union chips shown on a collapsed card. */
export const COLLAPSED_CHIPS = 12;
/** Overloads shown in full; beyond this the card shows only the first. */
export const MAX_OVERLOADS = 3;

/**
 * What a card shows for a declaration, by kind:
 * - interface, class, namespace: heritage, then members grouped as
 *   signatures (index / call / construct), properties, methods
 * - enum: its values as chips
 * - type: a top-level union or intersection as one row per variant (a union
 *   of literals as chips); any other alias as a single `= …` row
 * - function: one group per overload, a row per parameter then `→ return`
 * - variable: its type inline in the header, no body
 * - external: no body (the card shows its origin)
 */
export function cardView(node: GraphNode, expanded = false): CardView {
  const tails = signatureTails(node);

  switch (node.kind) {
    case "interface":
    case "class":
    case "namespace": {
      const heritage = node.kind === "namespace" ? undefined : tails[0];

      return { ...(heritage ? { heritage } : {}), ...collapseRows(memberGroups(node.members ?? []), expanded) };
    }
    case "enum":
      return collapseChips(
        (node.members ?? []).map((m) => m.name),
        expanded,
      );
    case "type":
      return typeView(tails[0], expanded);
    case "function":
      return functionView(tails, expanded);
    case "variable":
      return { ...(tails[0] ? { inline: tails[0] } : {}), body: { kind: "none" } };
    case "external":
      return { body: { kind: "none" } };
  }
}

const SIGNATURE_KINDS: ReadonlySet<Member["kind"]> = new Set(["index", "call", "construct"]);

function memberGroups(members: Member[]): RowGroup[] {
  const groups = [
    members.filter((m) => SIGNATURE_KINDS.has(m.kind)),
    members.filter((m) => m.kind === "property" || m.kind === "enumMember"),
    members.filter((m) => m.kind === "method"),
  ];

  return groups.filter((g) => g.length > 0).map((g) => ({ rows: g.map(memberRow) }));
}

export function memberRow(m: Member): BodyRow {
  switch (m.kind) {
    case "property":
      return { name: m.name, rest: m.type ? `: ${m.type}` : "" };
    case "method":
      return { name: m.name, rest: m.type ?? "()" };
    case "index":
      return { name: m.name, rest: m.type ? `: ${m.type}` : "", muted: true };
    case "call":
      return { rest: m.type ?? "()", muted: true };
    case "construct":
      return { name: "new", rest: ` ${m.type ?? "()"}`, muted: true };
    case "enumMember":
      return { name: m.name, rest: "" };
  }
}

function typeView(tail: string | undefined, expanded: boolean): CardView {
  if (!tail?.startsWith("=")) return { body: { kind: "none" } };

  const expr = tail.slice(1).trim();
  // A conditional type's branches may contain unions; don't split those.
  const conditional = splitTopLevel(expr, "?").length > 1;
  const union = conditional ? [expr] : nonEmpty(splitTopLevel(expr, "|"));

  if (union.length > 1) {
    if (union.every(isLiteral)) return collapseChips(union, expanded);

    return collapseRows([{ rows: union.map((v, i) => ({ op: i === 0 ? "=" : "|", rest: v })) }], expanded);
  }

  const parts = conditional ? [expr] : nonEmpty(splitTopLevel(expr, "&"));

  return {
    body: { kind: "rows", groups: [{ rows: parts.map((v, i) => ({ op: i === 0 ? "=" : "&", rest: v })) }] },
  };
}

function functionView(tails: string[], expanded: boolean): CardView {
  if (tails.length === 0) return { body: { kind: "none" } };

  const many = tails.length > 1;
  const inline = many ? `${tails.length} overloads` : undefined;
  const collapsible = tails.length > MAX_OVERLOADS;
  const shown = collapsible && !expanded ? tails.slice(0, 1) : tails;
  const groups = shown.map((tail, i) => ({
    ...(many ? { label: `${i + 1}` } : {}),
    rows: signatureRows(tail),
  }));

  return {
    ...(inline ? { inline } : {}),
    body: { kind: "rows", groups },
    ...(collapsible ? { collapse: { hidden: tails.length - shown.length, noun: "overloads" } } : {}),
  };
}

/** `(a: A, b?: B): R` → a row per parameter, then `→ R`. */
export function signatureRows(tail: string): BodyRow[] {
  if (!tail.startsWith("(")) return [{ rest: tail, muted: true }];

  const close = closingBracket(tail, 0);
  const params = nonEmpty(splitTopLevel(tail.slice(1, close), ","));
  const after = tail.slice(close + 1).trim();
  const rows: BodyRow[] = params.map(paramRow);

  if (after.startsWith(":")) rows.push({ op: "→", rest: after.slice(1).trim(), muted: true });

  return rows;
}

function paramRow(param: string): BodyRow {
  const [head, ...typeParts] = splitTopLevel(param, ":");
  let name = head!.trim();
  let rest = typeParts.length ? `: ${typeParts.join(":").trim()}` : "";

  if (name.endsWith("?")) {
    name = name.slice(0, -1);
    rest = `?${rest}`;
  }

  return { name, rest };
}

function collapseRows(groups: RowGroup[], expanded: boolean): CardView {
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  // +1: a single extra row is just shown, since "+1 more" would take the same space.
  const collapsible = total > COLLAPSED_ROWS + 1;
  const body: CardBody = { kind: "rows", groups: collapsible && !expanded ? takeRows(groups, COLLAPSED_ROWS) : groups };

  if (groups.length === 0) return { body: { kind: "none" } };

  return {
    body,
    ...(collapsible ? { collapse: { hidden: expanded ? 0 : total - COLLAPSED_ROWS, noun: "more" } } : {}),
  };
}

function collapseChips(items: string[], expanded: boolean): CardView {
  if (items.length === 0) return { body: { kind: "none" } };

  const collapsible = items.length > COLLAPSED_CHIPS + 1;
  const shown = collapsible && !expanded ? items.slice(0, COLLAPSED_CHIPS) : items;

  return {
    body: { kind: "chips", items: shown },
    ...(collapsible ? { collapse: { hidden: items.length - shown.length, noun: "more" } } : {}),
  };
}

/** The first `limit` rows, keeping group boundaries. */
function takeRows(groups: RowGroup[], limit: number): RowGroup[] {
  const out: RowGroup[] = [];
  let left = limit;

  for (const g of groups) {
    if (left <= 0) break;
    out.push({ ...g, rows: g.rows.slice(0, left) });
    left -= g.rows.length;
  }

  return out;
}

const LITERAL = /^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|-?\d[\d_.]*n?|true|false|null|undefined)$/;

function isLiteral(text: string): boolean {
  return LITERAL.test(text);
}

function nonEmpty(parts: string[]): string[] {
  return parts.map((p) => p.trim()).filter((p) => p !== "");
}

const OPEN = "([{<";
const CLOSE = ")]}>";

/**
 * Splits `text` on `sep` where it is not nested in brackets, angle brackets
 * or string literals. `=>` is not a closing angle bracket.
 */
export function splitTopLevel(text: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;

    if (c === '"' || c === "'" || c === "`") {
      i = skipString(text, i);
    } else if (OPEN.includes(c)) {
      depth++;
    } else if (CLOSE.includes(c) && !(c === ">" && text[i - 1] === "=")) {
      depth = Math.max(0, depth - 1);
    } else if (c === sep && depth === 0 && !(sep === "?" && isOptionalMarker(text, i))) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));

  return parts;
}

/** Index of the bracket closing the one at `open`. */
function closingBracket(text: string, open: number): number {
  let depth = 0;

  for (let i = open; i < text.length; i++) {
    const c = text[i]!;

    if (c === '"' || c === "'" || c === "`") i = skipString(text, i);
    else if (OPEN.includes(c)) depth++;
    else if (CLOSE.includes(c) && !(c === ">" && text[i - 1] === "=")) {
      depth--;
      if (depth === 0) return i;
    }
  }

  return text.length - 1;
}

/** Index of the quote closing the string that starts at `i`. */
function skipString(text: string, i: number): number {
  const quote = text[i];

  for (let j = i + 1; j < text.length; j++) {
    if (text[j] === "\\") j++;
    else if (text[j] === quote) return j;
  }

  return text.length - 1;
}

/** `?.`, `??` and `x?:` are not the `?` of a conditional type. */
function isOptionalMarker(text: string, i: number): boolean {
  const next = text[i + 1];
  const prev = text[i - 1];

  return next === "." || next === "?" || prev === "?" || next === ":";
}
