import { useStore } from "@xyflow/react";
import type { GraphNode } from "@tsviz/graph";
import { KIND_BADGE } from "../graph/declaration.ts";
import { relationshipItems } from "../graph/edgeDetail.ts";
import { REL_STYLES, type Relationship } from "../graph/relationships.ts";
import type { XY } from "../layout/elkGraph.ts";
import { EdgeSwatch } from "./EdgeMarkers.tsx";

interface Props {
  rel: Relationship;
  source: GraphNode;
  target: GraphNode;
  /** Where the edge was clicked, in flow coordinates: the popover follows it as the view moves. */
  anchor: XY;
  onClose: () => void;
  onGoTo: (id: string) => void;
}

/**
 * What a selected edge stands for: one line per graph edge behind it (a drawn
 * edge merges every relationship between two declarations), each with the
 * member or clause it comes from and its source line.
 */
export function RelationshipPopover({ rel, source, target, anchor, onClose, onGoTo }: Props) {
  // Screen position from the viewport transform, so the popover keeps its size at any zoom.
  const [tx, ty, zoom] = useStore((s) => s.transform);
  const items = relationshipItems(source, rel);

  return (
    <section
      className="rel-popover nopan nowheel nodrag"
      style={{ left: anchor.x * zoom + tx, top: anchor.y * zoom + ty }}
      aria-label={`Relationship from ${source.name} to ${target.name}`}
    >
      <header className="rel-popover__ends">
        <End decl={source} onGoTo={onGoTo} />
        <span className="rel-popover__arrow" aria-hidden="true">
          →
        </span>
        <End decl={target} onGoTo={onGoTo} />
        <button type="button" className="rel-popover__close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>
      <ul className="rel-popover__items">
        {items.map(({ edge, via, location }, i) => (
          <li key={i} className="rel-popover__item" title={REL_STYLES[edge.kind].meaning}>
            <EdgeSwatch kind={edge.kind} />
            <span className="rel-popover__kind">{edge.kind}</span>
            <code className="rel-popover__via" title={via}>
              {via ?? edge.label ?? ""}
            </code>
            {location && (
              <span className="rel-popover__location" title={location}>
                {location.slice(location.lastIndexOf("/") + 1)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function End({ decl, onGoTo }: { decl: GraphNode; onGoTo: (id: string) => void }) {
  return (
    <button
      type="button"
      className={`rel-popover__end decl--${decl.kind}`}
      title={`Go to ${decl.name}`}
      onClick={() => onGoTo(decl.id)}
    >
      <span className="card__badge">{KIND_BADGE[decl.kind]}</span>
      {decl.name}
    </button>
  );
}
