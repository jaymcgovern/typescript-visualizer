"use client";

import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  useStore,
  useStoreApi,
  type EdgeTypes,
  type NodeChange,
  type NodeTypes,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { Graph } from "@tsviz/graph";
import { detailAt } from "../graph/detail.ts";
import { computeHighlight, type Highlight, type HoverTarget } from "../graph/highlight.ts";
import { OUT_HANDLE } from "../graph/ports.ts";
import {
  applyEdgeLayout,
  applyNodeLayout,
  applySourceHandles,
  layoutInput,
  sourceHandles,
  toFlow,
  type DeclEdge,
  type DeclNode,
  type PortAnchor,
} from "../graph/toFlow.ts";
import type { Direction } from "../layout/direction.ts";
import type { XY } from "../layout/elkGraph.ts";
import { sourceParts } from "../graph/edgeDetail.ts";
import {
  countBy,
  droppedSummary,
  filteredOut,
  filterHighlight,
  NO_FILTERS,
  type FilterHover,
  type Filters,
} from "../graph/filters.ts";
import { runLayout } from "../layout/engine.ts";
import { createLabelMeasurer, edgeLabelFont } from "../layout/measureText.ts";
import { themeStyle, type ColorScheme, type TsvizTheme } from "../theme.ts";
import { EdgeMarkers } from "./EdgeMarkers.tsx";
import { ElkEdge } from "./ElkEdge.tsx";
import { CardActionsContext, LitPartsContext, type CardActions } from "./hover.ts";
import { RelationshipPopover } from "./RelationshipPopover.tsx";
import { FilterBar } from "./FilterBar.tsx";
import { TypeNode } from "./TypeNode.tsx";

const edgeTypes: EdgeTypes = { elk: ElkEdge };
const nodeTypes: NodeTypes = { decl: TypeNode };
/** A measured size this far from the laid-out one triggers a relayout. */
const RESIZE_TOLERANCE = 1;

type LayoutStatus =
  | { state: "measuring" }
  | { state: "running" }
  | { state: "done" }
  | { state: "error"; message: string };

export interface GraphCanvasProps {
  /** The graph to draw; validate untrusted JSON with `parseGraph` from `@tsviz/graph` first. */
  graph: Graph;
  /** Layout direction. Default `"DOWN"`. */
  direction?: Direction;
  /** `"auto"` (the default) follows the user's system preference. */
  colorScheme?: ColorScheme;
  /** Overrides for the `--tsviz-*` design tokens. */
  theme?: TsvizTheme;
  /**
   * URL of `elkjs/lib/elk-worker.min.js`, to run layout off the main thread.
   * Without it, layout runs on the main thread, which can stall on large graphs.
   * With Vite: `import url from "elkjs/lib/elk-worker.min.js?url"`.
   */
  layoutWorkerUrl?: string;
  className?: string;
}

/**
 * An interactive diagram of a declaration graph. It fills its container, so
 * give that a height. Remount it (via `key`) to show a different graph.
 */
export function GraphCanvas({ colorScheme = "auto", theme, className, ...props }: GraphCanvasProps) {
  const root = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={root}
      className={className ? `tsviz ${className}` : "tsviz"}
      data-color-scheme={colorScheme}
      style={themeStyle(theme)}
    >
      <ReactFlowProvider>
        <Flow {...props} colorScheme={colorScheme} root={root} />
      </ReactFlowProvider>
    </div>
  );
}

interface FlowProps {
  graph: Graph;
  direction?: Direction;
  colorScheme: ColorScheme;
  layoutWorkerUrl?: string;
  /** The `.tsviz` element, whose computed font the edge labels use. */
  root: RefObject<HTMLDivElement | null>;
}

/**
 * Two passes: nodes first render invisibly so React Flow can measure them,
 * then ELK lays them out with those real sizes. Changing `direction` or
 * pressing "Re-layout" reruns ELK and refits the view; a card changing size
 * (e.g. expanding its members) reruns ELK and keeps the viewport.
 */
function Flow({ graph, direction = "DOWN", colorScheme, layoutWorkerUrl, root }: FlowProps) {
  const initial = useMemo(() => toFlow(graph), [graph]);
  const [nodes, setNodes, onNodesChange] = useNodesState<DeclNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<DeclEdge>(initial.edges);
  const measured = useNodesInitialized();
  const { getNodes, getEdges, getInternalNode, fitView, setCenter, getZoom, screenToFlowPosition } = useReactFlow<
    DeclNode,
    DeclEdge
  >();
  const store = useStoreApi<DeclNode, DeclEdge>();
  const [status, setStatus] = useState<LayoutStatus>({ state: "measuring" });
  const [nonce, setNonce] = useState(0);
  // Layouts applied so far. Until the first lands, nodes sit on the measuring grid and stay hidden.
  const [layoutCount, setLayoutCount] = useState(0);
  // Incremented when a layout that should refit the view lands.
  const [fitRequest, setFitRequest] = useState(0);
  const fitNext = useRef(true);
  const lastDirection = useRef(direction);
  const laidOutKey = useRef<string | undefined>(undefined);
  // Node sizes the current layout was computed with.
  const laidOutSizes = useRef<Map<string, { width: number; height: number }> | undefined>(undefined);
  // Created on first use: layout runs after mount, when the root's font can be read.
  const measurer = useRef<ReturnType<typeof createLabelMeasurer>>(undefined);
  const measureLabel = useCallback(
    (text: string) => (measurer.current ??= createLabelMeasurer(edgeLabelFont(root.current)))(text),
    [root],
  );
  // Ignores a layout that a newer request has superseded.
  const generation = useRef(0);

  useEffect(() => {
    const key = `${direction}:${nonce}`;

    if (!measured || laidOutKey.current === key) return;
    laidOutKey.current = key;
    if (direction !== lastDirection.current) {
      lastDirection.current = direction;
      fitNext.current = true;
    }

    const gen = ++generation.current;
    const current = getNodes();
    // Member-row ports (RIGHT only): where each edge leaves, and where React Flow measured those handles.
    const handles = sourceHandles(current, direction);
    const portsOf = (id: string): PortAnchor[] =>
      (getInternalNode(id)?.internals.handleBounds?.source ?? [])
        .filter((h) => h.id && h.id !== OUT_HANDLE)
        // React Flow anchors a right-side handle at the middle of its outer edge.
        .map((h) => ({ id: h.id!, x: h.x + h.width, y: h.y + h.height / 2 }));
    const input = layoutInput(current, getEdges(), { handles, portsOf });

    laidOutSizes.current = new Map(input.nodes.map((n) => [n.id, n]));
    setStatus({ state: "running" });
    runLayout(input, direction, { measureLabel, workerUrl: layoutWorkerUrl }).then(
      (layout) => {
        if (gen !== generation.current) return;
        setNodes((ns) => applyNodeLayout(ns, layout));
        // Handles change with the routes, so edges never meet a handle their route was not made for.
        setEdges((es) => applyEdgeLayout(applySourceHandles(es, handles), layout));
        setStatus({ state: "done" });
        setLayoutCount((c) => c + 1);
        if (fitNext.current) {
          fitNext.current = false;
          setFitRequest((c) => c + 1);
        }
      },
      (err: unknown) => {
        if (gen !== generation.current) return;
        setStatus({ state: "error", message: err instanceof Error ? err.message : String(err) });
      },
    );
  }, [
    measured,
    direction,
    nonce,
    getNodes,
    getEdges,
    getInternalNode,
    setNodes,
    setEdges,
    measureLabel,
    layoutWorkerUrl,
  ]);

  // Fits the view in the commit that applied a layout (calling fitView next to
  // setNodes would measure the old positions). React Flow syncs controlled nodes
  // into its store in a child effect, which runs before this one. Snaps to the
  // first layout, animates later ones.
  useEffect(() => {
    if (fitRequest > 0) void fitView({ padding: 0.08, duration: fitRequest > 1 ? 300 : 0 });
  }, [fitRequest, fitView]);

  const relayout = useCallback(() => {
    fitNext.current = true;
    setNonce((n) => n + 1);
  }, []);

  // A card that no longer has the size it was laid out with gets a fresh layout.
  const handleNodesChange = useCallback(
    (changes: NodeChange<DeclNode>[]) => {
      onNodesChange(changes);
      const sizes = laidOutSizes.current;

      if (!sizes) return;
      const resized = changes.some((c) => {
        if (c.type !== "dimensions" || !c.dimensions) return false;
        const before = sizes.get(c.id);

        return (
          !before ||
          Math.abs(before.width - c.dimensions.width) > RESIZE_TOLERANCE ||
          Math.abs(before.height - c.dimensions.height) > RESIZE_TOLERANCE
        );
      });

      if (resized) setNonce((n) => n + 1);
    },
    [onNodesChange],
  );

  // If the first layout fails, show the measuring grid rather than nothing.
  const hidden = layoutCount === 0 && status.state !== "error";
  // Lets CSS drop edge labels when cards are zoomed out (see detail.ts).
  const detail = useStore((s) => detailAt(s.transform[2]));

  // Focus is React Flow's selection: click a card to focus it, click the background to clear.
  const [hover, setHover] = useState<HoverTarget | undefined>(undefined);
  const [hoveredEdge, setHoveredEdge] = useState<string | undefined>(undefined);
  const focusKey = nodes
    .filter((n) => n.selected)
    .map((n) => n.id)
    .join("\n");
  const highlightEdges = useMemo(
    () => edges.map((e) => ({ id: e.id, source: e.source, target: e.target, rel: e.data!.rel })),
    [edges],
  );
  // A selected edge is focused too: it, its two cards, and (for exactly one) a popover and its source parts lit.
  const selectedEdges = edges.filter((e) => e.selected);
  const edgeFocusKey = selectedEdges.map((e) => e.id).join("\n");
  // The filter bar: switched-off kinds and families fade out; a hovered chip highlights what it covers.
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [filterHover, setFilterHover] = useState<FilterHover | undefined>(undefined);
  const filterNodes = useMemo(() => initial.nodes.map((n) => ({ id: n.id, kind: n.data.decl.kind })), [initial]);
  const filterEdges = useMemo(
    () => initial.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, kind: e.data!.rel.kind })),
    [initial],
  );
  const nodeCounts = useMemo(() => countBy(filterNodes, (n) => n.kind), [filterNodes]);
  const edgeCounts = useMemo(() => countBy(filterEdges, (e) => e.kind), [filterEdges]);
  const off = useMemo(() => filteredOut(filterNodes, filterEdges, filters), [filterNodes, filterEdges, filters]);
  const dropped = useMemo(() => droppedSummary(graph.meta), [graph]);
  const highlight = useMemo(
    () =>
      filterHover
        ? filterHighlight(filterNodes, filterEdges, filterHover)
        : computeHighlight(highlightEdges, {
            focusedNodes: focusKey ? focusKey.split("\n") : [],
            focusedEdges: edgeFocusKey ? edgeFocusKey.split("\n") : [],
            hover,
            hoveredEdge,
          }),
    [filterHover, filterNodes, filterEdges, highlightEdges, focusKey, hover, edgeFocusKey, hoveredEdge],
  );
  // A linked type name selects its declaration (as a click on it would) and pans to it at the current zoom.
  const actions = useMemo<CardActions>(
    () => ({
      setHover,
      focus: (id) => {
        const node = getInternalNode(id);

        if (!node) return;
        store.getState().addSelectedNodes([id]);
        setHover(undefined);
        const { x, y } = node.internals.positionAbsolute;

        void setCenter(x + (node.measured.width ?? 0) / 2, y + (node.measured.height ?? 0) / 2, {
          zoom: getZoom(),
          duration: 300,
        });
      },
    }),
    [getInternalNode, store, setCenter, getZoom],
  );
  // A dropped reference's declaration may be filtered out (faded and unclickable): show its kind again first.
  const goToDropped = useCallback(
    (id: string) => {
      const kind = graph.nodes.find((n) => n.id === id)?.kind;

      if (kind) setFilters((f) => (f.kinds.has(kind) ? { ...f, kinds: toggle(f.kinds, kind) } : f));
      actions.focus(id);
    },
    [graph, actions],
  );
  const shownNodes = useMemo(() => withNodeHighlight(nodes, highlight, off.nodes), [nodes, highlight, off]);
  const shownEdges = useMemo(() => withEdgeHighlight(edges, highlight, off.edges), [edges, highlight, off]);

  // Where the selected edge was clicked; keyboard selection falls back to the middle of its route.
  const [clicked, setClicked] = useState<{ edge: string; at: XY } | undefined>(undefined);
  const selected = selectedEdges.length === 1 ? selectedEdges[0]! : undefined;
  const selectedSource = selected && nodes.find((n) => n.id === selected.source);
  const selectedTarget = selected && nodes.find((n) => n.id === selected.target);
  // The source parts of the hovered edge, else of the selected one.
  const litEdge = (hoveredEdge !== undefined && edges.find((e) => e.id === hoveredEdge)) || selected;
  const litSource = litEdge && nodes.find((n) => n.id === litEdge.source);
  const lit = useMemo(
    () =>
      litEdge && litSource
        ? {
            node: litSource.id,
            parts: sourceParts(litSource.data.decl, litSource.data.expanded ?? false, litEdge.data!.rel),
          }
        : undefined,
    [litEdge, litSource],
  );
  const popoverAt = selected && (clicked?.edge === selected.id ? clicked.at : routeMiddle(selected));
  const clearSelection = useCallback(() => {
    store.getState().unselectNodesAndEdges();
    setHover(undefined);
  }, [store]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSelection();
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [clearSelection]);

  if (graph.nodes.length === 0) return <p className="tsviz__empty">This graph has no declarations.</p>;

  return (
    // Wraps ReactFlow itself: nodes are rendered outside its children.
    <CardActionsContext.Provider value={actions}>
      <LitPartsContext.Provider value={lit}>
        <ReactFlow
          className={`flow flow--${detail}${hidden ? " flow--measuring" : ""}`}
          data-layout={status.state}
          nodes={shownNodes}
          edges={shownEdges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onEdgeMouseEnter={(_, edge) => setHoveredEdge(edge.id)}
          onEdgeMouseLeave={() => setHoveredEdge(undefined)}
          onEdgeClick={(e, edge) =>
            setClicked({ edge: edge.id, at: screenToFlowPosition({ x: e.clientX, y: e.clientY }) })
          }
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesConnectable={false}
          colorMode={colorScheme === "auto" ? "system" : colorScheme}
          minZoom={0.05}
        >
          <EdgeMarkers />
          {selected && selectedSource && selectedTarget && popoverAt && (
            <RelationshipPopover
              rel={selected.data!.rel}
              source={selectedSource.data.decl}
              target={selectedTarget.data.decl}
              anchor={popoverAt}
              onClose={clearSelection}
              onGoTo={actions.focus}
            />
          )}
          <Background gap={24} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable nodeClassName={(n) => n.className ?? ""} />
          <Panel position="bottom-center" className="filter-panel">
            <FilterBar
              nodeCounts={nodeCounts}
              edgeCounts={edgeCounts}
              filters={filters}
              onToggleKind={(kind) => setFilters((f) => ({ ...f, kinds: toggle(f.kinds, kind) }))}
              onToggleFamily={(family) => setFilters((f) => ({ ...f, families: toggle(f.families, family) }))}
              onHover={setFilterHover}
              {...(dropped ? { dropped } : {})}
              onGoTo={goToDropped}
            />
          </Panel>
          <Panel position="top-right">
            <button type="button" onClick={relayout} disabled={status.state === "running"}>
              Re-layout
            </button>
          </Panel>
          {status.state !== "done" && (
            <Panel position="top-center" className={status.state === "error" ? "chip chip--error" : "chip"}>
              {status.state === "error"
                ? `Layout failed: ${status.message}`
                : status.state === "measuring"
                  ? "Measuring…"
                  : "Laying out…"}
            </Panel>
          )}
        </ReactFlow>
      </LitPartsContext.Provider>
    </CardActionsContext.Provider>
  );
}

/**
 * Adds `is-filtered` (switched off in the filter bar), else `is-target` /
 * `is-faded` (highlight) to cards, keeping the objects of unaffected ones.
 */
function withNodeHighlight(nodes: DeclNode[], h: Highlight, filtered: Set<string>): DeclNode[] {
  if (!h.fadeNodes && h.targetNodes.size === 0 && filtered.size === 0) return nodes;

  return nodes.map((n) => {
    const extra = filtered.has(n.id)
      ? "is-filtered"
      : h.targetNodes.has(n.id)
        ? "is-target"
        : h.fadeNodes && !h.activeNodes.has(n.id)
          ? "is-faded"
          : "";

    return extra ? { ...n, className: `${n.className ?? ""} ${extra}` } : n;
  });
}

/** Hides switched-off edges, lifts active ones above the rest, and fades the others. */
function withEdgeHighlight(edges: DeclEdge[], h: Highlight, filtered: Set<string>): DeclEdge[] {
  if (!h.fadeEdges && filtered.size === 0) return edges;

  return edges.map((e) =>
    filtered.has(e.id)
      ? { ...e, className: `${e.className ?? ""} is-filtered` }
      : h.activeEdges.has(e.id)
        ? { ...e, className: `${e.className ?? ""} is-active`, zIndex: 1 }
        : h.fadeEdges
          ? { ...e, className: `${e.className ?? ""} is-faded` }
          : e,
  );
}

/** A copy of `set` with `item` added, or removed if it was there. */
function toggle<T>(set: ReadonlySet<T>, item: T): Set<T> {
  const next = new Set(set);

  if (!next.delete(item)) next.add(item);

  return next;
}

/** The middle bend (or point) of an edge's route, in flow coordinates. */
function routeMiddle(edge: DeclEdge): XY | undefined {
  const points = edge.data?.route?.points;

  return points?.[Math.floor(points.length / 2)];
}
