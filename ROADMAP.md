# ARR Roadmap

Status: Draft execution plan  
Last updated: 2026-02-04

## Objective

Move ARR from "credible protocol thesis" to "adoptable implementation standard" while preserving:
- no gatekeeping,
- no mandatory participation,
- no ownership capture.

## Milestones

## M0 - Canonical hardening (Week 1)

Outcome: narrative and docs remain aligned and link-safe.

- [x] Normalize canonical repository links on all static pages
- [x] Keep supplementary transcripts and legacy prototypes local-only
- [x] Define canonical documentation map (`README`, `SPEC.md`, `spec.html`, `sdk.html`)
- [x] Add change discipline for `SPEC.md` and `spec.html` mirror updates

Exit criteria:
- No broken internal links
- No ambiguous org/repo references
- Clear source-of-truth note in docs

## M1 - Reference implementation minimum (Weeks 2-4)

Outcome: first working implementation path for creators and developers.

- [ ] Implement `arr` CLI baseline:
  - `arr attest <file>`
  - `arr verify <file>`
  - `arr extract <file>`
- [ ] Support sidecar mode (`<file>.arr`) for all formats
- [ ] Support metadata embedding for PNG/JPEG (minimum)
- [ ] Publish conformance test fixtures for `arr/0.1`

Exit criteria:
- A creator can generate and verify an attestation locally
- Verification output includes valid/expired/invalid states
- Demo files and fixtures are publicly reproducible

## M2 - JS SDK baseline (Weeks 4-8)

Outcome: platform and tool developers can integrate ARR without custom cryptography.

- [ ] Ship JS/TS SDK with:
  - `createAttestation`
  - `signAttestation`
  - `verifyAttestation`
  - `embedAttestation`
  - `extractAttestation`
- [ ] Provide typed interfaces for `arr/0.1`
- [ ] Add reference examples for browser and Node

Exit criteria:
- NPM package published
- Public API is tested and documented
- SDK passes protocol fixture suite

## M3 - Adoption primitives (Weeks 8-12)

Outcome: first integrations and governance-ready contributor workflow.

- [ ] Publish `BOUNTIES.md` with acceptance rubric and payout policy
- [ ] Add "Contribute" flow to website
- [ ] Launch one integration pilot (creator tool or platform plugin)

Exit criteria:
- At least one external contributor can complete a bounty end-to-end
- Integration demo is publicly viewable

## Non-negotiable constraints

- ARR remains optional: absence of attestation is valid.
- ARR is social recognition infrastructure, not legal enforcement tooling.
- Funding does not purchase protocol governance.

## Risks to watch

- Messaging drift toward DRM/legal-control framing
- Documentation claims outrunning implementation reality
- Fragmentation between spec and implementation semantics
