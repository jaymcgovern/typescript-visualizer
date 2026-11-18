/**
 * React components for drawing a `@tsviz/graph` declaration graph.
 *
 * Import the styles once, after React Flow's:
 *   import "@xyflow/react/dist/style.css";
 *   import "@tsviz/ui/styles.css";
 */
export { GraphCanvas, type GraphCanvasProps } from "./components/GraphCanvas.tsx";
export type { Direction } from "./layout/direction.ts";
export { THEME_TOKENS, themeStyle, type ColorScheme, type ThemeToken, type TsvizTheme } from "./theme.ts";
