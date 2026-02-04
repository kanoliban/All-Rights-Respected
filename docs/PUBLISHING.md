# ARR Publishing Policy

Status: Active (M1.2 preparation)
Last updated: 2026-02-04

## Intent

Define how ARR transitions from in-repo packages to installable npm distributions without breaking protocol expectations.

## Current State

- Implementation shipped in-repo (`v0.1.0-m1`)
- Workspace packages are intentionally internal-named and private
- npm publication is not yet executed

## Publication Gates

Before first npm publish, all gates must pass:

1. Package naming decision finalized (public names, scope, ownership)
2. `packages/arr-core/package.json` and `packages/arr-cli/package.json` set to publishable metadata
3. `npm run publish:preflight` passes
4. Tag-based release selected (`vX.Y.Z`)
5. CI green on release commit/tag

## Versioning and Compatibility

ARR uses two related version tracks:

- Protocol version (`arr/0.1`): semantic format and verification behavior
- Package version (`npm semver`): implementation release cadence

Rules:

1. Patch/minor package bumps in `0.1.x` must preserve `arr/0.1` verification semantics.
2. Any protocol behavior change requires explicit `SPEC.md` update and mirrored docs update.
3. Breaking API changes require major package bump.

## Release Channels

- `next`: pre-release testing channel
- `latest`: stable channel for supported packages

## Required Metadata (Per Publishable Package)

- `name` (final public package name)
- `version`
- `description`
- `license`
- `repository`
- `bugs`
- `homepage`
- `engines.node`
- `files`

## Automation

Manual workflow:

- `.github/workflows/npm-release.yml`

Supports:

- preflight build/test/pack checks
- optional publish step gated behind workflow input
- publish-readiness validation via `scripts/assert-publish-ready.mjs`

## Commands

```bash
npm run publish:preflight
npm run publish:validate
```

## Naming Decision (Open)

Publication is blocked until final public package names are chosen.

Current policy:

- keep internal names/private flags until naming is approved
- do not publish internal-named packages
