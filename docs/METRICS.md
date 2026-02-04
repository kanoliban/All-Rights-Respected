# ARR Metrics

Status: Active tracking
Last updated: 2026-02-04

## Purpose

Track adoption and contributor throughput to evaluate whether ARR is becoming easier to integrate.

## Snapshot (Baseline)

### Product/Adoption

| Metric | Baseline | Notes |
|---|---:|---|
| GitHub stars | TBD | Populate from repository insights |
| GitHub forks | TBD | Populate from repository insights |
| External integration issues opened | 0 | Issues labeled `integration` |
| External integration PRs merged | 0 | PRs from non-maintainers |
| Release tag | `v0.1.0-m1` | Reference milestone shipped |

### Engineering/Contributor Throughput

| Metric | Baseline | Notes |
|---|---:|---|
| Build status (`main`) | passing | CI workflow in `.github/workflows/ci.yml` |
| Test count | 24 | `npm test` |
| Test pass rate | 100% | Current M1 suite |
| Median PR time-to-merge | TBD | Track once external PR volume exists |
| Open bugs | TBD | Label-driven count |

## Update Cadence

- weekly during active implementation
- monthly once cadence stabilizes

## Collection Notes

- keep entries factual and timestamped
- avoid vanity metrics without context
- annotate any major metric movement with linked issue/PR/release
