# ARR Release v0.1.6

Date: 2026-02-05

## Summary

This release stabilizes the creator-first CLI experience and fixes a TypeScript strictness issue that blocked publishing.

`@allrightsrespected/cli@0.1.6` is the recommended install for the guided onboarding flow (`arr init`, `arr watch`, bulk folder attestation).

## Included

- CLI UX refinements
  - `arr --version` prints version and exits (no interactive prompts)
  - Setup writes to a global default config: `~/.arr/config.json`
  - Optional per-project config: `arr init --local` writes `./.arr/config.json`
  - Prompts accept `y`/Enter for default and `n` to skip optional fields
  - Safer directory attestation defaults (PNG/JPEG only unless `--all`)
  - Better "file not found" guidance when the extension is missing
- Publishing fix
  - Resolve a `exactOptionalPropertyTypes` mismatch in CLI prompt typing (unblocks CI publish)

## Quickstart

```bash
npm install -g @allrightsrespected/cli@latest

# One-time setup
arr init

# Drag & drop inbox
arr watch

# Attest one file
arr attest "/path/to/artwork.png"

# Bulk attest (PNG/JPEG only by default)
arr attest "/path/to/folder" --recursive

# Include everything (sidecars for non-images)
arr attest "/path/to/folder" --recursive --all
```

## Notes

- If you're using zsh and see "no matches found", quote paths with spaces/parentheses (or drag-and-drop the file into the terminal).
- See `docs/CLI-HOWTO.md` for the full creator workflow.

