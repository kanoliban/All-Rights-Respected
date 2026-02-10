# ARR Widget (`@allrightsrespected/widget`)

Injected browser overlay for in-context ARR attestations.

Status: MVP — selection capture, draft creation, renew/revoke, live SSE updates.

## Quickstart

```js
import { mountWidget } from "@allrightsrespected/widget";

const widget = mountWidget({
  endpoint: "http://127.0.0.1:8787",
  toolVersion: "0.1.0",
});

// Remove when done
widget.destroy();
```

### Constructor options

| Option           | Type     | Default                   | Description                          |
| ---------------- | -------- | ------------------------- | ------------------------------------ |
| `endpoint`       | `string` | `http://127.0.0.1:8787`  | ARR MCP server URL                   |
| `toolVersion`    | `string` | `0.1.0`                  | Included in widget context as `arr-widget/<version>` |
| `sessionId`      | `string` | `crypto.randomUUID()`    | Persisted per tab; sent with every request |
| `initialCreator` | `string` | —                        | Pre-fills the creator input field    |

## Selection modes

Click a mode button in the overlay, then interact with the page.

| Mode     | Gesture        | Required fields               | Optional fields          |
| -------- | -------------- | ----------------------------- | ------------------------ |
| **Rect** | Click + drag   | `bounds: [x, y, w, h]`       | `text`, `object_id`     |
| **Point**| Click          | `bounds: [x, y, 0, 0]`       | `text`, `object_id`     |
| **Range**| Text selection | `text` (non-empty)            | `bounds`, `object_id`   |
| **Object**| Click element | `object_id` (CSS path or `data-arr-id`) | `bounds`, `text` |

All selections are validated against the `widgetSelectionSchema` discriminated union at capture time.
Invalid selections throw a Zod parse error.

### Escape to cancel

Press **Escape** during any selection mode to cancel without capturing.

## Widget context

Every request to the server includes a `WidgetContext` built from:

```
{
  surface: "browser",
  tool: "arr-widget/<toolVersion>",
  file_path: window.location.href,
  selection: <captured selection or omitted>,
  session: <sessionId>
}
```

Context is validated against `widgetContextSchema` before sending.

## Live updates

The widget subscribes to `GET /events` on the configured endpoint via `EventSource` (SSE).
Incoming events update the widget state display:

| SSE event type                   | Widget state    |
| -------------------------------- | --------------- |
| `arr.attestation.draft.created`  | `pending_sign`  |
| `arr.attestation.signed`         | `signed`        |
| `arr.attestation.published`      | `published`     |
| `arr.attestation.verified`       | `verified`      |
| `arr.attestation.renewed`        | `verified`      |
| `arr.attestation.revoked`        | `idle`          |

## Local development

Build order matters — `arr-mcp` must build first because `arr-widget` imports
from the `@allrightsrespected/mcp/widget` subpath export.

```bash
# From repo root
npm run build --workspace @allrightsrespected/mcp
npm run build --workspace @allrightsrespected/widget
```

Or use the root build script which handles ordering:

```bash
npm run build
```

## Dependencies

- `@allrightsrespected/mcp/widget` — schemas, API paths, state machine, types.
