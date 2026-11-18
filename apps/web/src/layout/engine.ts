import ELK, { type ELK as ElkApi } from "elkjs/lib/elk-api.js";
import workerUrl from "elkjs/lib/elk-worker.min.js?url";
import { readLayout, toElkGraph, type Direction, type LayoutInput, type LayoutResult } from "./elkGraph";

let elk: ElkApi | undefined;

/** One shared ELK instance; its worker starts on first use and keeps layout off the main thread. */
function getElk(): ElkApi {
  elk ??= new ELK({ workerUrl });

  return elk;
}

export interface RunLayoutOptions {
  /** Defaults to the shared worker-backed instance. */
  engine?: ElkApi;
  /** Edge label sizes; defaults to a character-count estimate. */
  measureLabel?: (text: string) => { width: number; height: number };
}

export async function runLayout(
  input: LayoutInput,
  direction: Direction,
  { engine = getElk(), measureLabel }: RunLayoutOptions = {},
): Promise<LayoutResult> {
  const laidOut = await engine.layout(toElkGraph(input, direction, measureLabel));

  return readLayout(laidOut, direction);
}
