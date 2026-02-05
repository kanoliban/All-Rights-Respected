# ARR Documentation Map

Status: Canonical map  
Last updated: 2026-02-05

## Source-of-truth files

| File | Role |
|---|---|
| `README.md` | Project narrative and high-level entry point |
| `PLAN.md` | Product strategy and stakeholder-focused sequencing |
| `SPEC.md` | Canonical protocol text (`arr/0.1`) |
| `spec.html` | Rendered spec page for the website (must mirror `SPEC.md`) |
| `creators.html` | Creator-facing onboarding docs |
| `platforms.html` | Platform integration guidance |
| `sdk.html` | SDK-facing documentation and examples |
| `docs/IMPLEMENTATION.md` | M1 implementation and CLI operational guide |
| `docs/CLI-HOWTO.md` | Creator-friendly CLI onboarding (guided setup, drag-and-drop, batch workflows) |
| `docs/RELEASE-v0.1.0-m1.md` | M1 release summary and operational quickstart |
| `docs/RELEASE-v0.1.6.md` | CLI UX stabilization + publish fix notes |
| `docs/PUBLISHING.md` | npm publication policy, compatibility rules, and release gates |
| `docs/METRICS.md` | Adoption and contributor throughput tracking |
| `CONTRIBUTING.md` | Contributor workflow and guardrails |
| `SECURITY.md` | Vulnerability reporting and security response policy |
| `thesis.html` | Philosophy and framing |
| `index.html` | Main public landing page |

## Sync discipline

When protocol semantics change:
1. Update `SPEC.md` first.
2. Update `spec.html` in the same branch before merge.
3. Verify examples in `creators.html`, `platforms.html`, and `sdk.html` still match `SPEC.md`.
4. If implementation docs change, update `ROADMAP.md` milestone states.

## Non-canonical context

Local supplemental files under `migrated-local/` are reference context only and should not be treated as canonical state.
