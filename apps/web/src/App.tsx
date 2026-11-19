import { useRef, useState, type DragEvent } from "react";
import { GraphCanvas, type Direction } from "@tsviz/ui";
import elkWorkerUrl from "elkjs/lib/elk-worker.min.js?url";
import { initialFocusId } from "./data/loadGraph";
import { useGraphLoader } from "./data/useGraphLoader";

export function App() {
  const { state, loadUrl, loadFile, dismissError } = useGraphLoader();
  const [dragging, setDragging] = useState(false);
  const [direction, setDirection] = useState<Direction>("DOWN");
  const fileInput = useRef<HTMLInputElement>(null);
  // Depth counter: dragenter/dragleave also fire for child elements.
  const dragDepth = useRef(0);

  const shown = state.status === "ready" ? state : state.previous;

  const onDragEnter = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    dragDepth.current++;
    setDragging(true);
  };
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  };

  return (
    <div
      className="app"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <header className="toolbar">
        <h1>TypeScript Visualizer</h1>
        {shown && (
          <span className="toolbar__info" title={shown.loaded.graph.meta.root}>
            {shown.loaded.source} · {shown.loaded.graph.nodes.length} declarations · {shown.loaded.graph.edges.length}{" "}
            relationships · {shown.loaded.graph.meta.files.length} files
          </span>
        )}
        <span className="toolbar__spacer" />
        <label className="toolbar__field">
          Layout
          <select value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
            <option value="DOWN">Top to bottom</option>
            <option value="RIGHT">Left to right</option>
          </select>
        </label>
        <button type="button" onClick={() => loadUrl("/graph.json")}>
          Load sample
        </button>
        <button type="button" onClick={() => fileInput.current?.click()}>
          Open graph.json…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) loadFile(file);
            e.target.value = "";
          }}
        />
      </header>

      {state.status === "error" && (
        <div className="banner banner--error" role="alert">
          <span>Could not load graph: {state.message}</span>
          {state.previous && (
            <button type="button" onClick={dismissError}>
              Dismiss
            </button>
          )}
        </div>
      )}
      {shown && shown.loaded.warnings.length > 0 && (
        <div className="banner banner--warn">{shown.loaded.warnings.join(" · ")}</div>
      )}

      <main className="canvas">
        {shown ? (
          <GraphCanvas
            key={shown.loadId}
            graph={shown.loaded.graph}
            direction={direction}
            layoutWorkerUrl={elkWorkerUrl}
            initialFocus={shown.initial ? initialFocusId() : undefined}
          />
        ) : state.status === "loading" ? (
          <p className="placeholder">Loading {state.source}…</p>
        ) : (
          <p className="placeholder">Drop a graph.json here, or use “Open graph.json…”.</p>
        )}
        {state.status === "loading" && shown && <div className="loading-chip">Loading {state.source}…</div>}
      </main>

      {dragging && (
        <div className="drop-overlay">
          <p>Drop graph.json to visualize it</p>
        </div>
      )}
    </div>
  );
}
