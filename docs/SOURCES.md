# Upstream sources

This catalog is written by hand from the packages below, pinned at the versions
listed here. `.github/workflows/refresh-upstream.yml` runs weekly, re-resolves
each package's `latest` dist-tag, and opens a PR when any of them have moved —
that PR is the signal to re-read the relevant readme and update the affected
skill(s) and their `metadata.<package>` version stamps.

Resolved 2026-09-21 via `npm run fetch-sources`.

> **The GitHub readme is ahead of the published package.** `master`'s
> `readme.md` documents `<Box>` `contentOffsetX`/`contentOffsetY` and
> `useBoxMetrics`/`measureElement` `clientWidth`/`clientHeight` — none of
> which exist in the `ink@7.1.1` types actually published to npm (confirmed
> by reading `node_modules/ink/build/**/*.d.ts` directly, not just the
> readme). `npm run typecheck` is what caught this. **Always author skill
> content against the installed `.d.ts` files, and treat the readme as a
> lead to verify, not a source of truth by itself** — this applies to every
> future refresh, not just this one.

## Core

| Package | Version | Peer deps |
| --- | --- | --- |
| [`ink`](https://github.com/vadimdemedes/ink) | 7.1.1 | `react >=19.2.0`, `@types/react >=19.2.0` |
| [`@inkjs/ui`](https://github.com/vadimdemedes/ink-ui) | 2.0.0 | `ink >=5` |
| [`ink-testing-library`](https://github.com/vadimdemedes/ink-testing-library) | 4.0.0 | `@types/react >=18.0.0` |

## Ecosystem (community packages)

| Package | Version | Peer `ink` | Current for Ink 7 / React 19? |
| --- | --- | --- | --- |
| `ink-text-input` | 6.0.0 | `>=5` | yes |
| `ink-spinner` | 5.0.0 | `>=4.0.0` | yes |
| `ink-select-input` | 6.2.0 | `>=5.0.0` | yes |
| `ink-multi-select` | 2.0.0 | (none declared) | **check before use** — unpinned peer |
| `ink-table` | 3.1.0 | `>=3.0.0` | **stale** — predates Ink 7 |
| `ink-link` | 5.0.0 | `>=6` | yes |
| `ink-gradient` | 4.0.1 | `>=6`, `react >=19.2.0` | yes |
| `ink-big-text` | 2.0.0 | `>=4` | yes |
| `ink-progress-bar` | 3.0.0 | (none declared) | **check before use** — unpinned peer |
| `ink-task-list` | 2.0.0 | `>=3.0.0` | **stale** — predates Ink 7 |
| `ink-form` | 2.0.2 | `>=4` | yes |
| `ink-divider` | 4.1.1 | (none declared) | **check before use** — unpinned peer |
| `ink-tab` | 5.2.0 | `^4 \|\| ^5 \|\| ^6` | yes (does not yet declare `^7`) |
| `ink-chart` | 0.1.1 | `>=2.0.0` | **stale** — predates Ink 7, very early version |
| `ink-scroll-view` | 0.4.0 | `^7` | yes |
| `ink-virtual-list` | 0.3.0 | `^6 \|\| ^7` | yes |
| `ink-markdown` | 1.0.4 | `>=2.0.0` | **stale** — predates Ink 7 |
| `ink-syntax-highlight` | 2.0.2 | `^5.1.0` | **stale** — predates Ink 7 |

"Stale" here means the package's declared peer range predates Ink 7 / React 19,
not that it's necessarily broken — many still work fine because Ink's public
API is largely stable across majors. `skills/ecosystem/ink-ecosystem-overview/`
carries this table forward as the compatibility matrix agents should check
before recommending a package. When `refresh-upstream.yml` reports a version
bump, re-verify the peer range and flip its status here first.
