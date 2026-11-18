import { EDGE_KINDS, type EdgeKind } from "@tsviz/graph";
import { markerId, REL_STYLES, type MarkerShape } from "../graph/relationships";

/** Paths in a 12×12 box pointing right; fill and stroke come from `.marker--<shape>` in CSS. */
const SHAPES: Record<MarkerShape, string> = {
  // UML generalization / realization.
  "triangle-hollow": "M1,1 L11,6 L1,11 Z",
  arrow: "M2,2.5 L11,6 L2,9.5 Z",
  vee: "M2,2 L11,6 L2,10",
};

/**
 * One `<marker>` per edge kind, referenced by id from each edge's `markerEnd`.
 * Colours come from CSS (`.rel-family--<family>`) so they follow the theme.
 */
export function EdgeMarkers() {
  return (
    <svg className="edge-markers" aria-hidden="true">
      <defs>
        {EDGE_KINDS.map((kind) => (
          <Marker key={kind} kind={kind} />
        ))}
      </defs>
    </svg>
  );
}

function Marker({ kind }: { kind: EdgeKind }) {
  const style = REL_STYLES[kind];

  return (
    <marker
      id={markerId(kind)}
      className={`marker marker--${style.marker} rel-family--${style.family}`}
      viewBox="0 0 12 12"
      refX={11}
      refY={6}
      markerWidth={12}
      markerHeight={12}
      markerUnits="userSpaceOnUse"
      orient="auto-start-reverse"
    >
      <path d={SHAPES[style.marker]} strokeLinejoin="round" strokeLinecap="round" />
    </marker>
  );
}

/** A short sample of an edge kind's line and marker, for the filter bar and its help. */
export function EdgeSwatch({ kind, width = 40 }: { kind: EdgeKind; width?: number }) {
  const style = REL_STYLES[kind];

  return (
    <svg
      className={`swatch rel-family--${style.family}`}
      width={width}
      height={(width * 12) / 40}
      viewBox="0 0 40 12"
      aria-hidden="true"
    >
      <path
        className="swatch__line"
        d="M1,6 L36,6"
        strokeDasharray={style.dash}
        markerEnd={`url(#${markerId(kind)})`}
      />
    </svg>
  );
}
