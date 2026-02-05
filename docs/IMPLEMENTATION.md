# ARR M1 Implementation Guide

This document is the canonical implementation companion for the M1 reference build in this repository.

## Scope (M1)

- Runtime: Node.js + TypeScript
- Algorithm: Ed25519 only
- Storage modes:
  - Sidecar (`<file>.arr`) for any file type
  - Metadata embed for PNG and JPEG
- Commands:
  - `keygen`
  - `attest`
  - `verify`
  - `extract`

Out of scope in M1: browser extension or platform plugins, ECDSA/RSA, WebP/PDF/MP3/FLAC embedding.

## Repository Layout

```text
packages/arr-core/               # protocol core + adapters
packages/arr-cli/                # CLI implementation
fixtures/conformance/v0.1/       # signed payloads + media fixtures
tests/                           # CLI integration tests
```

## Local Development

```bash
npm install
npm run build
npm test
```

If your environment is network-restricted, install and test steps will fail until npm registry access is available.

## CLI Cookbook

This cookbook uses repo-local invocation (`node packages/arr-cli/dist/index.js ...`). If you installed the CLI from npm, swap in `arr ...` instead. For the creator-focused flow (`arr init`, `arr watch`, batch defaults), see `docs/CLI-HOWTO.md`.

### 1) Generate keys

```bash
node packages/arr-cli/dist/index.js keygen --out-dir ./keys
```

Outputs:
- `./keys/arr-ed25519-private.pem`
- `./keys/arr-ed25519-public.pem`

### 2) Attest a PNG/JPEG (metadata path)

```bash
node packages/arr-cli/dist/index.js attest ./artwork.png \
  --creator "pubkey:ed25519:<base64url>" \
  --private-key ./keys/arr-ed25519-private.pem \
  --intent "Poster design for climate campaign" \
  --tool "midjourney/6.1" \
  --mode auto
```

By default this writes a new file:
- `./artwork.attested.png`

### 3) Attest any other format (sidecar path)

```bash
node packages/arr-cli/dist/index.js attest ./track.wav \
  --creator "pubkey:ed25519:<base64url>" \
  --private-key ./keys/arr-ed25519-private.pem \
  --mode auto
```

Outputs:
- `./track.wav.arr`

### 4) Verify

```bash
node packages/arr-cli/dist/index.js verify ./artwork.attested.png
node packages/arr-cli/dist/index.js verify ./track.wav --public-key ./keys/arr-ed25519-public.pem
```

### 5) Extract

```bash
node packages/arr-cli/dist/index.js extract ./artwork.attested.png --json
node packages/arr-cli/dist/index.js extract ./track.wav --json
```

## JSON Output Contract

Success envelope:

```json
{
  "ok": true,
  "command": "verify",
  "data": {}
}
```

Error envelope:

```json
{
  "ok": false,
  "command": "attest",
  "error": {
    "code": "unsupported_format",
    "message": "Metadata mode currently supports only PNG and JPEG files. Use --mode sidecar instead."
  }
}
```

## Verification Semantics

- `valid: true, expired: false`: signature valid and active
- `valid: true, expired: true`: signature valid but expiry date is in the past
- `valid: false, reason: "invalid_signature"`: signature mismatch/tampering
- `valid: false, reason: "unsupported_version"`: version is not `arr/0.1` in M1
- `valid: false, reason: "malformed"`: payload structure or fields invalid
- `valid: false, reason: "missing_public_key"`: no explicit key and no parsable `pubkey:ed25519:...` creator

## Conformance Fixtures

Fixtures are in `fixtures/conformance/v0.1` and are consumed by unit/integration tests.

The fixture private key is test-only and must never be used for production content.
