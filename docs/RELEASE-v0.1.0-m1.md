# ARR Release v0.1.0-m1

Date: 2026-02-04

## Summary

This release introduces the first executable ARR reference implementation in this repository.

## Included

- TypeScript/Node workspace for ARR implementation
- `@allrightsrespected/sdk` protocol library
  - canonicalization
  - Ed25519 key generation/signing/verification
  - sidecar read/write
  - PNG (iTXt) metadata embed/extract
  - JPEG (XMP APP1) metadata embed/extract
- `@allrightsrespected/cli` command-line interface
  - `keygen`
  - `attest`
  - `verify`
  - `extract`
- Conformance fixtures in `fixtures/conformance/v0.1`
- Unit and integration tests (`24` passing)
- CI workflow running `npm ci`, `npm run build`, and `npm test`

## CLI Quickstart

```bash
node packages/arr-cli/dist/index.js keygen --out-dir ./keys
node packages/arr-cli/dist/index.js attest ./artwork.png --creator "pubkey:ed25519:<...>" --private-key ./keys/arr-ed25519-private.pem --mode auto
node packages/arr-cli/dist/index.js verify ./artwork.png --json
node packages/arr-cli/dist/index.js extract ./artwork.png --json
```

## M1 Constraints

- Ed25519 only
- Metadata embedding only for PNG and JPEG
- Other formats use sidecar files (`<file>.arr`)
- In-repo implementation only (no npm publish in M1)
