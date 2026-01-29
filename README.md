# All Rights Respected

> An open protocol for creative attribution in the age of AI.

**Free to implement. Impossible to own. Designed to be given away.**

## What is ARR?

ARR (All Rights Respected) is an open protocol for creative attribution. It allows creators to attach attestations to their AI-generated works, declaring their creative intent and establishing attribution—without centralized registries, licensing fees, or corporate control.

## The Five Articles

1. **Intent is Authorship** — The one who directs creation holds creative claim.
2. **Infrastructure Must Be Free** — Protocols that charge become products. Products compete. Competition fragments.
3. **Respect Scales, Control Doesn't** — We build for billions by building for trust, not litigation.
4. **The Right to Disappear** — Attestations expire. Creators revoke. Nothing is permanent without renewal.
5. **Absence is Valid** — Work without attestation deserves equal respect.

## Quick Start

### For Creators

Add an ARR attestation to your work:

```json
{
  "attestation": {
    "version": "arr/0.1",
    "id": "your-uuid-here",
    "created": "2026-01-29T10:30:00Z",
    "creator": "hash:sha256:your-identity-hash",
    "intent": "Your creative intent description",
    "tool": "midjourney/6.1",
    "expires": "2031-01-29",
    "revocable": true
  },
  "signature": "ed25519:your-signature"
}
```

### For Platforms

1. Read the [Protocol Specification](./SPEC.md)
2. Implement attestation detection (check XMP metadata, sidecar files)
3. Display attestation information to users
4. (Optional) Verify signatures

### For Developers

```bash
# Clone the repository
git clone https://github.com/allrightsrespected/arr.git

# Run the site locally
cd arr
npx serve .
```

## Project Structure

```
allrightsrespected/
├── index.html       # Main manifesto site
├── spec.html        # Protocol specification (HTML)
├── SPEC.md          # Protocol specification (Markdown)
├── react-app.jsx    # React component version
└── README.md        # This file
```

## Deploying

The site is static HTML. Deploy anywhere:

**Vercel:**
```bash
vercel
```

**Netlify:**
```bash
netlify deploy --prod
```

**GitHub Pages:**
Push to `gh-pages` branch or enable Pages in repository settings.

## Contributing

This is an open protocol. Contributions are welcome:

1. **Specification feedback** — Open an issue or discussion
2. **Implementation libraries** — Submit a PR to add your library
3. **Platform integrations** — Let us know if you've implemented ARR

## License

- **Specification:** CC0 (Public Domain)
- **Website code:** MIT

---

*All Rights Respected — Not a company. A protocol. Given away freely.*
