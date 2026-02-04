# Security Policy

## Supported Versions

Security fixes are currently provided for the latest state of `main` and the latest `0.1.x` milestone tag.

## Reporting a Vulnerability

Please report security issues privately. Do not open public issues for vulnerabilities.

Preferred channels:

1. GitHub Security Advisory for this repository
2. email: `hello@allrightsrespected.com` with subject `ARR security report`

Please include:

- affected component (`arr-core`, `arr-cli`, adapter path)
- reproduction steps
- impact assessment
- suggested mitigation if available

## Response Expectations

- initial acknowledgement target: within 72 hours
- triage and severity assessment: as soon as reproducible
- fix plan and disclosure timing coordinated with reporter

## Scope Notes

ARR is attribution infrastructure, not identity enforcement.

Security work should prioritize:

- signature verification correctness
- parser safety for untrusted metadata/sidecar input
- deterministic canonicalization behavior
- safe handling of malformed payloads
