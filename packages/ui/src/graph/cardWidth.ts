/** How far an element's content overflows its box, as `scrollWidth` and `clientWidth` report it. */
export type Overflow = { scrollWidth: number; clientWidth: number };

/** The widths a card can be resized between: as first drawn, and wide enough to show every line in full. */
export type WidthRange = { min: number; max: number };

/**
 * The width range of a card that is `width` wide, given the truncating parts
 * of each line of text (a header's name and type, a heritage line, a member
 * row's name and type). A line needs the card to grow by what all its parts
 * together lack; the widest line sets the maximum. `min` is the
 * card's width before anyone resized it, kept from `previous` once it has been.
 */
export function widthRange(width: number, lines: Overflow[][], resized: boolean, previous?: WidthRange): WidthRange {
  const lacking = Math.max(0, ...lines.map((parts) => parts.reduce((sum, p) => sum + lacks(p), 0)));
  const min = resized && previous ? previous.min : width;

  return { min, max: Math.max(min, Math.ceil(width + lacking)) };
}

/** Whether any line is cut off at the card's original width, so it is worth resizing. */
export function canWiden(range: WidthRange | undefined): range is WidthRange {
  return range !== undefined && range.max > range.min;
}

/**
 * What a part needs to show in full. Both widths are rounded to whole pixels,
 * and text a fraction of a pixel too wide still gets an ellipsis, so a cut-off
 * part gets one pixel more.
 */
function lacks({ scrollWidth, clientWidth }: Overflow): number {
  return scrollWidth > clientWidth ? scrollWidth - clientWidth + 1 : 0;
}
