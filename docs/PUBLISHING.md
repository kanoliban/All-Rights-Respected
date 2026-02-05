# ARR Publishing Policy

Status: Active (M1.2 preparation)
Last updated: 2026-02-04

## Intent

Define how ARR transitions from in-repo packages to installable npm distributions without breaking protocol expectations.

## Current State

- Implementation shipped in-repo (`v0.1.0-m1`)
- Package names selected:
  - `@allrightsrespected/sdk`
  - `@allrightsrespected/cli`
- Packages are published to npm (SDK `0.1.x`, CLI `0.1.x`)
- Release workflow uses Trusted Publishing (OIDC) with provenance
- `NPM_TOKEN` is not required for releases

## Publication Gates

Before first npm publish, all gates must pass:

1. npm scope ownership and Trusted Publishing verified
2. `npm run publish:validate` passes
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

Manual workflow (OIDC):

- `.github/workflows/npm-release.yml`

Supports:

- preflight build/test/pack checks
- optional publish step gated behind workflow input
- publish-readiness validation via `scripts/assert-publish-ready.mjs`
- no long-lived token required

## Commands

```bash
npm run publish:preflight
npm run publish:validate
```

## Scope and Ownership (Resolved)

- npm org `@allrightsrespected` is active
- GitHub Actions is configured as a Trusted Publisher for this repo
- Tokens should remain revoked unless a manual emergency publish is required
