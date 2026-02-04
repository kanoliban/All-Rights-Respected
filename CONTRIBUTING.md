# Contributing to ARR

Thanks for contributing to All Rights Respected (ARR).

This project is protocol infrastructure. Keep contributions aligned with three constraints:

1. ARR is optional. Never make attestation mandatory for access.
2. ARR is recognition infrastructure, not legal enforcement.
3. `SPEC.md` is canonical for protocol semantics.

## What to Work On

Good contribution lanes:

- protocol correctness and verification behavior
- adapter support and fixture coverage
- docs clarity where behavior and examples diverge
- developer tooling and test reliability

Before starting, open or link a GitHub issue describing scope.

## Local Setup

```bash
npm install
npm run build
npm test
```

## Repository Map

- `SPEC.md`: canonical protocol text
- `packages/arr-core`: core protocol implementation
- `packages/arr-cli`: CLI commands (`keygen`, `attest`, `verify`, `extract`)
- `fixtures/conformance/v0.1`: conformance vectors and media fixtures
- `tests`: integration tests

## Branching and PRs

1. Branch from `main`.
2. Keep PRs scoped to one major concern.
3. Include tests/fixtures for behavior changes.
4. Update docs in the same PR when behavior changes.

## Required Before PR

- `npm run build` passes
- `npm test` passes
- changed behavior is covered by tests
- relevant docs updated (`README.md`, `sdk.html`, `creators.html`, `platforms.html`, `PLAN.md`, `ROADMAP.md`)

## Commit Style

Use concise commit messages with clear intent, for example:

- `feat(arr): add webp metadata adapter`
- `fix(arr-cli): return non-zero exit on invalid verification`
- `docs(arr): sync sdk examples with core behavior`

## Protocol and Docs Sync

If protocol semantics change:

1. update `SPEC.md` first
2. update `spec.html` mirror in same branch
3. align examples in creator/platform/sdk docs

## Out of Scope Contributions

Do not submit changes that:

- require ARR for platform visibility/access
- frame ARR as DRM or ownership enforcement
- introduce closed-source dependencies for core protocol behavior
