import { estimateLabelSize } from "./elkGraph.ts";

/** Must match the size of `.react-flow__edge-text` in styles.css. */
const EDGE_LABEL_SIZE = "10px";
/** The default of `--tsviz-font-sans`. */
const DEFAULT_FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const EDGE_LABEL_FONT = `${EDGE_LABEL_SIZE} ${DEFAULT_FONT_FAMILY}`;

/** The edge label font as rendered inside `root`, which may override `--tsviz-font-sans`. */
export function edgeLabelFont(root: Element | null): string {
  const family = root ? getComputedStyle(root).fontFamily : "";

  return `${EDGE_LABEL_SIZE} ${family || DEFAULT_FONT_FAMILY}`;
}
/** Horizontal and vertical padding of the label background (ElkEdge's `labelBgPadding`). */
export const EDGE_LABEL_PADDING = [4, 2] as const;
const LINE_HEIGHT = 12;

/**
 * Measures edge labels with a canvas so ELK reserves the space they really
 * take. Falls back to the character-count estimate without a 2D context.
 */
export function createLabelMeasurer(font = EDGE_LABEL_FONT): (text: string) => { width: number; height: number } {
  const ctx = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");

  if (!ctx) return estimateLabelSize;
  ctx.font = font;

  const [padX, padY] = EDGE_LABEL_PADDING;
  const cache = new Map<string, { width: number; height: number }>();

  return (text) => {
    let size = cache.get(text);

    if (!size) {
      size = { width: Math.ceil(ctx.measureText(text).width) + 2 * padX, height: LINE_HEIGHT + 2 * padY };
      cache.set(text, size);
    }

    return size;
  };
}
