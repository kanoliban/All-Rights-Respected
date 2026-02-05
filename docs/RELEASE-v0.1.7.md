# ARR Release v0.1.7

Date: 2026-02-05

## Summary

This patch release fixes onboarding pitfalls in `arr init` and makes the interactive CLI harder to misconfigure.

If you previously ended up with defaults like `Creator: y` or `Default watch folder: y`, rerun `arr init` after upgrading.

## Included

- Safer interactive prompts
  - Menu questions re-prompt on invalid input (no silent fallback if you paste a command by accident)
  - `arr init` ignores legacy `y/n` placeholder values when offering defaults
  - Choosing `fixed` intent without providing a label now falls back to omitting intent (instead of saving an unusable fixed policy)
  - `arr init` output ends with a newline (clean return to shell prompt)

## Quickstart

```bash
npm install -g @allrightsrespected/cli@latest

arr --version
arr init

# Drag & drop inbox
arr watch

# Attest a file
arr attest "/path/to/artwork.png"

# Verify / extract
arr verify "/path/to/artwork.attested.png"
arr extract "/path/to/artwork.attested.png" --json
```

