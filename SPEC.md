# ARR Protocol Specification v0.1

> An open protocol for creative attribution in the age of AI

**Version:** 0.1.0
**Status:** Draft
**Updated:** 2026-01-29

---

## Table of Contents

1. [Abstract](#1-abstract)
2. [Attestation Format](#2-attestation-format)
3. [Signature Requirements](#3-signature-requirements)
4. [Embedding Methods](#4-embedding-methods)
5. [Expiration & Revocation](#5-expiration--revocation)
6. [Verification Algorithm](#6-verification-algorithm)
7. [Privacy Considerations](#7-privacy-considerations)
8. [Versioning Strategy](#8-versioning-strategy)
9. [Conformance Levels](#9-conformance-levels)

---

## 1. Abstract

The All Rights Respected (ARR) protocol defines a standard format for attesting creative intent and attribution for works created with AI tools. Unlike traditional copyright or DRM systems, ARR is designed for social recognition rather than legal enforcement.

ARR attestations are:

- **Embeddable** — stored within the file itself, traveling with the work
- **Verifiable** — cryptographically signed, checkable without external services
- **Expirable** — time-limited by default, renewable by intent
- **Revocable** — creators can withdraw attestations at any time
- **Privacy-preserving** — identity is optional; pseudonymous claims are valid

Non-normative interaction guidance is captured in `docs/arr-interaction-layer.md`. This document does not add protocol requirements.

---

## 2. Attestation Format

An ARR attestation is a structured document in JSON or YAML format. All implementations MUST support JSON; YAML support is RECOMMENDED.

### 2.1 Schema

```json
{
  "attestation": {
    "version": "arr/0.1",
    "id": "uuid-v4",
    "created": "ISO-8601 timestamp",
    "creator": "creator identifier",
    "intent": "description of creative intent",
    "tool": "tool/version",
    "upstream": ["array of upstream attestation IDs"],
    "expires": "ISO-8601 date",
    "revocable": true,
    "license": "optional license identifier",
    "extensions": {}
  },
  "signature": "algorithm:base64-encoded-signature"
}
```

### 2.2 Required Fields

| Field       | Type   | Description                                    |
|-------------|--------|------------------------------------------------|
| `version`   | string | Protocol version. Format: `arr/MAJOR.MINOR`    |
| `id`        | string | Unique identifier (UUID v4 recommended)        |
| `created`   | string | ISO-8601 timestamp of attestation creation     |
| `creator`   | string | Creator identifier (see Section 7)             |
| `signature` | string | Cryptographic signature (see Section 3)        |

### 2.3 Optional Fields

| Field        | Type    | Default   | Description                                           |
|--------------|---------|-----------|-------------------------------------------------------|
| `intent`     | string  | —         | Human-readable description of creative intent         |
| `tool`       | string  | —         | Tool used to create the work. Format: `name/version`  |
| `upstream`   | array   | `[]`      | IDs of upstream attestations this work builds upon    |
| `expires`    | string  | 5 years   | ISO-8601 date when attestation expires                |
| `revocable`  | boolean | `true`    | Whether creator can revoke the attestation            |
| `license`    | string  | —         | SPDX license identifier or custom license URL         |
| `extensions` | object  | `{}`      | Custom fields for platform-specific data              |

### 2.4 Example

```json
{
  "attestation": {
    "version": "arr/0.1",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "created": "2026-01-29T10:30:00Z",
    "creator": "hash:sha256:7f3a9b2c4d5e6f...",
    "intent": "Poster design for climate awareness campaign",
    "tool": "midjourney/6.1",
    "upstream": [],
    "expires": "2031-01-29",
    "revocable": true,
    "license": "CC-BY-4.0"
  },
  "signature": "ed25519:kF2h9Jx3mN7pQr..."
}
```

---

## 3. Signature Requirements

All attestations MUST be cryptographically signed. The signature ensures the attestation has not been tampered with and was created by someone with access to the private key.

### 3.1 Supported Algorithms

| Algorithm      | Status      | Notes                                                  |
|----------------|-------------|--------------------------------------------------------|
| `ed25519`      | RECOMMENDED | Fast, small signatures, good security. Primary choice. |
| `ecdsa-p256`   | Supported   | Widely available, good for existing PKI integration.   |
| `rsa-sha256`   | Supported   | Legacy support only. Larger signatures.                |

### 3.2 Signature Format

Signatures are encoded as: `algorithm:base64-encoded-signature`

```
"ed25519:kF2h9Jx3mN7pQrSt8vWxYz..."
```

### 3.3 Signing Process

1. Serialize the `attestation` object to canonical JSON (keys sorted alphabetically, no whitespace)
2. Compute the signature over the serialized bytes
3. Encode the signature as base64
4. Prefix with the algorithm identifier

### 3.4 Key Distribution

ARR does not mandate a specific key distribution mechanism. Implementers MAY use:

- Public key embedded in creator profile
- Web-based key discovery (e.g., `/.well-known/arr-keys`)
- Decentralized identity systems (DID)
- Social proof (linking to verified accounts)

> **Note:** The signature proves control of a private key at the time of signing. It does NOT prove identity unless the public key is linked to a verified identity through an external mechanism.

---

## 4. Embedding Methods

ARR attestations travel with the work. Multiple embedding methods are supported.

### 4.1 File Metadata

#### 4.1.1 Images (JPEG, PNG, WebP)

Store attestation in XMP metadata under the namespace `http://arr.protocol/1.0/`:

```xml
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:arr="http://arr.protocol/1.0/">
      <arr:attestation>{JSON attestation}</arr:attestation>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
```

#### 4.1.2 Audio (MP3, FLAC, WAV)

Store in ID3v2 tag `TXXX:ARR` (MP3) or Vorbis comment `ARR` (FLAC/OGG).

#### 4.1.3 Video (MP4, WebM)

Store in XMP metadata or as a custom atom/box.

#### 4.1.4 Documents (PDF)

Store in XMP metadata stream.

### 4.2 Sidecar Files

For formats that don't support metadata, store attestation in a sidecar file:

```
artwork.png
artwork.png.arr    # contains JSON attestation
```

### 4.3 Steganographic Embedding

For robustness against metadata stripping, implementers MAY additionally embed a hash of the attestation using steganographic methods. This is OPTIONAL and implementation-specific.

> **Warning:** Steganographic embedding may alter the work. Use with care and document the embedding method used.

### 4.4 Content Addressing

Attestations SHOULD include a content hash to bind the attestation to a specific version of the work:

```json
"content_hash": "sha256:abc123..."
```

This hash should be computed over the work's content BEFORE the attestation is embedded.

---

## 5. Expiration & Revocation

### 5.1 Expiration

All attestations have an expiration date. This is a core design principle: nothing is permanent without renewal.

- Default expiration: 5 years from creation
- Maximum expiration: 25 years from creation
- Expired attestations are still valid historical records but SHOULD be displayed differently

### 5.2 Renewal

Creators can renew attestations by issuing a new attestation that references the original:

```json
{
  "attestation": {
    "version": "arr/0.1",
    "id": "new-uuid",
    "created": "2031-01-29T00:00:00Z",
    "creator": "same-creator",
    "renews": "original-attestation-id",
    "expires": "2036-01-29"
  }
}
```

### 5.3 Revocation

If `revocable: true` (the default), creators can revoke attestations.

#### 5.3.1 Revocation Record

```json
{
  "revocation": {
    "attestation_id": "uuid-to-revoke",
    "revoked_at": "2027-06-15T12:00:00Z",
    "reason": "optional explanation"
  },
  "signature": "ed25519:..."
}
```

#### 5.3.2 Revocation Distribution

Revocations can be distributed via:

- Well-known endpoint: `/.well-known/arr-revocations`
- Creator's published revocation list
- Platform-specific mechanisms

> **Note:** Verifiers are not required to check revocation lists. Revocation is a social mechanism, not a technical guarantee.

---

## 6. Verification Algorithm

Verifiers SHOULD implement the following algorithm:

### 6.1 Basic Verification

```javascript
function verify(attestation, signature, publicKey) {
  // 1. Check version compatibility
  if (!supported(attestation.version)) {
    return { valid: false, reason: "unsupported_version" };
  }

  // 2. Check expiration
  if (attestation.expires < now()) {
    return { valid: true, expired: true };
  }

  // 3. Serialize attestation canonically
  const canonical = canonicalize(attestation);

  // 4. Verify signature
  if (!verifySignature(canonical, signature, publicKey)) {
    return { valid: false, reason: "invalid_signature" };
  }

  // 5. Success
  return { valid: true, expired: false };
}
```

### 6.2 Extended Verification (Optional)

Implementers MAY additionally:

- Check content hash against the work
- Query revocation lists
- Verify upstream attestations
- Validate creator identity through external systems

### 6.3 Verification Results

| Status    | Meaning                        | Recommended Display              |
|-----------|--------------------------------|----------------------------------|
| `valid`   | Signature valid, not expired   | Show attestation with confidence |
| `expired` | Signature valid, past expiry   | Show with "expired" indicator    |
| `revoked` | Creator has revoked            | Show with "revoked" or hide      |
| `invalid` | Signature verification failed  | Do not display attestation       |
| `unknown` | Cannot verify (missing key)    | Show with "unverified" indicator |

---

## 7. Privacy Considerations

### 7.1 Creator Identifiers

The `creator` field supports multiple identifier formats:

| Format      | Example                          | Privacy Level        |
|-------------|----------------------------------|----------------------|
| Hash-based  | `hash:sha256:7f3a9b...`          | High (pseudonymous)  |
| Public key  | `pubkey:ed25519:abc...`          | Medium (linkable)    |
| DID         | `did:key:z6Mk...`                | Variable             |
| URL         | `https://example.com/@user`      | Low (identified)     |
| Email hash  | `email:sha256:...`               | Medium (verifiable)  |

### 7.2 Unlinkability

Creators who want attestations to be unlinkable SHOULD:

- Use a unique keypair per attestation
- Use hash-based identifiers derived from random data
- Avoid including identifying information in `intent` or `extensions`

### 7.3 Right to Be Forgotten

Revocation supports the right to be forgotten. However:

- Attestations embedded in files may persist in copies
- Caches and archives may retain attestation data
- The protocol does not guarantee deletion

> **Note:** ARR is designed for recognition, not surveillance. Implementers should minimize data collection and respect creator privacy preferences.

---

## 8. Versioning Strategy

### 8.1 Version Format

Versions follow `arr/MAJOR.MINOR` format:

- **MAJOR**: Breaking changes to required fields or signature format
- **MINOR**: New optional fields, clarifications, non-breaking additions

### 8.2 Compatibility

- Verifiers MUST reject attestations with unknown MAJOR versions
- Verifiers SHOULD accept attestations with higher MINOR versions
- Unknown fields in `extensions` MUST be ignored, not rejected

### 8.3 Version History

| Version    | Date       | Changes                     |
|------------|------------|-----------------------------|
| `arr/0.1`  | 2026-01-29 | Initial draft specification |

---

## 9. Conformance Levels

### 9.1 Level 1: Basic

Minimum viable implementation:

- Parse and display attestation data
- Verify ed25519 signatures
- Check expiration dates

### 9.2 Level 2: Standard

Recommended implementation:

- All Level 1 requirements
- Support multiple signature algorithms
- Embed attestations in file metadata
- Query revocation lists

### 9.3 Level 3: Full

Complete implementation:

- All Level 2 requirements
- Verify upstream attestations
- Support content addressing
- Implement renewal workflows
- Provide creator identity verification

> **Note:** All conformance levels are valid implementations. Platforms should choose the level appropriate for their use case.

---

## License

This specification is released into the public domain under [CC0](https://creativecommons.org/publicdomain/zero/1.0/).

---

*All Rights Respected — Not a company. A protocol. Given away freely.*
