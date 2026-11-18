/**
 * How much of a card is drawn at a zoom level. Every level keeps the full
 * card's box, so changing level never changes a node's measured size and
 * never triggers a relayout.
 *
 * - full: everything
 * - outline: a larger name; the rest of the text drawn as bars of the same length
 * - overview: only the kind and the name, sized to fill the card
 */
export type Detail = "full" | "outline" | "overview";

/** Lowest zoom at which each level is used. */
export const DETAIL_MIN_ZOOM = { full: 0.6, outline: 0.3 } as const;

export function detailAt(zoom: number): Detail {
  if (zoom >= DETAIL_MIN_ZOOM.full) return "full";
  if (zoom >= DETAIL_MIN_ZOOM.outline) return "outline";

  return "overview";
}
