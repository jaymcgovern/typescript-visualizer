import { useCallback, useEffect, useRef, useState } from "react";
import { GraphLoadError, initialGraphUrl, loadGraphFromFile, loadGraphFromUrl, type LoadedGraph } from "./loadGraph";

/**
 * A successfully loaded graph; `loadId` changes on every load, even of the same
 * source. `initial` marks the graph loaded at startup (`?graph=` or the sample).
 */
export interface Shown {
  loaded: LoadedGraph;
  loadId: number;
  initial: boolean;
}

export type LoadState =
  | { status: "loading"; source: string; previous?: Shown }
  | { status: "error"; message: string; previous?: Shown }
  | ({ status: "ready" } & Shown);

/**
 * Loads the initial graph (`?graph=` or the sample) and exposes loaders for
 * files and URLs. A failed load keeps the previously shown graph available.
 */
export function useGraphLoader() {
  const [state, setState] = useState<LoadState>(() => ({ status: "loading", source: initialGraphUrl() }));
  const current = useRef<Shown | undefined>(undefined);
  // Ignores results from a load that a newer one has superseded.
  const generation = useRef(0);

  const run = useCallback((source: string, load: () => Promise<LoadedGraph>, initial = false) => {
    const gen = ++generation.current;

    setState({ status: "loading", source, previous: current.current });
    load().then(
      (loaded) => {
        if (gen !== generation.current) return;
        current.current = { loaded, loadId: gen, initial };
        setState({ status: "ready", ...current.current });
      },
      (err: unknown) => {
        if (gen !== generation.current) return;
        const message = err instanceof GraphLoadError ? err.message : `${source}: ${String(err)}`;
        setState({ status: "error", message, previous: current.current });
      },
    );
  }, []);

  const loadUrl = useCallback((url: string) => run(url, () => loadGraphFromUrl(url)), [run]);
  const loadFile = useCallback((file: File) => run(file.name, () => loadGraphFromFile(file)), [run]);
  const dismissError = useCallback(() => {
    if (current.current) setState({ status: "ready", ...current.current });
  }, []);

  useEffect(() => {
    const url = initialGraphUrl();

    run(url, () => loadGraphFromUrl(url), true);
  }, [run]);

  return { state, loadUrl, loadFile, dismissError };
}
