# ARR SDK (`@allrightsrespected/sdk`)

TypeScript/Node reference implementation for the **All Rights Respected (ARR)** attribution protocol.

Includes:
- canonicalization
- Ed25519 signing and verification
- sidecar read/write (`<file>.arr`)
- PNG/JPEG metadata embed/extract (M1 scope)

Protocol docs: https://www.allrightsrespected.com/spec  
SDK docs: https://www.allrightsrespected.com/sdk

## Install

```bash
npm install @allrightsrespected/sdk
```

## Usage (high level)

If you want the full creator workflow, use the CLI instead:

```bash
npm install -g @allrightsrespected/cli
arr init
arr attest "/path/to/artwork.png"
```

If you’re embedding ARR into your own tool/platform, import the SDK and integrate signing/verification plus adapters.

## License

CC0-1.0

