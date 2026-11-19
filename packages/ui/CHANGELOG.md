# @tsviz/ui

## 0.3.0

### Minor Changes

- e2415ae: `GraphCanvas` shows a declarations list beside the canvas, grouped by kind. Picking one centres and selects its card, zooming in if the view is too far out to read it, and shows its kind again if the filter bar had faded it. The filter matches names, file paths and member names, so declarations can be found without knowing what they're called. The list collapses to a button, starts collapsed on canvases narrower than 720px, and can be turned off with `outline={false}`.
- e2415ae: `GraphCanvas` takes an `initialFocus` declaration id. Once the first layout lands, that card is selected and the view zooms in on it instead of fitting the whole graph.
- ab7e1ae: Cards whose header, heritage or member rows are cut off can be widened by dragging their right edge, up to the width that shows all of their text in full. The layout reruns when the drag ends.

## 0.2.0

### Minor Changes

- d102678: Support React 18. The `react` and `react-dom` peer ranges are now `^18.0.0 || ^19.0.0`, and `GraphCanvas` renders its contexts with `.Provider` so it works on both versions.
