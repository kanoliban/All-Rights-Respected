# ARR Documentation Map

Status: Canonical map  
Last updated: 2026-02-04

## Source-of-truth files

| File | Role |
|---|---|
| `README.md` | Project narrative and high-level entry point |
| `SPEC.md` | Canonical protocol text (`arr/0.1`) |
| `spec.html` | Rendered spec page for the website (must mirror `SPEC.md`) |
| `creators.html` | Creator-facing onboarding docs |
| `platforms.html` | Platform integration guidance |
| `sdk.html` | SDK-facing documentation and examples |
| `docs/IMPLEMENTATION.md` | M1 implementation and CLI operational guide |
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
