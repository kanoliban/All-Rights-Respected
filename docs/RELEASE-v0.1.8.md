# ARR Release v0.1.8

Date: 2026-02-05

## Summary

This patch release improves creator UX in the interactive CLI and makes npm installs self-explanatory by shipping package READMEs.

## Included

- Prompt UX fixes
  - Yes/No menus now accept `y` = Yes and `n` = No (even when the default is “No”)
  - Menus still accept Enter (or `y`) to accept the default
- New command: `arr config`
  - Shows which config file was loaded and the effective values
- npm packaging improvements
  - Added READMEs for `@allrightsrespected/cli` and `@allrightsrespected/sdk`

## Quickstart

```bash
npm install -g @allrightsrespected/cli@latest

arr --version
arr init

# Show current config + source
arr config

# Drag & drop inbox
arr watch

# Attest a file
arr attest "/path/to/artwork.png"

# Verify / extract
arr verify "/path/to/artwork.attested.png"
arr extract "/path/to/artwork.attested.png" --json
```

