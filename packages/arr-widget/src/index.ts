export type { WidgetSelection, WidgetContext } from "@allrightsrespected/mcp/widget";
export { WIDGET_API, WIDGET_STATES, WIDGET_TRANSITIONS, EVENT_TO_STATE } from "@allrightsrespected/mcp/widget";

export type { SelectionMode, SelectionEngineOptions } from "./selection-engine.js";
export { SelectionEngine } from "./selection-engine.js";

export type { WidgetContextInput } from "./context.js";
export { buildWidgetContext } from "./context.js";

export {
  buildCssPath,
  createObjectSelection,
  createPointSelection,
  createRangeSelection,
  createRectSelection,
  createUnknownSelection,
} from "./selection.js";
