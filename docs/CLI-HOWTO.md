# ARR CLI How-To (Creators)

This guide is for creators who want a simple, repeatable way to attest their work.

## Install

```bash
npm install -g @allrightsrespected/cli
```

## One-time setup

```bash
arr init
```

What to know:
- Default config lives at `~/.arr/config.json`.
- Enter or `y` accepts the default.
- `n` skips optional fields.
- For yes/no questions, `y` = Yes and `n` = No.
- If you need a per-project config, use `arr init --local` (writes `./.arr/config.json`).

To see what ARR is using right now:

```bash
arr config
```

## Attest a single file

```bash
arr attest "/path/to/artwork.png"
```

Tips:
- Drag-and-drop the file into the terminal to avoid quoting issues.
- PNG/JPEG files are embedded into metadata by default (new `*.attested.png` file).
- Other file types get a sidecar (`*.arr`).

## Attest a folder

By default, directories only attest PNG/JPEG files:

```bash
arr attest "/path/to/folder" --recursive
```

To include everything (sidecars for non-images):

```bash
arr attest "/path/to/folder" --recursive --all
```

To only include specific extensions:

```bash
arr attest "/path/to/folder" --recursive --types png,jpg,jpeg
```

## Watch a folder (drag & drop)

```bash
arr watch
```

Defaults to `~/ARR-Inbox`. Drop files into that folder to auto-attest them.

To watch a custom folder and include everything:

```bash
arr watch --in "/path/to/folder" --all
```

## Verify or extract

```bash
arr verify "/path/to/file.png"
arr extract "/path/to/file.png"
```

Use `--json` for stable machine output.

## Troubleshooting

- **“no matches found” in zsh**: you forgot to quote a path with spaces/parentheses. Use quotes or drag-and-drop.
- **“file not found”**: check the file extension (the CLI will suggest close matches).
- **Config feels wrong**: run `arr init` again to reset.
- **Check the CLI**: `arr --version` should print the version and exit.
