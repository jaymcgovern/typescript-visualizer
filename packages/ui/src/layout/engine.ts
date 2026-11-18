import type { ELK as ElkApi, ELKConstructorArguments } from "elkjs/lib/elk-api.js";
import { readLayout, toElkGraph, type Direction, type LayoutInput, type LayoutResult } from "./elkGraph.ts";

type ElkConstructor = new (args?: ELKConstructorArguments) => ElkApi;

/**
 * elkjs is CommonJS, so a dynamic import's `default` is `module.exports` in
 * Node and some bundlers but `exports.default` in others. It sets
 * `ELK.default = ELK`, so either way this finds the constructor.
 */
function elkConstructor(mod: { default: unknown }): ElkConstructor {
  const d = mod.default as ElkConstructor & { default?: ElkConstructor };

  return d.default ?? d;
}

const engines = new Map<string, Promise<ElkApi>>();

/**
 * One shared ELK instance per worker URL. With a URL, layout runs in that
 * worker; without one, ELK is loaded lazily and runs on the main thread, which
 * needs no bundler setup but can stall the page on large graphs.
 */
function getElk(workerUrl: string | undefined): Promise<ElkApi> {
  const key = workerUrl ?? "";
  let engine = engines.get(key);

  if (!engine) {
    engine = workerUrl
      ? import("elkjs/lib/elk-api.js").then((m) => new (elkConstructor(m))({ workerUrl }))
      : import("elkjs/lib/elk.bundled.js").then((m) => new (elkConstructor(m))());
    engines.set(key, engine);
  }

  return engine;
}

export interface RunLayoutOptions {
  /** Defaults to the shared instance for `workerUrl`. */
  engine?: ElkApi;
  /** URL of `elkjs/lib/elk-worker.min.js`, to run layout off the main thread. */
  workerUrl?: string;
  /** Edge label sizes; defaults to a character-count estimate. */
  measureLabel?: (text: string) => { width: number; height: number };
}

export async function runLayout(
  input: LayoutInput,
  direction: Direction,
  { engine, workerUrl, measureLabel }: RunLayoutOptions = {},
): Promise<LayoutResult> {
  const elk = engine ?? (await getElk(workerUrl));
  const laidOut = await elk.layout(toElkGraph(input, direction, measureLabel));

  return readLayout(laidOut, direction);
}
