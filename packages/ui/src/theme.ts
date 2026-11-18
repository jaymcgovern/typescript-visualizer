import type { CSSProperties } from "react";

/** `"auto"` follows the user's system preference. */
export type ColorScheme = "light" | "dark" | "auto";

/**
 * The design tokens GraphCanvas reads, by theme key. Each is a CSS custom
 * property on the `.tsviz` root, so it can also be set from a stylesheet.
 */
export const THEME_TOKENS = {
  fontSans: "--tsviz-font-sans",
  fontMono: "--tsviz-font-mono",

  bg: "--tsviz-bg",
  fg: "--tsviz-fg",
  muted: "--tsviz-muted",
  surface: "--tsviz-surface",
  border: "--tsviz-border",
  errorBg: "--tsviz-error-bg",
  errorFg: "--tsviz-error-fg",
  warnBg: "--tsviz-warn-bg",
  warnFg: "--tsviz-warn-fg",

  cardBg: "--tsviz-card-bg",
  /** How much of the kind colour tints a card's header, e.g. `"10%"`. */
  headTint: "--tsviz-head-tint",

  /** One hue per declaration kind. */
  kindInterface: "--tsviz-kind-interface",
  kindClass: "--tsviz-kind-class",
  kindType: "--tsviz-kind-type",
  kindEnum: "--tsviz-kind-enum",
  kindFunction: "--tsviz-kind-function",
  kindVariable: "--tsviz-kind-variable",
  kindNamespace: "--tsviz-kind-namespace",
  kindExternal: "--tsviz-kind-external",

  /** One hue per relationship family. */
  relInherit: "--tsviz-rel-inherit",
  relStructure: "--tsviz-rel-structure",
  relSignature: "--tsviz-rel-signature",
  relComposition: "--tsviz-rel-composition",
  relReference: "--tsviz-rel-reference",
} as const;

export type ThemeToken = keyof typeof THEME_TOKENS;

/**
 * Token overrides. Values are any CSS value for that property; colours may use
 * `light-dark(<light>, <dark>)` to differ by colour scheme.
 */
export type TsvizTheme = Partial<Record<ThemeToken, string>>;

/** Inline style that applies `theme` to the `.tsviz` root. */
export function themeStyle(theme: TsvizTheme | undefined): CSSProperties | undefined {
  if (!theme) return undefined;

  const style: Record<string, string> = {};

  for (const [key, value] of Object.entries(theme)) {
    if (value !== undefined && key in THEME_TOKENS) style[THEME_TOKENS[key as ThemeToken]] = value;
  }

  return style as CSSProperties;
}
