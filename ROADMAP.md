# ARR Roadmap

Status: Active execution plan  
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

- [x] Implement `arr` CLI baseline:
  - `arr attest <file>`
  - `arr verify <file>`
  - `arr extract <file>`
- [x] Support sidecar mode (`<file>.arr`) for all formats
- [x] Support metadata embedding for PNG/JPEG (minimum)
- [x] Publish conformance test fixtures for `arr/0.1`

Exit criteria:
- A creator can generate and verify an attestation locally
- Verification output includes valid/expired/invalid states
- Demo files and fixtures are publicly reproducible

## M1.1 - Adoption readiness (Weeks 4-6)

Outcome: contributors and early integrators can adopt ARR without maintainers as a bottleneck.

- [x] Add release notes for `v0.1.0-m1`
- [x] Add implementation runbook (`docs/IMPLEMENTATION.md`)
- [x] Add product plan and sequencing rationale (`PLAN.md`)
- [x] Add contributor/security/PR-issue templates
- [x] Add metrics section tracking integrations and contributor throughput

Exit criteria:
- External contributor can submit a PR using project templates and docs
- Early adopter can run ARR CLI and understand supported scope without private guidance

## M1.2 - Distribution (Weeks 6-8)

Outcome: ARR is publication-ready with explicit release gates.

- [x] prepare package naming/publication policy and preflight checks (`docs/PUBLISHING.md`)
- [x] add manual npm release workflow (`.github/workflows/npm-release.yml`)
- [x] finalize public package names (`@allrightsrespected/sdk`, `@allrightsrespected/cli`)
- [ ] verify npm scope ownership and maintainer auth for first publish
- [ ] publish stable npm packages

Exit criteria:
- tag-based release flow is documented and automatable
- publication can be executed without ad-hoc maintainer steps

## M2 - SDK and adapter expansion (Weeks 8-12)

Outcome: platform and tool developers can integrate ARR without custom wrappers.

- [ ] publish installable JS/TS core + CLI packages
- [ ] add browser-facing usage examples and API cookbook
- [ ] evaluate helper API additions (`createAttestation`, adapter convenience methods) without breaking `arr/0.1` semantics
- [ ] expand format support beyond PNG/JPEG based on adopter demand

Exit criteria:
- installable package path is stable and documented
- reference integrations can use published packages without repo cloning
- fixture suite expands with new adapter coverage

## M3 - Adoption primitives (Weeks 12-16)

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
