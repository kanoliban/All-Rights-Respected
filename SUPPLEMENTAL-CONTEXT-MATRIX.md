# Supplemental Context Decision Matrix

Status: Active  
Last updated: 2026-02-04

## Operating rule

The repository is the only source of truth for shipped artifacts.  
Files in `migrated-local/` are context inputs, not canonical product state.

## Artifact matrix

| Supplemental artifact | Decision | Why | Canonical action |
|---|---|---|---|
| `migrated-local/OPEN-COLLECTIVE-PLAN.md` | Adopt selectively | Strong execution strategy aligned with ARR philosophy | Extract funding and bounty steps into a repo roadmap and issue templates |
| `migrated-local/all right respected.html` | Reject as canonical direction | Uses registry/DRM/legal-control framing that conflicts with current ARR thesis | Keep only as historical reference; do not merge content |
| `migrated-local/react-app.js` | Reject as canonical direction | Same directional mismatch as legacy HTML; outdated repo references | Keep only as historical reference; do not merge content |
| `migrated-local/Chatgpt transcript.md` | Keep private context | Valuable origin story, not product documentation | Leave untracked and local-only |
| `migrated-local/Claude transcript.md` | Keep private context | Valuable origin story, not product documentation | Leave untracked and local-only |

## Adopt-now extracts from supplemental strategy

1. Funding track
- Open Collective application packet
- Transparent spend policy
- Milestone-based goals tied to concrete deliverables

2. Delivery track
- JS SDK bounty spec
- Python SDK bounty spec
- CLI bounty spec
- Browser extension bounty spec

3. Governance track
- Explicit donor non-control policy
- Completion criteria and payout structure for bounties

## Next canonical docs to create

1. `ROADMAP.md`
- Milestone ladder from protocol docs to first implementation artifacts
- Dates, owners, and acceptance criteria

2. `FUNDING.md`
- Open Collective profile text
- Spend policy and transparency statement
- Donor non-control policy

3. `BOUNTIES.md`
- Bounty specs, submission rubric, and payout rules

## Done in this pass

- Normalized repository links across site pages to `kanoliban/All-Rights-Respected`
- Removed ambiguous SDK schema link to non-canonical repo and pointed to `SPEC.md` section 2
- Updated `react-app.jsx` external links to canonical repository and issues
- Added ignore rules for local transcript and legacy prototype files
