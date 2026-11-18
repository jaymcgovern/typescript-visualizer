import { estimateLabelSize } from "./elkGraph";

/** Must match `.react-flow__edge-text` in styles.css. */
export const EDGE_LABEL_FONT = '10px system-ui, -apple-system, "Segoe UI", sans-serif';
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
