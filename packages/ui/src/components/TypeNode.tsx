import { Handle, Position, useReactFlow, useStore, type NodeProps } from "@xyflow/react";
import { memo, useContext, useMemo, type CSSProperties } from "react";
import { cardView, type BodyRow } from "../graph/cardBody.ts";
import { codeSpans, docSummary, KIND_BADGE } from "../graph/declaration.ts";
import { detailAt } from "../graph/detail.ts";
import type { HoverTarget } from "../graph/highlight.ts";
import { splitRefs, type Ref } from "../graph/refs.ts";
import { assignPorts, IN_HANDLE, MORE_HANDLE, OUT_HANDLE, rowHandle } from "../graph/ports.ts";
import { REL_STYLES, type RelFamily } from "../graph/relationships.ts";
import type { DeclNode } from "../graph/toFlow.ts";
import { CardActionsContext, LitPartsContext } from "./hover.ts";

/**
 * A declaration card: a header tinted by kind (badge, name, type parameters,
 * heritage), the first sentence of its doc comment, then a body that
 * depends on the kind (see `cardView`): grouped members, union variants, enum
 * chips, or one block per function overload.
 * The main handles are invisible anchors for edges; a row that starts an
 * edge gets a visible one (a port), coloured like that edge. Nodes are not connectable.
 *
 * Zoomed out, the same box is drawn with less detail (see `detailAt`): the
 * full card stays in the DOM and sets the size, so changing level never
 * changes a node's size.
 */
export const TypeNode = memo(function TypeNode({ id, data, sourcePosition, targetPosition }: NodeProps<DeclNode>) {
  const { decl, degree, out, refs, expanded = false } = data;
  const { updateNodeData } = useReactFlow<DeclNode>();
  // Re-renders only when the zoom crosses a level, not on every zoom step.
  const detail = useStore((s) => detailAt(s.transform[2]));
  const { setHover, focus } = useContext(CardActionsContext);
  // The parts of this card a selected edge comes from.
  const litContext = useContext(LitPartsContext);
  const lit = litContext?.node === id ? litContext.parts : undefined;
  // Type names link to the declarations this card has edges to; only at full detail, where text is drawn.
  const linksFrom = (hover: HoverTarget): Links | undefined =>
    detail === "full" ? { refs, focus, hover: (target) => setHover(target ? { ...hover, target } : hover) } : undefined;
  const view = cardView(decl, expanded);
  const typeParams = decl.typeParams?.length && decl.kind !== "function" ? `<${decl.typeParams.join(", ")}>` : "";
  const location = decl.file ? `${decl.file}:${decl.line ?? ""}` : undefined;
  const counts = `${degree.in} in · ${degree.out} out`;
  const countsTitle = `Used by ${plural(degree.in, "declaration")}; uses ${degree.out}`;
  // Variables and externals stay one row high; their location and counts move to the header tooltip.
  const footer = decl.kind !== "variable" && decl.kind !== "external";
  const headerTitle = footer ? location : [location ?? decl.origin, countsTitle].filter(Boolean).join("\n");
  const { body, collapse } = view;
  // Ports are drawn in both layouts; only `RIGHT` routes edges from them (see sourceHandles).
  const ports = useMemo(() => portFamilies(assignPorts(decl, expanded, out), out), [decl, expanded, out]);
  const rowOffsets = body.kind === "rows" ? offsets(body.groups.map((g) => g.rows.length)) : [];
  const summary = docSummary(decl.doc);
  const classes = [
    "card",
    `card--${decl.kind}`,
    decl.exported ? "" : "card--local",
    summary ? "card--doc" : "",
    `card--${detail}`,
  ];

  return (
    <div
      className={classes.filter(Boolean).join(" ")}
      onMouseEnter={() => setHover({ node: id })}
      onMouseLeave={() => setHover(undefined)}
    >
      <Handle id={IN_HANDLE} type="target" position={targetPosition!} isConnectable={false} />
      {/* Name and heritage share the kind tint, so kind reads at a glance. */}
      <div className="card__head">
        <header className="card__header" title={headerTitle}>
          <span className="card__badge">{KIND_BADGE[decl.kind]}</span>
          <span className="card__name">
            {decl.name}
            {typeParams && <span className="card__tparams">{typeParams}</span>}
          </span>
          {view.inline && (
            <span className="card__inline" title={view.inline}>
              <RefText text={view.inline} links={linksFrom({ node: id })} />
            </span>
          )}
          {!decl.exported && decl.kind !== "external" && <span className="card__tag">local</span>}
        </header>

        {view.heritage && (
          <div className={`card__heritage${lit?.heritage ? " is-lit" : ""}`} title={view.heritage}>
            <span className="card__text">
              <RefText text={view.heritage} links={linksFrom({ node: id })} />
            </span>
          </div>
        )}
        {decl.kind === "external" && decl.origin && (
          <div className="card__heritage">
            <span className="card__text">{decl.origin}</span>
          </div>
        )}
      </div>

      {summary && (
        <p className="card__doc" title={decl.doc}>
          <span className="card__text">
            {codeSpans(summary).map((span, i) => (span.code ? <code key={i}>{span.text}</code> : span.text))}
          </span>
        </p>
      )}

      {body.kind === "rows" &&
        body.groups.map((group, g) => (
          <ul key={g} className="card__body">
            {group.label && <li className="card__group-label">{group.label}</li>}
            {group.rows.map((row, i) => (
              <Row
                key={i}
                row={row}
                port={portAt(ports, rowHandle(rowOffsets[g]! + i))}
                lit={lit?.rows.has(rowHandle(rowOffsets[g]! + i))}
                // Rows are only told apart at full detail; zoomed out, the whole card is hovered.
                onEnter={detail === "full" ? () => setHover({ node: id, row }) : undefined}
                onLeave={detail === "full" ? () => setHover({ node: id }) : undefined}
                links={linksFrom({ node: id, row })}
              />
            ))}
          </ul>
        ))}
      {body.kind === "chips" && (
        <ul className="card__chips">
          {body.items.map((item, i) => (
            <li key={i} className="card__chip">
              {item}
            </li>
          ))}
        </ul>
      )}
      {collapse && (
        <div className={`card__more-row${lit?.rows.has(MORE_HANDLE) ? " is-lit" : ""}`}>
          <button
            type="button"
            className="card__more nodrag"
            onClick={() => updateNodeData(id, { expanded: !expanded })}
          >
            {collapse.hidden > 0 ? `+${collapse.hidden} ${collapse.noun}` : "Show fewer"}
          </button>
          <Port port={portAt(ports, MORE_HANDLE)} />
        </div>
      )}
      {footer && (
        <footer className="card__footer">
          <span className="card__counts" title={countsTitle}>
            {counts}
          </span>
          {location && (
            <span className="card__location" title={location}>
              {/* Only the directory gives way, from its start; the inner span keeps the text ltr. */}
              <span className="card__dir">
                <span dir="ltr">{location.slice(0, location.lastIndexOf("/") + 1)}</span>
              </span>
              <span className="card__file">{location.slice(location.lastIndexOf("/") + 1)}</span>
            </span>
          )}
        </footer>
      )}
      {detail === "overview" && (
        // Over the hidden card; --tsviz-chars sizes the name to fit the width.
        <div className="card__overview" style={{ "--tsviz-chars": Math.max(decl.name.length, 4) } as CSSProperties}>
          <span className="card__badge">{KIND_BADGE[decl.kind]}</span>
          <span className="card__overview-name">{decl.name}</span>
        </div>
      )}
      <Handle id={OUT_HANDLE} type="source" position={sourcePosition!} isConnectable={false} />
    </div>
  );
});

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

type PortInfo = { id: string; family: RelFamily };

/** Each port handle's colour: the family of the first relationship leaving from it. */
function portFamilies(handles: Map<string, string>, out: DeclNode["data"]["out"]): Map<string, RelFamily> {
  const families = new Map<string, RelFamily>();

  for (const rel of out) {
    const handle = handles.get(rel.target);

    if (handle && handle !== OUT_HANDLE && !families.has(handle)) families.set(handle, REL_STYLES[rel.kind].family);
  }

  return families;
}

function portAt(ports: Map<string, RelFamily>, id: string): PortInfo | undefined {
  const family = ports.get(id);

  return family ? { id, family } : undefined;
}

/** Running totals: the index of each group's first row among all rows. */
function offsets(lengths: number[]): number[] {
  let total = 0;

  return lengths.map((n) => {
    const start = total;

    total += n;

    return start;
  });
}

function Port({ port }: { port: PortInfo | undefined }) {
  if (!port) return null;

  return (
    <Handle
      id={port.id}
      type="source"
      position={Position.Right}
      isConnectable={false}
      className={`card__port rel-family--${port.family}`}
    />
  );
}

/** What linked type names need: the targets, and what hovering or clicking one does. */
type Links = { refs: Ref[]; hover: (target: string | undefined) => void; focus: (id: string) => void };

/** Type text with the names of related declarations as buttons, coloured by their kind. */
function RefText({ text, links }: { text: string; links: Links | undefined }) {
  if (!links) return text;

  return splitRefs(text, links.refs).map((part, i) =>
    typeof part === "string" ? (
      part
    ) : (
      <button
        key={i}
        type="button"
        // decl--<kind> sets --kind-color to the target's kind.
        className={`card__ref decl--${part.ref.kind} nodrag`}
        title={`Go to ${part.ref.name}`}
        onMouseEnter={() => links.hover(part.ref.id)}
        onMouseLeave={() => links.hover(undefined)}
        onClick={(e) => {
          // React Flow would otherwise select this card on the same click.
          e.stopPropagation();
          links.focus(part.ref.id);
        }}
      >
        {part.text}
      </button>
    ),
  );
}

function Row({
  row,
  port,
  onEnter,
  onLeave,
  links,
  lit,
}: {
  row: BodyRow;
  port?: PortInfo;
  /** A selected edge comes from this row. */
  lit?: boolean;
  onEnter?: () => void;
  onLeave?: () => void;
  links?: Links;
}) {
  const text = `${row.op ? `${row.op} ` : ""}${row.name ?? ""}${row.rest}`;

  return (
    <li
      className={`card__line${row.muted ? " card__line--muted" : ""}${lit ? " is-lit" : ""}`}
      title={text}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {row.op && <span className="card__op">{row.op}</span>}
      {row.name && <span className="card__member">{row.name}</span>}
      <span className="card__rest">
        <RefText text={row.rest} links={links} />
      </span>
      <Port port={port} />
    </li>
  );
}
