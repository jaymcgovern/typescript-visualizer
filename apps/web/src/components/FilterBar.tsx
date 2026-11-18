import type { EdgeKind, NodeKind } from "@tsviz/graph";
import { NODE_KINDS } from "@tsviz/graph";
import { KIND_BADGE } from "../graph/declaration";
import { FAMILIES, type FilterHover, type Filters } from "../graph/filters";
import { REL_STYLES, type RelFamily } from "../graph/relationships";
import { EdgeSwatch } from "./EdgeMarkers";

interface Props {
  nodeCounts: Map<NodeKind, number>;
  /** Drawn edges per kind they are drawn as. */
  edgeCounts: Map<EdgeKind, number>;
  filters: Filters;
  onToggleKind: (kind: NodeKind) => void;
  onToggleFamily: (family: RelFamily) => void;
  onHover: (hover: FilterHover | undefined) => void;
  dropped?: { label: string; detail: string };
}

/**
 * The legend as a control: one chip per declaration kind and relationship
 * family in the graph. Click a chip to fade those out of the way; hover (or
 * focus) it to highlight them. The `?` explains the line styles.
 */
export function FilterBar({ nodeCounts, edgeCounts, filters, onToggleKind, onToggleFamily, onHover, dropped }: Props) {
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
        // Focusable so keyboard users can reach the explanation in its tooltip.
        <span className="filter-bar__dropped" tabIndex={0} title={dropped.detail}>
          {dropped.label}
        </span>
      )}

      <details className="filter-bar__help">
        <summary aria-label="How to read the graph" title="How to read the graph">
          ?
        </summary>
        <div className="filter-help">
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
