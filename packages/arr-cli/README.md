# ARR CLI (`@allrightsrespected/cli`)

Creator-first command line tools for the **All Rights Respected (ARR)** attribution protocol.

This CLI lets you:
- generate Ed25519 keys
- attest files (PNG/JPEG embedded into metadata, everything else uses a sidecar)
- verify attestations
- watch a folder for drag-and-drop batch workflows

Docs: https://www.allrightsrespected.com/cli

## Install

```bash
npm install -g @allrightsrespected/cli@latest
```

## One-time setup

```bash
arr init
```

Prompt rules:
- Press Enter or type `y` to accept the default.
- Type `n` to skip optional fields.
- For yes/no questions, `y` = Yes and `n` = No.

Config is saved to `~/.arr/config.json` by default.

## Attest

```bash
arr attest "/path/to/artwork.png"
```

Notes:
- PNG/JPEG writes a new file: `*.attested.png` / `*.attested.jpg`
- Other formats write a sidecar next to the original: `*.arr`

## Watch (drag & drop inbox)

```bash
arr watch
```

Drop files into the watched folder to auto-attest them with your saved defaults.

## Verify / Extract

```bash
arr verify "/path/to/file.png"
arr extract "/path/to/file.png" --json
```

## License

CC0-1.0

