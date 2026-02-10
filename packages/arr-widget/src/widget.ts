import {
  WIDGET_API,
  EVENT_TO_STATE,
  type WidgetSelection,
  type DraftResponse,
  type RenewResponse,
  type RevokeResponse,
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
  state: string;
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
  private state: WidgetState = { selection: null, status: "idle", error: null, state: "idle" };
  private creatorInput: HTMLInputElement;
  private intentInput: HTMLTextAreaElement;
  private toolInput: HTMLInputElement;
  private licenseInput: HTMLInputElement;
  private statusEl: HTMLParagraphElement;
  private selectionEl: HTMLParagraphElement;
  private errorEl: HTMLParagraphElement;
  private stateEl: HTMLParagraphElement;
  private eventSource: EventSource | null = null;

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

    this.stateEl = document.createElement("p");
    this.stateEl.style.fontSize = "11px";
    this.stateEl.style.color = "#7aa2ff";
    this.stateEl.textContent = "State: idle";

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
      this.stateEl,
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

    const renewBtn = document.createElement("button");
    renewBtn.textContent = "Renew";
    buttonStyle(renewBtn);
    renewBtn.style.flex = "1";

    const revokeBtn = document.createElement("button");
    revokeBtn.textContent = "Revoke";
    buttonStyle(revokeBtn);
    revokeBtn.style.flex = "1";

    const secondaryActions = document.createElement("div");
    secondaryActions.style.display = "flex";
    secondaryActions.style.gap = "8px";
    secondaryActions.append(renewBtn, revokeBtn);
    body.append(secondaryActions);

    renewBtn.addEventListener("click", () => void this.renewAttestation());
    revokeBtn.addEventListener("click", () => void this.revokeAttestation());

    this.engine = new SelectionEngine({
      onSelect: (selection) => this.handleSelection(selection),
      onCancel: () => this.setStatus("Selection cancelled"),
    });
  }

  mount(parent: HTMLElement = document.body): void {
    parent.appendChild(this.root);
    this.connectEvents();
  }

  destroy(): void {
    this.engine.destroy();
    this.disconnectEvents();
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

  private setState(next: string): void {
    this.state.state = next;
    this.stateEl.textContent = `State: ${next}`;
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
    this.state = { selection: null, status: "idle", error: null, state: "idle" };
    this.selectionEl.textContent = "No selection yet";
    this.setStatus("Idle");
    this.setState("idle");
    this.setError(null);
  }

  private async createDraft(): Promise<void> {
    this.setError(null);

    const creator = this.creatorInput.value.trim();
    if (!creator) {
      this.setError("creator is required");
      return;
    }

    const contextInput: import("./context.js").WidgetContextInput = {
      toolVersion: this.toolVersion,
      session: this.sessionId,
    };
    if (this.state.selection) {
      contextInput.selection = this.state.selection;
    }
    const context = buildWidgetContext(contextInput);

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

  private async renewAttestation(): Promise<void> {
    this.setError(null);
    const creator = this.creatorInput.value.trim();
    if (!creator) {
      this.setError("creator is required");
      return;
    }

    const renews = window.prompt("Attestation ID to renew");
    if (!renews) {
      return;
    }

    const privateKeyPem = window.prompt("Private key PEM");
    if (!privateKeyPem) {
      return;
    }

    const context = buildWidgetContext({
      toolVersion: this.toolVersion,
      selection: this.state.selection ?? undefined,
      session: this.sessionId,
    });

    const payload = {
      renews,
      creator,
      intent: this.intentInput.value.trim() || undefined,
      tool: this.toolInput.value.trim() || undefined,
      license: this.licenseInput.value.trim() || undefined,
      private_key_pem: privateKeyPem,
      context,
      session: this.sessionId,
    };

    try {
      const response = await postJson<RenewResponse>(this.endpoint, WIDGET_API.renew, payload);
      this.setStatus(`Renewed (${response.signed_attestation.attestation.id})`);
    } catch (error) {
      this.setError(error instanceof Error ? error.message : "Renew failed");
    }
  }

  private async revokeAttestation(): Promise<void> {
    this.setError(null);

    const attestationId = window.prompt("Attestation ID to revoke");
    if (!attestationId) {
      return;
    }

    const privateKeyPem = window.prompt("Private key PEM");
    if (!privateKeyPem) {
      return;
    }

    const reason = window.prompt("Reason (optional)") || undefined;

    const context = buildWidgetContext({
      toolVersion: this.toolVersion,
      selection: this.state.selection ?? undefined,
      session: this.sessionId,
    });

    const payload = {
      attestation_id: attestationId,
      reason,
      private_key_pem: privateKeyPem,
      context,
      session: this.sessionId,
    };

    try {
      const response = await postJson<RevokeResponse>(this.endpoint, WIDGET_API.revoke, payload);
      this.setStatus(`Revoked (${response.revocation.revocation.attestation_id})`);
    } catch (error) {
      this.setError(error instanceof Error ? error.message : "Revoke failed");
    }
  }

  private connectEvents(): void {
    this.disconnectEvents();
    const url = `${this.endpoint}${WIDGET_API.events}`;
    const source = new EventSource(url);
    this.eventSource = source;

    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as { event?: { type?: string } };
        const eventType = parsed.event?.type;
        if (!eventType) return;
        const nextState = EVENT_TO_STATE[eventType];
        if (nextState) {
          this.setState(nextState);
        }
        this.setStatus(`Event: ${eventType}`);
      } catch {
        return;
      }
    };

    source.onerror = () => {
      this.setStatus("Event stream disconnected");
    };
  }

  private disconnectEvents(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

export function mountWidget(options: ArrWidgetOptions = {}): ArrWidget {
  const widget = new ArrWidget(options);
  widget.mount();
  return widget;
}
