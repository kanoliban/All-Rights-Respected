# All Rights Respected

---

I don't know if this will work.

I don't even know if it's needed.

But here's what I do know: I can sit at a keyboard, type a few words, and something that didn't exist before now exists. A poster. A song. A story. The machine and I, collaborating on something neither of us could make alone.

And then what?

The legal frameworks are still being written. The courts are deliberating. The platforms are scrambling. Everyone is trying to figure out who owns what, who owes whom, who gets to decide.

I don't have those answers.

What I have is a small idea: **what if we just... respected each other?**

Not enforced. Not litigated. Not DRM'd into oblivion. Just... respected.

You made something? Say so. Attach a little note that says "I made this, here's when, here's how." If someone sees it, maybe they'll believe you. Maybe they won't. But the note travels with the work, and anyone who cares to look can see it.

That's it. That's the whole idea.

---

## What this is

**ARR** (All Rights Respected) is an open protocol for creative attribution. It's a format for saying "I made this" in a way that:

- Lives inside the file itself
- Can be verified cryptographically
- Expires after a few years (nothing is permanent)
- Can be revoked if you change your mind
- Requires no company, no registry, no fees

It's infrastructure. Like QR codes. Like email. Something anyone can implement, owned by no one.

## What this isn't

- **Legal proof.** This won't hold up in court. It's not designed to.
- **Identity verification.** You can be anonymous. Pseudonymous. Whatever you want.
- **A requirement.** Work without ARR deserves the same respect as work with it.
- **A business.** There's no company here. No funding round. Just an idea.

## Why now

The vocabulary for "AI-generated content attribution" is being defined right now. Whoever writes the dictionary shapes the conversation.

I'd rather the dictionary be written by people who make things than by people who sue people who make things.

## If you're curious

- [Read the protocol](https://allrightsrespected.com/spec.html)
- [See the site](https://allrightsrespected.com)

## If you want to help

I genuinely don't know what help looks like yet. Maybe you implement it in your tool. Maybe you poke holes in the spec. Maybe you tell me this is naive and won't work.

All of that is useful.

- [Contributing guide](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## Working docs

- [Documentation map](DOCS-MAP.md)
- [Product plan](PLAN.md)
- [Implementation guide (M1)](docs/IMPLEMENTATION.md)
- [Release notes (v0.1.0-m1)](docs/RELEASE-v0.1.0-m1.md)
- [Publishing policy](docs/PUBLISHING.md)
- [Metrics](docs/METRICS.md)
- [Roadmap](ROADMAP.md)
- [Funding model](FUNDING.md)
- [Bounty framework](BOUNTIES.md)

## M1 reference implementation (in this repo)

Current implementation status is build-first and in-repo.
Published npm packages: `@allrightsrespected/sdk` and `@allrightsrespected/cli` (v0.1.0).

```bash
npm install -g @allrightsrespected/cli
npm install @allrightsrespected/sdk

npm install
npm run build
npm test
```

CLI location and examples:

```bash
arr keygen --out-dir ./keys
arr attest ./artwork.png --creator "pubkey:ed25519:..." --private-key ./keys/arr-ed25519-private.pem --mode auto
arr verify ./artwork.png --json
arr extract ./artwork.png --json

node packages/arr-cli/dist/index.js keygen --out-dir ./keys
node packages/arr-cli/dist/index.js attest ./artwork.png --creator "pubkey:ed25519:..." --private-key ./keys/arr-ed25519-private.pem --mode auto
node packages/arr-cli/dist/index.js verify ./artwork.png --json
node packages/arr-cli/dist/index.js extract ./artwork.png --json
```

Known limitations (M1):
- Ed25519 only
- PNG/JPEG metadata + sidecar only
- No browser bundles yet

---

*Earnestly,*

*January 2026*
