import { GraphLoadError, parseGraph, type LoadedGraph } from "@tsviz/graph";

export { GraphLoadError, parseGraph, type LoadedGraph };

export async function loadGraphFromUrl(url: string, fetchImpl: typeof fetch = fetch): Promise<LoadedGraph> {
  let res: Response;

  try {
    res = await fetchImpl(url);
  } catch (err) {
    throw new GraphLoadError(`${url}: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) throw new GraphLoadError(`${url}: HTTP ${res.status} ${res.statusText}`.trim());

  return parseGraph(parseJson(await res.text(), url), url);
}

export async function loadGraphFromFile(file: File): Promise<LoadedGraph> {
  return parseGraph(parseJson(await file.text(), file.name), file.name);
}

/** `?graph=<url>` if present, otherwise the bundled sample. */
export function initialGraphUrl(search: string = window.location.search): string {
  return new URLSearchParams(search).get("graph") || "/graph.json";
}

/** `?focus=<declaration id>`: the card to zoom in on when the initial graph loads. */
export function initialFocusId(search: string = window.location.search): string | undefined {
  return new URLSearchParams(search).get("focus") || undefined;
}

function parseJson(text: string, source: string): unknown {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new GraphLoadError(`${source}: invalid JSON (${err instanceof Error ? err.message : String(err)})`);
  }
}
