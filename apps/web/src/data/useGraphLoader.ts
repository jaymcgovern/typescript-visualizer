import { useCallback, useEffect, useRef, useState } from "react";
import { GraphLoadError, initialGraphUrl, loadGraphFromFile, loadGraphFromUrl, type LoadedGraph } from "./loadGraph";

/** A successfully loaded graph; `loadId` changes on every load, even of the same source. */
export interface Shown {
  loaded: LoadedGraph;
  loadId: number;
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

  const run = useCallback((source: string, load: () => Promise<LoadedGraph>) => {
    const gen = ++generation.current;

    setState({ status: "loading", source, previous: current.current });
    load().then(
      (loaded) => {
        if (gen !== generation.current) return;
        current.current = { loaded, loadId: gen };
        setState({ status: "ready", loaded, loadId: gen });
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
    loadUrl(initialGraphUrl());
  }, [loadUrl]);

  return { state, loadUrl, loadFile, dismissError };
}
