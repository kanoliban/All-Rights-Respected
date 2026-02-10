import {
  createObjectSelection,
  createPointSelection,
  createRangeSelection,
  createRectSelection,
  createUnknownSelection,
} from "./selection.js";
import type { WidgetSelection } from "@allrightsrespected/mcp/widget";

export type SelectionMode = "rect" | "point" | "range" | "object";

export interface SelectionEngineOptions {
  root?: Document;
  ignoreSelector?: string;
  onSelect?: (selection: WidgetSelection) => void;
  onCancel?: () => void;
}

export class SelectionEngine {
  private root: Document;
  private mode: SelectionMode | null = null;
  private onSelect: ((selection: WidgetSelection) => void) | undefined;
  private onCancel: (() => void) | undefined;
  private ignoreSelector: string;
  private startEvent: MouseEvent | null = null;

  private readonly onMouseDown = (event: MouseEvent) => this.handleMouseDown(event);
  private readonly onMouseUp = (event: MouseEvent) => this.handleMouseUp(event);
  private readonly onClick = (event: MouseEvent) => this.handleClick(event);
  private readonly onKeyDown = (event: KeyboardEvent) => this.handleKeyDown(event);

  constructor(options: SelectionEngineOptions = {}) {
    this.root = options.root ?? document;
    this.onSelect = options.onSelect;
    this.onCancel = options.onCancel;
    this.ignoreSelector = options.ignoreSelector ?? "[data-arr-widget]";
  }

  start(mode: SelectionMode): void {
    this.stop();
    this.mode = mode;

    this.root.addEventListener("keydown", this.onKeyDown, true);

    if (mode === "rect") {
      this.root.addEventListener("mousedown", this.onMouseDown, true);
      this.root.addEventListener("mouseup", this.onMouseUp, true);
      return;
    }

    if (mode === "point" || mode === "object") {
      this.root.addEventListener("click", this.onClick, true);
      return;
    }

    if (mode === "range") {
      this.root.addEventListener("mouseup", this.onMouseUp, true);
    }
  }

  stop(): void {
    this.root.removeEventListener("mousedown", this.onMouseDown, true);
    this.root.removeEventListener("mouseup", this.onMouseUp, true);
    this.root.removeEventListener("click", this.onClick, true);
    this.root.removeEventListener("keydown", this.onKeyDown, true);
    this.mode = null;
    this.startEvent = null;
  }

  destroy(): void {
    this.stop();
    this.onSelect = undefined;
    this.onCancel = undefined;
  }

  private isIgnored(target: EventTarget | null): boolean {
    if (!target || !(target instanceof Element)) {
      return false;
    }

    return Boolean(target.closest(this.ignoreSelector));
  }

  private handleMouseDown(event: MouseEvent): void {
    if (this.mode !== "rect" || event.button !== 0) {
      return;
    }

    if (this.isIgnored(event.target)) {
      return;
    }

    this.startEvent = event;
  }

  private handleMouseUp(event: MouseEvent): void {
    if (event.button !== 0) {
      return;
    }

    if (this.isIgnored(event.target)) {
      return;
    }

    if (this.mode === "rect") {
      if (!this.startEvent) {
        return;
      }
      const selection = createRectSelection(this.startEvent, event);
      this.startEvent = null;
      this.emit(selection);
      return;
    }

    if (this.mode === "range") {
      const selection = createRangeSelection(window.getSelection());
      if (selection) {
        this.emit(selection);
      }
    }
  }

  private handleClick(event: MouseEvent): void {
    if (event.button !== 0) {
      return;
    }

    if (this.isIgnored(event.target)) {
      return;
    }

    if (this.mode === "point") {
      this.emit(createPointSelection(event));
      return;
    }

    if (this.mode === "object") {
      if (!(event.target instanceof Element)) {
        this.emit(createUnknownSelection());
        return;
      }
      this.emit(createObjectSelection(event.target));
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      this.startEvent = null;
      this.onCancel?.();
      return;
    }

    if (event.key === "Enter" && this.mode === "range") {
      const selection = createRangeSelection(window.getSelection());
      if (selection) {
        this.emit(selection);
      }
    }
  }

  private emit(selection: WidgetSelection): void {
    this.onSelect?.(selection);
  }
}
