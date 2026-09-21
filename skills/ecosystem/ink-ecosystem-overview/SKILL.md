---
name: ink-ecosystem-overview
description: Decision guide and Ink 7 / React 19 compatibility matrix for the Ink component ecosystem — which third-party package to reach for, and which ones have peer ranges that predate the current Ink major. Load this before recommending any third-party ink-* or @inkjs/ui package.
metadata:
  ink: "7.1.1"
  category: ecosystem
---

# Ink ecosystem overview

Ink's own component set is deliberately small — layout, text, a handful of
hooks. Everything else (inputs, tables, charts, decoration) lives in
separate packages of wildly varying maintenance status. This skill is the
map; the `inkjs-ui-*`, `ink-tables`, `ink-charts`, `ink-markdown-and-code`,
`ink-decoration`, `ink-forms`, `ink-navigation`, and `ink-task-runners`
skills hold the actual usage detail.

## Decision table

| Need | Reach for | Notes |
| --- | --- | --- |
| Text/email/password input, confirm, select, multi-select | `@inkjs/ui` (`inkjs-ui-inputs`) | Anthropic/Vadim-maintained, current for Ink 7. Default choice for interactive prompts. |
| Spinner, progress bar, status/alert messages, badges | `@inkjs/ui` (`inkjs-ui-feedback`) | Same package as above. |
| Bullet/numbered lists | `@inkjs/ui` (`inkjs-ui-lists`) | Same package. |
| Tabular data | `ink-table`, or a hand-rolled `<Box>` grid | `ink-table` (`ink-tables`) |
| Sparklines / bar / line charts | `ink-chart` | `ink-charts` — young package, verify its API against your installed version. |
| Rendering Markdown or highlighted code | `ink-markdown`, `ink-syntax-highlight` | `ink-markdown-and-code` |
| Links, gradients, big ASCII text, dividers | `ink-link`, `ink-gradient`, `ink-big-text`, `ink-divider` | `ink-decoration` |
| A full multi-field form | `ink-form` | `ink-forms` |
| Tabs, step wizards, scrollable/virtualized lists | `ink-tab`, `ink-stepper`, `ink-scroll-view`/`ink-scroll-list`/`ink-virtual-list` | `ink-navigation` |
| A task-list UI, spawning subprocesses | `ink-task-list`, `ink-spawn` | `ink-task-runners` |

## Compatibility matrix (verified against ink 7.1.1 / react 19.2)

| Package | Peer `ink` range | Status |
| --- | --- | --- |
| `@inkjs/ui` | `>=5` | current |
| `ink-testing-library` | (`@types/react >=18`) | current |
| `ink-text-input` | `>=5` | current |
| `ink-spinner` | `>=4.0.0` | current |
| `ink-select-input` | `>=5.0.0` | current |
| `ink-multi-select` | unpinned | **check before use** |
| `ink-table` | `>=3.0.0` | **stale** — predates Ink 7 |
| `ink-link` | `>=6` | current |
| `ink-gradient` | `>=6`, react `>=19.2.0` | current |
| `ink-big-text` | `>=4` | current |
| `ink-progress-bar` | unpinned | **check before use** — also uses a removed `<Color>` API in its own examples; see `ink-task-runners` for the caveat |
| `ink-task-list` | `>=3.0.0` | **stale** — predates Ink 7 |
| `ink-form` | `>=4` | current |
| `ink-divider` | unpinned | **check before use** |
| `ink-tab` | `^4 \|\| ^5 \|\| ^6` | current-ish — doesn't yet declare `^7` explicitly |
| `ink-chart` | `>=2.0.0` | **stale peer declaration** — but a very young/actively-developed package; verify its actual current API, which may be ahead of what's documented here |
| `ink-scroll-view` | `^7` | current |
| `ink-scroll-list` | `^7` (built on `ink-scroll-view`) | current |
| `ink-virtual-list` | `^6 \|\| ^7` | current |
| `ink-markdown` | `>=2.0.0` | **stale** — predates Ink 7 |
| `ink-syntax-highlight` | `^5.1.0` | **stale** — predates Ink 7 |
| `ink-confirm-input` | unpinned, very old (pre-hooks era examples) | **legacy** — prefer `@inkjs/ui`'s `ConfirmInput` |
| `ink-quicksearch-input` | unpinned | **check before use** |

"Stale" means the package's declared peer range predates Ink 7 / React 19 —
not necessarily broken, since Ink's public component/hook API has stayed
largely stable across majors, but **verify before recommending it in new
code**: check the installed version's actual `peerDependencies` (`npm view
<package> peerDependencies`), and prefer a current alternative when one
exists in the table above. When no current alternative exists (`ink-table`,
`ink-markdown`, `ink-syntax-highlight` have none), say so plainly rather than
silently treating the package as fully current.

Related skills: inkjs-ui-inputs, inkjs-ui-feedback, ink-tables, ink-charts
