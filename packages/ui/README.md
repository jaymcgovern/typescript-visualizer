# @tsviz/ui

A React component that draws a TypeScript declaration graph produced by
[`@tsviz/parser`](../parser). It is built on React Flow and laid out with ELK.

```sh
npm install @tsviz/ui @tsviz/graph @xyflow/react react react-dom
```

```tsx
import "@xyflow/react/dist/style.css";
import "@tsviz/ui/styles.css";
import { parseGraph } from "@tsviz/graph";
import { GraphCanvas } from "@tsviz/ui";

const { graph } = parseGraph(json, "graph.json");

// GraphCanvas fills its container, so give the container a height.
<div style={{ height: 600 }}>
  <GraphCanvas graph={graph} />
</div>;
```

To show a different graph, remount the component (for example with `key`).

## Props

| prop              | default  | meaning                                                             |
| ----------------- | -------- | ------------------------------------------------------------------- |
| `graph`           | required | The graph to draw. Validate untrusted JSON with `parseGraph` first. |
| `direction`       | `"DOWN"` | `"DOWN"` (top to bottom) or `"RIGHT"` (left to right)               |
| `colorScheme`     | `"auto"` | `"light"`, `"dark"`, or `"auto"` to follow the system preference    |
| `theme`           | none     | Design token overrides; see below                                   |
| `layoutWorkerUrl` | none     | URL of `elkjs/lib/elk-worker.min.js`, to run layout in a Web Worker |
| `className`       | none     | Added to the root element, next to `tsviz`                          |

## Layout in a worker

Without `layoutWorkerUrl`, ELK is loaded lazily and runs on the main thread.
That works with any bundler, but large graphs can make the page stall while
they are laid out. To use a worker, pass the worker script's URL. With Vite:

```tsx
import elkWorkerUrl from "elkjs/lib/elk-worker.min.js?url";

<GraphCanvas graph={graph} layoutWorkerUrl={elkWorkerUrl} />;
```

## Theming

All styles are scoped under the component's `.tsviz` root element and read
`--tsviz-*` CSS custom properties. Override them with the `theme` prop:

```tsx
<GraphCanvas graph={graph} theme={{ kindClass: "hotpink", fontSans: "Inter, sans-serif" }} />
```

or in your own CSS:

```css
.tsviz {
  --tsviz-kind-class: light-dark(#8250df, #ab7df8);
}
```

Colour tokens use `light-dark()`, so one value can cover both schemes.
`THEME_TOKENS` lists every token: fonts, surfaces, one colour per declaration
kind (`kindInterface`, `kindClass`, …) and one per relationship family
(`relInherit`, `relStructure`, `relSignature`, `relComposition`,
`relReference`).

Browser support: `light-dark()` and container query units (Chrome 123+,
Firefox 120+, Safari 17.5+).
