# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Changed

- **Targets Ink 8.0.0** (requires Node `>=22`, `react` / `@types/react`
  `>=19.3.0`). Every skill's `metadata.ink` stamp is `8.0.0`.
- `ink-layout` and its `scrollable-view` reference document Ink 8's native
  scrolling (`<Box contentOffsetX/contentOffsetY>` with `overflow="hidden"`) and
  `clientWidth`/`clientHeight` on `useBoxMetrics()`/`measureElement()`; `Box`
  `minWidth`/`maxWidth` are number-only.
- `ink-terminal-io` and `ink-rendering-and-lifecycle` cover the generic stream
  typing (`stdout.columns`/`rows`/`isTTY` no longer type-check on `useStdout()`;
  use `useWindowSize()`), `render()` accepting a writable stream, and
  `incrementalRendering` skipping unchanged line prefixes. `ink-input-handling`
  covers `useInput` no longer receiving mouse/focus/cursor-report sequences.
- The ecosystem skills now record what each community package does on Ink 8,
  established by installing it with strict peers, importing it under Node ESM
  and rendering it — not by its declared peer range. Notable results:
  `ink-table`, `ink-markdown`, `ink-progress-bar`, `ink-multi-select`,
  `ink-confirm-input` and `ink-quicksearch-input` are CommonJS builds that
  cannot be loaded on Ink 8, and `ink-divider` bundles Ink 5 and crashes on
  React 19; `ink-tab`, `ink-stepper`, `ink-scroll-view`, `ink-scroll-list`,
  `ink-virtual-list`, `ink-syntax-highlight` and `@mishieck/ink-titled-box`
  have peer ranges that exclude Ink 8 but render on it.
- Recommended packages changed accordingly: `@alcalzone/ink-table` (was
  `ink-table`), `@pppp606/ink-chart` (the charts skill documented its API under
  the unrelated `ink-chart` name), `@mishieck/ink-titled-box` (`ink-titled-box`
  does not exist on npm), `marked` + `marked-terminal` + `cli-highlight` for
  Markdown and code, a `<Box>` border for dividers, and an `@inkjs/ui`
  `TextInput` + `Select` recipe instead of `ink-quicksearch-input`.
- `@inkjs/ui` is no longer described as Anthropic-maintained; it is by Ink's
  authors and has had no release since 2024-05.
- Dependencies: `ink ^8`, `react ^19.3.1`, `typescript ^7`, and the typed,
  Ink-8-installable ecosystem packages as devDependencies so their snippets are
  typechecked. `engines.node` is `>=22` (Ink's own floor; CI previously tested
  Node 20).
- `docs/SOURCES.md` and the compatibility matrix in `ink-ecosystem-overview` are
  now generated from `data/ecosystem.json`, the single source of truth.

### Fixed

- Statements that were already wrong before Ink 8, found by checking every claim
  against the published types and source: `lastFrame()` does not strip ANSI
  codes; `@inkjs/ui` sets no ARIA props, and `aria-role`/`aria-state` are
  `<Box>`-only; Kitty `super`/`hyper`/`capsLock`/`numLock` are `false`, not
  `undefined`; a raw string inside `<Box>` throws rather than being "not
  rendered"; `create-ink-app` scaffolds Ink 4 / React 18 and only offers
  TypeScript behind `--typescript`; `ink-form` has no `multiselect` field; the
  `ink-virtual-list` example passed a prop that doesn't exist and treated
  `renderItem`'s argument as the item; `@alcalzone/ink-table` columns default to
  the keys of *all* rows, not the first; `@inkjs/ui`'s theme `config` is a
  function, not a map; the `measureElement` example claimed a box stretches to
  its parent's width without `flexGrow`; the `ink-testing` keypress example wrote
  `[A` without the ESC byte, so it never reached the `useInput` handler; the
  subprocess recipe in
  `ink-async-and-suspense` re-spawned the process on every render and
  interleaved stdout/stderr lines; an effect that toggled raw mode on every
  render.
- `npm version` now regenerates and stages the `.claude-plugin/*.json`
  manifests (new `version` script). Previously the release workflow's
  "generated files are up to date" gate failed on every tag push.
- `refresh-upstream.yml` had been failing since 2026-10-05 and never reported
  that Ink 8 shipped; it now refreshes `data/ecosystem.json` from the registry,
  fails loudly when the registry is unreachable instead of reporting "no
  drift", and flags a newer Ink or a status that contradicts a peer range.
  (It still needs the repo setting "Allow GitHub Actions to create and approve
  pull requests" — see `CONTRIBUTING.md`.)
- `scripts/lib/skills.mjs` resolves the repo root with `fileURLToPath`, so a
  checkout path containing a space or on Windows works.
- `generate-index.mjs` fails on a skill in a category with no `CATEGORY_META`
  entry instead of silently dropping it from the README and `skills.sh.json`.
- The router-completeness check matches whole skill names (a bare substring
  match was satisfied by `ink-testing` appearing inside `ink-testing-library`),
  and every `Related skills:` line is checked, not only the first.

### Added

- `scripts/validate.mjs` checks that each skill's `metadata.ink` matches the
  installed Ink's `major.minor` (a Dependabot bump of Ink now fails CI until the
  skills are re-reviewed), that `data/ecosystem.json` is well-formed, that each
  status agrees with the package's declared peer range, and that every `ink-*`
  package a skill names is tracked.
- `scripts/smoke-imports.mjs` (`npm run smoke`, part of `npm run check`)
  imports every runtime devDependency under Node ESM — the failure types can't
  show.
- `npm run typecheck` lists the `no-check` fences per file, so the unverified
  fraction is visible (27 of 88 fences before, 8 of 91 now).

### Security

- All GitHub Actions are pinned to full commit SHAs and updated by Dependabot
  as a group; checkouts use `persist-credentials: false` except where a push is
  needed.
- Dependencies install with `npm ci --ignore-scripts` (no dependency declares an
  install script).
- The release workflow no longer restores a dependency cache in the job that
  can mint an OIDC publish token, no longer installs an unpinned
  `npm@latest` (it runs on Node 24 and asserts npm `>=11.5.1`), and passes
  expressions to shell steps through `env`.
- The `skills` CLI used by the discovery smoke test is a locked devDependency
  instead of an unpinned `npx` download.
- Job timeouts on every workflow; refresh-upstream's write permissions are
  scoped to its job.

## 0.1.0 — 2026-09-21

First publish, done by hand (no git tag, GitHub release, or npm provenance
attestation — releases from `release.yml` have all three).

- Initial catalog: 28 skills covering Ink core (components, hooks,
  rendering/lifecycle), app-building patterns (architecture, full-screen
  layouts, async/Suspense, testing), and the ecosystem (`@inkjs/ui`, tables,
  charts, markdown/syntax highlighting, decoration, forms, navigation, task
  runners), each with an `ink-ecosystem-overview`-anchored compatibility matrix.
- `scripts/validate.mjs` — structural quality gate (frontmatter, the skills
  CLI's 3-level discovery depth, skill-shadowing, cross-reference integrity).
- `scripts/typecheck-snippets.mjs` — code samples typechecked against real
  `ink`/`react`/`@inkjs/ui` types.
- `scripts/generate-index.mjs` — derives `skills.sh.json`, both
  `.claude-plugin/*.json` manifests, and the README's skill table from the
  `skills/` tree.
- `scripts/fetch-sources.mjs` / `check-upstream-drift.mjs` and the
  `refresh-upstream` workflow — weekly detection of upstream version drift.
- CI (validate, typecheck, generated-file drift check, discovery smoke test,
  `npm pack --dry-run`) and a tag-triggered, OIDC-trusted-publishing release
  workflow.
