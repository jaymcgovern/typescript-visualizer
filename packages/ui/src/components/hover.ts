import { createContext } from "react";
import type { SourceParts } from "../graph/edgeDetail.ts";
import type { HoverTarget } from "../graph/highlight.ts";

export interface CardActions {
  /** Reports what the pointer is over; the canvas turns it into highlights. */
  setHover: (hover: HoverTarget | undefined) => void;
  /**
   * Selects a declaration and centres it, at the current zoom unless
   * `zoomIn` is set and the view is too far out to read the card.
   */
  focus: (id: string, options?: { zoomIn?: boolean }) => void;
}

export const CardActionsContext = createContext<CardActions>({ setHover: () => {}, focus: () => {} });

/** The parts of one card a selected edge comes from, which that card lights up. */
export const LitPartsContext = createContext<{ node: string; parts: SourceParts } | undefined>(undefined);
