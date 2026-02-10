# ARR Widget (`@allrightsrespected/widget`)

Injected browser overlay for in-context ARR attestations.

Status: MVP selection + draft creation panel.
Includes live event updates and renew/revoke helpers (prompt-driven).

## Usage (injected)

```js
import { mountWidget } from "@allrightsrespected/widget";

mountWidget({
  endpoint: "http://127.0.0.1:8787",
  toolVersion: "0.1.0",
});
```

## Selection modes
- Rect (drag)
- Point (click)
- Range (text selection)
- Object (element target)

## Dependencies
- `@allrightsrespected/mcp/widget` for schemas + API paths.

## Live updates
- Subscribes to `GET /events` on the configured endpoint.
- Updates widget state from SSE events via `EVENT_TO_STATE`.
