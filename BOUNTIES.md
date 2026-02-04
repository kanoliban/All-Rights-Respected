# ARR Bounties (Draft)

Status: Draft  
Last updated: 2026-02-04

## Purpose

Bounties accelerate implementation of open ARR infrastructure with explicit acceptance criteria.

## Cross-bounty rules

1. Each bounty must map to a public issue.
2. Deliverables are reviewed against `SPEC.md`.
3. Payout model:
- 50% on accepted implementation PR,
- 50% on merge + release verification.
4. No closed-source deliverables.
5. Any behavior that makes ARR mandatory for access is out of scope.

## Bounty 1: CLI baseline

Suggested amount: $500

Deliverables:
- `arr attest <file>`
- `arr verify <file>`
- `arr extract <file>`
- sidecar support (`.arr`)

Acceptance criteria:
- supports valid/expired/invalid verification states,
- works on macOS and Linux at minimum,
- includes usage docs and reproducible examples.

## Bounty 2: JavaScript SDK baseline

Suggested amount: $1,500

Deliverables:
- `createAttestation`
- `signAttestation`
- `verifyAttestation`
- `embedAttestation`
- `extractAttestation`
- TypeScript types

Acceptance criteria:
- conformance fixtures pass,
- browser and Node examples included,
- package is published and installable.

## Bounty 3: Python SDK baseline

Suggested amount: $1,500

Deliverables:
- `create_attestation`
- `sign_attestation`
- `verify_attestation`
- `embed_attestation`
- `extract_attestation`

Acceptance criteria:
- Python 3.9+ support,
- type hints included,
- package is published and installable.

## Bounty 4: Browser verification extension

Suggested amount: $2,000

Deliverables:
- detect ARR attestations on supported media,
- display status badges (valid/expired/unverified/none),
- show attestation details on click.

Acceptance criteria:
- privacy-minimal permissions,
- open-source code and release notes,
- installable dev build for reviewer testing.

## Submission checklist

- [ ] linked issue references this bounty section
- [ ] implementation PR includes tests
- [ ] docs updated with actual behavior
- [ ] release artifact verified by maintainer
