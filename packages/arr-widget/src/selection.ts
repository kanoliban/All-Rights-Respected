import { widgetSelectionSchema, type WidgetSelection } from "@allrightsrespected/mcp/widget";

type Point = { x: number; y: number };

type Bounds = [number, number, number, number];

function toBounds(start: Point, end: Point): Bounds {
  const x1 = Math.min(start.x, end.x);
  const y1 = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return [x1, y1, width, height];
}

function pagePointFromEvent(event: MouseEvent): Point {
  return { x: event.pageX, y: event.pageY };
}

function pageBoundsFromRect(rect: DOMRect): Bounds {
  return [
    rect.left + window.scrollX,
    rect.top + window.scrollY,
    rect.width,
    rect.height,
  ];
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function nthOfType(element: Element): number {
  const parent = element.parentElement;
  if (!parent) return 1;
  const tagName = element.tagName;
  let count = 0;
  let index = 0;
  for (const child of Array.from(parent.children)) {
    if (child.tagName === tagName) {
      count += 1;
      if (child === element) {
        index = count;
      }
    }
  }
  return index || 1;
}

export function buildCssPath(element: Element): string {
  if (element.id) {
    return `#${cssEscape(element.id)}`;
  }

  const segments: string[] = [];
  let current: Element | null = element;

  while (current && current.tagName.toLowerCase() !== "html") {
    const tag = current.tagName.toLowerCase();
    const index = nthOfType(current);
    segments.unshift(`${tag}:nth-of-type(${index})`);
    current = current.parentElement;
  }

  return segments.join(" > ");
}

export function createRectSelection(start: MouseEvent, end: MouseEvent): WidgetSelection {
  const bounds = toBounds(pagePointFromEvent(start), pagePointFromEvent(end));
  return widgetSelectionSchema.parse({ type: "rect", bounds });
}

export function createPointSelection(event: MouseEvent): WidgetSelection {
  const point = pagePointFromEvent(event);
  return widgetSelectionSchema.parse({ type: "point", bounds: [point.x, point.y, 0, 0] });
}

export function createRangeSelection(selection: Selection | null): WidgetSelection | null {
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const text = selection.toString().trim();
  if (!text) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const bounds = rect.width || rect.height ? pageBoundsFromRect(rect) : undefined;

  return widgetSelectionSchema.parse({ type: "range", text, bounds });
}

export function createObjectSelection(target: Element): WidgetSelection {
  const dataArrId = target.getAttribute("data-arr-id");
  const objectId = dataArrId ? `[data-arr-id=\"${dataArrId}\"]` : buildCssPath(target);
  const rect = target.getBoundingClientRect();
  const bounds = pageBoundsFromRect(rect);

  return widgetSelectionSchema.parse({ type: "object", object_id: objectId, bounds });
}

export function createUnknownSelection(): WidgetSelection {
  return widgetSelectionSchema.parse({ type: "unknown" });
}
