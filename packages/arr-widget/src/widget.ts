import {
  WIDGET_API,
  type WidgetSelection,
  type DraftResponse,
} from "@allrightsrespected/mcp/widget";
import { SelectionEngine, type SelectionMode } from "./selection-engine.js";
import { buildWidgetContext } from "./context.js";

export type ArrWidgetOptions = {
  endpoint?: string;
  toolVersion?: string;
  sessionId?: string;
  initialCreator?: string;
};

type WidgetState = {
  selection: WidgetSelection | null;
  status: string;
  error: string | null;
};

const DEFAULT_ENDPOINT = "http://127.0.0.1:8787";
const DEFAULT_TOOL_VERSION = "0.1.0";

function createSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `arr-widget-${Date.now()}`;
}

function applyStyles(root: HTMLElement): void {
  root.style.position = "fixed";
  root.style.top = "16px";
  root.style.right = "16px";
  root.style.width = "320px";
  root.style.zIndex = "2147483647";
  root.style.fontFamily = "system-ui, -apple-system, sans-serif";
  root.style.color = "#e7e7e7";
  root.style.background = "rgba(18, 18, 18, 0.92)";
  root.style.border = "1px solid rgba(255, 255, 255, 0.1)";
  root.style.borderRadius = "12px";
  root.style.boxShadow = "0 12px 30px rgba(0,0,0,0.35)";
  root.style.backdropFilter = "blur(12px)";
}

function buttonStyle(button: HTMLButtonElement): void {
  button.style.background = "#1f1f1f";
  button.style.color = "#e7e7e7";
  button.style.border = "1px solid rgba(255, 255, 255, 0.1)";
  button.style.borderRadius = "8px";
  button.style.padding = "6px 10px";
  button.style.fontSize = "12px";
  button.style.cursor = "pointer";
}

function inputStyle(input: HTMLInputElement | HTMLTextAreaElement): void {
  input.style.width = "100%";
  input.style.background = "#141414";
  input.style.color = "#e7e7e7";
  input.style.border = "1px solid rgba(255, 255, 255, 0.1)";
  input.style.borderRadius = "6px";
  input.style.padding = "6px 8px";
  input.style.fontSize = "12px";
}

async function postJson<T>(endpoint: string, path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${endpoint}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

export class ArrWidget {
  private root: HTMLElement;
  private engine: SelectionEngine;
  private endpoint: string;
  private toolVersion: string;
  private sessionId: string;
  private state: WidgetState = { selection: null, status: "idle", error: null };
  private creatorInput: HTMLInputElement;
  private intentInput: HTMLTextAreaElement;
  private toolInput: HTMLInputElement;
  private licenseInput: HTMLInputElement;
  private statusEl: HTMLParagraphElement;
  private selectionEl: HTMLParagraphElement;
  private errorEl: HTMLParagraphElement;

  constructor(options: ArrWidgetOptions = {}) {
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.toolVersion = options.toolVersion ?? DEFAULT_TOOL_VERSION;
    this.sessionId = options.sessionId ?? createSessionId();

    this.root = document.createElement("div");
    this.root.dataset.arrWidget = "root";
    applyStyles(this.root);

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.padding = "12px 12px 8px";

    const title = document.createElement("strong");
    title.textContent = "ARR Widget";
    title.style.fontSize = "13px";
    title.style.letterSpacing = "0.04em";
    header.appendChild(title);

    const minimize = document.createElement("button");
    minimize.textContent = "–";
    buttonStyle(minimize);
    minimize.style.width = "28px";
    minimize.style.padding = "4px 0";
    header.appendChild(minimize);

    const body = document.createElement("div");
    body.style.padding = "0 12px 12px";
    body.style.display = "grid";
    body.style.gap = "8px";

    const controls = document.createElement("div");
    controls.style.display = "grid";
    controls.style.gridTemplateColumns = "repeat(4, 1fr)";
    controls.style.gap = "6px";

    const rectBtn = document.createElement("button");
    rectBtn.textContent = "Rect";
    buttonStyle(rectBtn);
    const pointBtn = document.createElement("button");
    pointBtn.textContent = "Point";
    buttonStyle(pointBtn);
    const rangeBtn = document.createElement("button");
    rangeBtn.textContent = "Range";
    buttonStyle(rangeBtn);
    const objBtn = document.createElement("button");
    objBtn.textContent = "Object";
    buttonStyle(objBtn);

    controls.append(rectBtn, pointBtn, rangeBtn, objBtn);

    this.creatorInput = document.createElement("input");
    this.creatorInput.placeholder = "creator id";
    inputStyle(this.creatorInput);
    if (options.initialCreator) {
      this.creatorInput.value = options.initialCreator;
    }

    this.intentInput = document.createElement("textarea");
    this.intentInput.placeholder = "intent";
    this.intentInput.rows = 2;
    inputStyle(this.intentInput);

    this.toolInput = document.createElement("input");
    this.toolInput.placeholder = "tool (optional)";
    inputStyle(this.toolInput);

    this.licenseInput = document.createElement("input");
    this.licenseInput.placeholder = "license (optional)";
    inputStyle(this.licenseInput);

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.justifyContent = "space-between";
    actions.style.gap = "8px";

    const draftBtn = document.createElement("button");
    draftBtn.textContent = "Create Draft";
    buttonStyle(draftBtn);
    draftBtn.style.flex = "1";

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Clear";
    buttonStyle(clearBtn);
    clearBtn.style.flex = "1";

    actions.append(draftBtn, clearBtn);

    this.selectionEl = document.createElement("p");
    this.selectionEl.style.fontSize = "11px";
    this.selectionEl.style.color = "#b3b3b3";
    this.selectionEl.textContent = "No selection yet";

    this.statusEl = document.createElement("p");
    this.statusEl.style.fontSize = "11px";
    this.statusEl.style.color = "#8fd18c";
    this.statusEl.textContent = "Idle";

    this.errorEl = document.createElement("p");
    this.errorEl.style.fontSize = "11px";
    this.errorEl.style.color = "#ff8b8b";
    this.errorEl.style.display = "none";

    body.append(
      controls,
      this.creatorInput,
      this.intentInput,
      this.toolInput,
      this.licenseInput,
      actions,
      this.selectionEl,
      this.statusEl,
      this.errorEl,
    );

    this.root.append(header, body);

    let minimized = false;
    minimize.addEventListener("click", () => {
      minimized = !minimized;
      body.style.display = minimized ? "none" : "grid";
    });

    rectBtn.addEventListener("click", () => this.selectMode("rect"));
    pointBtn.addEventListener("click", () => this.selectMode("point"));
    rangeBtn.addEventListener("click", () => this.selectMode("range"));
    objBtn.addEventListener("click", () => this.selectMode("object"));

    draftBtn.addEventListener("click", () => void this.createDraft());
    clearBtn.addEventListener("click", () => this.clearState());

    this.engine = new SelectionEngine({
      onSelect: (selection) => this.handleSelection(selection),
      onCancel: () => this.setStatus("Selection cancelled"),
    });
  }

  mount(parent: HTMLElement = document.body): void {
    parent.appendChild(this.root);
  }

  destroy(): void {
    this.engine.destroy();
    this.root.remove();
  }

  private selectMode(mode: SelectionMode): void {
    this.engine.start(mode);
    this.setStatus(`Selecting (${mode})`);
  }

  private handleSelection(selection: WidgetSelection): void {
    this.state.selection = selection;
    this.selectionEl.textContent = `Selection: ${selection.type}`;
    this.setStatus("Selection captured");
  }

  private setStatus(message: string): void {
    this.statusEl.textContent = message;
  }

  private setError(message: string | null): void {
    if (message) {
      this.errorEl.textContent = message;
      this.errorEl.style.display = "block";
      return;
    }

    this.errorEl.textContent = "";
    this.errorEl.style.display = "none";
  }

  private clearState(): void {
    this.state = { selection: null, status: "idle", error: null };
    this.selectionEl.textContent = "No selection yet";
    this.setStatus("Idle");
    this.setError(null);
  }

  private async createDraft(): Promise<void> {
    this.setError(null);

    const creator = this.creatorInput.value.trim();
    if (!creator) {
      this.setError("creator is required");
      return;
    }

    const context = buildWidgetContext({
      toolVersion: this.toolVersion,
      selection: this.state.selection ?? undefined,
      session: this.sessionId,
    });

    const payload = {
      creator,
      intent: this.intentInput.value.trim() || undefined,
      tool: this.toolInput.value.trim() || undefined,
      license: this.licenseInput.value.trim() || undefined,
      context,
      session: this.sessionId,
    };

    try {
      const response = await postJson<DraftResponse>(this.endpoint, WIDGET_API.draft, payload);
      this.setStatus(`Draft created (${response.attestation.id})`);
    } catch (error) {
      this.setError(error instanceof Error ? error.message : "Draft failed");
    }
  }
}

export function mountWidget(options: ArrWidgetOptions = {}): ArrWidget {
  const widget = new ArrWidget(options);
  widget.mount();
  return widget;
}
