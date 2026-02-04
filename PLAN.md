# ARR Product Plan

Status: Active
Last updated: 2026-02-04

## Purpose

Define what ARR should ship next after M1, why it matters, and how each stakeholder group gets value.

- `ROADMAP.md` = milestone checklist
- `PLAN.md` = product strategy and sequencing rationale

## Current Position

M1 is shipped and tagged (`v0.1.0-m1`) with:

- reference implementation in-repo (`packages/arr-core`, `packages/arr-cli`)
- PNG/JPEG metadata support + sidecar fallback
- Ed25519 signing and verification
- conformance fixtures and passing tests
- CI running build/test gates

The primary risk is now adoption and trust, not feasibility.

## Progress Since v0.1.0-m1

Completed:

- release notes published in-repo (`docs/RELEASE-v0.1.0-m1.md`)
- contributor operations docs (`CONTRIBUTING.md`, `SECURITY.md`)
- GitHub issue templates and PR template added
- baseline metrics page created (`docs/METRICS.md`)
- npm publication policy + release workflow scaffolding added (`docs/PUBLISHING.md`, `.github/workflows/npm-release.yml`)
- public package names finalized (`@allrightsrespected/sdk`, `@allrightsrespected/cli`)

## Stakeholders and Needs

### Creators

Needs:
- simple way to attest and verify files
- clear privacy options
- confidence that attestations are portable

Plan impact:
- improve CLI usability and onboarding docs
- add practical examples for creative workflows

### Platforms

Needs:
- low-friction verifier integration
- stable output contract
- clear UI status rules (`valid`, `expired`, `invalid`, `unverified`, `none`)

Plan impact:
- publish verifier integration recipe + reference UI states
- keep verification semantics stable in `0.1.x`

### Developers / OSS Contributors

Needs:
- clear architecture and contribution workflow
- deterministic tests and fixtures
- a focused next-scope backlog

Plan impact:
- contribution docs and issue templates
- scoped milestone targets (M1.1, M1.2)

### Partners / Supporters

Needs:
- evidence of execution
- transparent roadmap and milestones
- concrete adoption metrics

Plan impact:
- release notes, tagged milestones, progress reporting

## Product Strategy (Next)

## Phase M1.1 (2-4 weeks): Adoption Readiness

Goals:
- make ARR easy to consume and contribute to

Deliverables:
1. Publish GitHub release notes for `v0.1.0-m1` (already drafted in repo)
2. Add contributor operations docs:
   - `CONTRIBUTING.md`
   - `SECURITY.md`
   - issue/PR templates
3. Tighten CLI ergonomics:
   - consistent error codes and docs
   - expanded quickstart examples
4. Add project metrics section (downloads when published, stars, forks, integrations)

Success criteria:
- first external contributor PR merged
- first external integration issue opened by a platform/tool developer

## Phase M1.2 (4-8 weeks): Distribution

Goals:
- reduce integration friction via package distribution

Deliverables:
1. prepare package naming and publish policy
2. publish stable npm packages (core + CLI)
3. document compatibility guarantees for `arr/0.1`

Success criteria:
- users can install without cloning repo
- versioned upgrade path documented

## Phase M2 (8-16 weeks): Protocol Breadth

Goals:
- expand practical file-format coverage and trust surface

Candidate deliverables (pick in order):
1. WebP/PDF embedding support
2. revocation and renewal reference primitives
3. expanded conformance vectors and cross-implementation tests

Success criteria:
- at least one non-image format supported end-to-end
- revocation/renewal behavior testable in fixtures

## Non-Goals (For Now)

- legal enforcement workflows
- mandatory ARR gatekeeping
- centralized identity or registry dependencies

## Execution Rules

1. Keep `SPEC.md` canonical for protocol semantics.
2. Keep docs and implementation synchronized in same branch.
3. Prefer one major expansion axis at a time (distribution OR format breadth OR revocation), not all simultaneously.
4. Every new feature must include tests and fixtures when applicable.

## Immediate Priority Order

1. add metrics section (adoption + contributor throughput) and update it on a cadence
2. verify npm scope ownership + maintainer auth for `@allrightsrespected/*`
3. execute first npm release from a version tag via release workflow
