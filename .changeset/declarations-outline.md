---
"@tsviz/ui": minor
---

`GraphCanvas` shows a declarations list beside the canvas, grouped by kind. Picking one centres and selects its card, zooming in if the view is too far out to read it, and shows its kind again if the filter bar had faded it. The filter matches names, file paths and member names, so declarations can be found without knowing what they're called. The list collapses to a button, starts collapsed on canvases narrower than 720px, and can be turned off with `outline={false}`.
