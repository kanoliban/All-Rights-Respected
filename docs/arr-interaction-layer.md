# ARR Interaction Layer (Non-Normative)

Status: Vision / exploratory
Last updated: 2026-02-09

## Purpose
ARR is a protocol for attribution. This document explores how ARR could be experienced by creators as a
*workflow*, not a command. It proposes a non-normative interaction layer that makes ARR feel invisible
and ambient, while still producing standards-compliant attestations.

This document does **not** add requirements to the ARR core spec. It is a UI/UX and systems layer
proposal that can be implemented by tools without changing the protocol.

## Design Principles

1. **Protocol invisibility**
   - Creators should not be forced to think about schemas, signatures, or CLI flags.
   - ARR should be captured in the moment, through the same UI where the work is made or reviewed.

2. **In-context intent capture**
   - Attestations should be anchored to a specific file, region, selection, or asset.
   - The system should collect context automatically (tool, file path, hash, selection text, etc.).

3. **Stateful lifecycle**
   - Attestations should be treated as living objects with clear state transitions.
   - The protocol stays the same; the interaction layer manages drafts, approvals, and renewal.

4. **Evented, agent-friendly**
   - An event stream should exist so agents can watch for new drafts, suggest fixes, and verify.
   - Machines should subscribe, not poll.

5. **Minimal friction**
   - Signing and embedding should be one-click or automatic once intent is captured.
   - “No thanks” should be a first-class option.

## Interaction Flow (Concept)

1. Creator opens a work in a tool or preview.
2. Creator selects a region or asset and adds a short note (“intent”).
3. The system auto-captures context (tool, version, file hash, selection bounding box).
4. A draft attestation is created and shown for review.
5. Creator approves and signs (or dismisses).
6. The attestation is embedded in-file or stored as a sidecar.
7. The system publishes a verification event and (optionally) renews or revokes later.

## Lifecycle (Non-Normative)

Suggested states for the interaction layer:

- `draft` → intent captured, not signed
- `signed` → cryptographic signature created
- `published` → embedded or sidecar written
- `verified` → verification pass (local or remote)
- `renewed` → supersedes prior attestation
- `revoked` → creator revokes
- `expired` → time window elapsed

This is **not** required by the ARR spec; it is a recommended workflow for tools.

## Event Stream (Concept)

Tools may expose a live stream of attestation events to enable agent workflows.
Example event types:

- `arr.attestation.draft.created`
- `arr.attestation.signed`
- `arr.attestation.published`
- `arr.attestation.verified`
- `arr.attestation.renewed`
- `arr.attestation.revoked`

Example envelope (illustrative):

```json
{
  "event_id": "evt_01HW...",
  "type": "arr.attestation.draft.created",
  "timestamp": "2026-02-09T19:22:00Z",
  "session_id": "sess_4z...",
  "payload": {
    "attestation": { /* standard ARR attestation */ },
    "context": {
      "file_path": "assets/poster.png",
      "content_hash": "sha256:...",
      "tool": "photoshop/25.1",
      "selection": {
        "type": "rect",
        "bounds": [120, 80, 640, 480]
      }
    }
  }
}
```

## Context Capture (Concept)

The interaction layer can use ARR `extensions` to store rich metadata without changing the core spec.
Examples:

- `extensions.selection.bounds` (pixel bounds or region id)
- `extensions.ui.surface` (canvas, timeline, prompt, etc.)
- `extensions.tool.session` (workspace/session identifiers)
- `extensions.intent.tags` (optional structured labels)

## Integration Surfaces

- **Browser toolbar** for creators viewing a web preview
- **Native plugins** in creative tools (design, audio, video)
- **CLI watch mode** that detects new files and prompts for attestation
- **Agent watch loops** that subscribe to draft events and help resolve them

## Relationship To ARR Core

- This layer does **not** change the attestation schema.
- It treats ARR attestations as the *output* of an interaction workflow.
- Any additional data should live in `extensions` or tool-specific sidecars.

## Open Questions

- What is the minimal context needed to make attestations verifiable and useful?
- Should ARR define a standard event envelope, or leave it tool-specific?
- What is the best default UX for “no attestation needed”? 
- How should tools surface renewals or revocations over time?

---

This document is intentionally non-normative. It exists to guide tool builders toward ARR-first
experiences that feel natural to creators.
