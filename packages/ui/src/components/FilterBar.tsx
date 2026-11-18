import type { EdgeKind, NodeKind } from "@tsviz/graph";
import { NODE_KINDS } from "@tsviz/graph";
import { KIND_BADGE } from "../graph/declaration.ts";
import { useId, useRef, useState } from "react";
import { FAMILIES, type DroppedGroup, type FilterHover, type Filters } from "../graph/filters.ts";
import { REL_STYLES, type RelFamily } from "../graph/relationships.ts";
import { EdgeSwatch } from "./EdgeMarkers.tsx";

interface Props {
  nodeCounts: Map<NodeKind, number>;
  /** Drawn edges per kind they are drawn as. */
  edgeCounts: Map<EdgeKind, number>;
  filters: Filters;
  onToggleKind: (kind: NodeKind) => void;
  onToggleFamily: (family: RelFamily) => void;
  onHover: (hover: FilterHover | undefined) => void;
  dropped?: { label: string; groups: DroppedGroup[] };
  /** Shows a declaration a dropped reference appears in: selects it and pans to it. */
  onGoTo: (id: string) => void;
}

/**
 * The legend as a control: one chip per declaration kind and relationship
 * family in the graph. Click a chip to fade those out of the way; hover (or
 * focus) it to highlight them. The `?` explains the line styles, and the
 * "not drawn" chip lists the references that have no line.
 */
export function FilterBar({
  nodeCounts,
  edgeCounts,
  filters,
  onToggleKind,
  onToggleFamily,
  onHover,
  dropped,
  onGoTo,
}: Props) {
  // Opening one of the bar's pop-ups closes the other (per canvas, so several canvases don't interfere).
  const popupGroup = useId();
  // The dropped list can be long, so it is only rendered while open.
  const droppedMenu = useRef<HTMLDetailsElement>(null);
  const [droppedOpen, setDroppedOpen] = useState(false);
  const families = FAMILIES.map((f) => ({ ...f, present: f.kinds.filter((k) => edgeCounts.has(k)) })).filter(
    (f) => f.present.length > 0,
  );
  const hoverProps = (hover: FilterHover) => ({
    onMouseEnter: () => onHover(hover),
    onMouseLeave: () => onHover(undefined),
    onFocus: () => onHover(hover),
    onBlur: () => onHover(undefined),
  });

  return (
    <div className="filter-bar" role="toolbar" aria-label="Show or fade declarations and relationships">
      <div className="filter-bar__group">
        {NODE_KINDS.filter((k) => nodeCounts.has(k)).map((kind) => {
          const shown = !filters.kinds.has(kind);
          const count = nodeCounts.get(kind)!;

          return (
            <button
              key={kind}
              type="button"
              className={`filter-chip decl--${kind}`}
              aria-pressed={shown}
              aria-label={`${kind}: ${count}`}
              title={`${count} ${kind}${count === 1 ? "" : "s"}. Click to ${shown ? "fade" : "show"}; hover to highlight.`}
              onClick={() => onToggleKind(kind)}
              {...hoverProps({ kind })}
            >
              <span className="card__badge">{KIND_BADGE[kind]}</span>
              <span className="filter-chip__count">{count}</span>
            </button>
          );
        })}
      </div>

      <span className="filter-bar__divider" aria-hidden="true" />

      <div className="filter-bar__group">
        {families.map(({ family, label, present }) => {
          const shown = !filters.families.has(family);
          const count = present.reduce((n, k) => n + edgeCounts.get(k)!, 0);

          return (
            <button
              key={family}
              type="button"
              className="filter-chip"
              aria-pressed={shown}
              aria-label={`${label} relationships: ${count}`}
              title={`${label}: ${present.join(", ")}. Click to ${shown ? "fade" : "show"}; hover to highlight.`}
              onClick={() => onToggleFamily(family)}
              {...hoverProps({ family })}
            >
              <span className="filter-chip__swatches">
                {present.map((k) => (
                  <EdgeSwatch key={k} kind={k} width={22} />
                ))}
              </span>
              <span className="filter-chip__label">{label}</span>
              <span className="filter-chip__count">{count}</span>
            </button>
          );
        })}
      </div>

      {dropped && (
        <details
          ref={droppedMenu}
          className="filter-bar__menu"
          name={popupGroup}
          onToggle={(e) => setDroppedOpen(e.currentTarget.open)}
        >
          <summary className="filter-bar__dropped">{dropped.label}</summary>
          {droppedOpen && (
            <div className="filter-popup dropped-list nowheel">
              <p>These references have no line, so a missing line does not prove two declarations are unrelated.</p>
              {dropped.groups.map((group) => {
                const listed = group.items.reduce((sum, item) => sum + item.count, 0);

                return (
                  <section key={group.reason}>
                    <h3>
                      {group.title} <span className="dropped-list__count">{group.count}</span>
                    </h3>
                    <p className="dropped-list__hint">{group.hint}</p>
                    <ul>
                      {group.items.map((item) => (
                        <li key={`${item.name}\n${item.origin ?? ""}`} className="dropped-list__item">
                          <div className="dropped-list__head">
                            <code className="dropped-list__name">{item.name}</code>
                            {item.count > 1 && <span className="dropped-list__times">×{item.count}</span>}
                            {item.origin && <span className="dropped-list__origin">{item.origin}</span>}
                          </div>
                          <div className="dropped-list__sites">
                            {item.sites.map((site) => (
                              <button
                                key={`${site.from}:${site.line}`}
                                type="button"
                                className="dropped-list__site"
                                title={`Go to ${site.from}`}
                                onClick={() => {
                                  if (droppedMenu.current) droppedMenu.current.open = false;
                                  onGoTo(site.from);
                                }}
                              >
                                in {site.fromName} · line {site.line}
                              </button>
                            ))}
                            {item.count > item.sites.length && (
                              <span className="dropped-list__more">and {item.count - item.sites.length} more</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                    {group.count > listed && (
                      <p className="dropped-list__hint">
                        {group.count - listed} more not listed: re-extract the graph to see them all.
                      </p>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </details>
      )}

      <details className="filter-bar__menu filter-bar__help" name={popupGroup}>
        <summary aria-label="How to read the graph" title="How to read the graph">
          ?
        </summary>
        <div className="filter-popup filter-help">
          <p>Arrows point from a declaration to what it uses. Colour is the family; the dash tells kinds apart.</p>
          {families.map(({ family, label, present }) => (
            <div key={family} className="filter-help__family">
              <h3>{label}</h3>
              <ul>
                {present.map((k) => (
                  <li key={k}>
                    <EdgeSwatch kind={k} />
                    <span className="filter-help__kind">{k}</span>
                    <span className="filter-help__meaning">{REL_STYLES[k].meaning}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p>
            Click a chip to fade those out of the way; hover it to highlight them. Click a line to see every
            relationship it stands for.
          </p>
        </div>
      </details>
    </div>
  );
}
