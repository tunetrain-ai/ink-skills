# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

## 0.2.0 — 2026-10-17

### Added

- **Every statement in the skills is covered by a test.** Each sentence, list item, table row, code
  fence and fence comment in `skills/` (838 units) is covered by a claim in `tests/claims/` that
  quotes it and proves it against the real packages — rendered output, the published types, the
  escape sequences Ink writes, a clean-process `import()`, npm itself (offline, with stub packages
  that carry each package's real peer ranges). Third-party packages that cannot be installed next to
  Ink 8 are tested from the pinned `tests/external` project. Nothing under `tests/` is published, and
  the skill text does not mention it. `npm test` runs the claims, `npm run test:coverage` is the gate
  (every unit covered by a claim that passed; shipped text may not mention how it was checked),
  `npm run test:mutate` changes each fact a claim reads and requires the claim to fail. CI runs the
  gate on Node 22 and 24. `tests/README.md` explains how to write a claim.
- `npm run validate` rejects a code fence whose info string is anything but a bare language: the
  `tsx no-check` tag is gone and every fence is compiled (or run, where the prose describes its output).

### Fixed — statements the tests disproved

- **Process and rendering:** a pending promise alone does *not* keep an Ink process alive (timers, open
  handles and active input do); `concurrent: true` is *not* required for `Suspense`, `use()`,
  `useTransition` or `useDeferredValue` (it only changes whether `render()` has written its first
  output when it returns); Ctrl+C exits the app before any `useInput` handler unless
  `exitOnCtrlC: false`; `useWindowSize`'s fallback order; resize redraws rather than leaving ghost lines.
- **Components:** `<Static>` counts items (a shrink, a replaced item or a mutated item changes nothing,
  and items are unmounted once written); `<Newline>` beside siblings in a `<Box>` leaves two blank rows;
  `measureElement` does not return zeros during render (only `useBoxMetrics` on the first render does);
  `display` is `flex` or `none`; a `<Box>` without a border or background renders nothing itself;
  custom border glyph sets need all eight glyphs; the `truncate-middle` example output was wrong;
  `useFocus` `isActive: false` and `disableFocus()` semantics; screen-reader output order.
- **Input:** `useInput` fires per keypress, not per character; kitty-protocol behaviour restated as the
  exact escape sequences and flag bits Ink handles; emulator-specific key mappings removed.
- **Ecosystem:** `EmailInput` has no `suggestions` (it is not "the same shape as `TextInput`");
  `ink-chart` cannot even be imported on Ink 8; `ink-confirm-input` fails through its bundled
  `ink-text-input` 3; `ink-picture` works on Ink 8 and its `width`/`height` default to `"100%"`;
  `ink-gradient` colours every line on its own (a single string with `\n` is not one continuous
  gradient); cfonts ignores `space` (`spaceless` works, and `ink-big-text`'s types do not list it);
  `@kud/ink-markdown` has no `<Markdown>` component; `ink-spawn`'s `<Spawn>` does not stop its process
  on unmount and crashes Node when stdin is a file or `/dev/null`; `ink-tab`'s digit shortcuts need Alt.
- Volatile or unprovable text removed: release dates, "dormant", "abandoned", "no current alternative
  exists", opinions about maintenance, and performance claims ("cuts CPU", "reduces flicker", "most
  common cause").

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
  that Ink 8 shipped. The cause was not the repo setting: the `tunetrain-ai`
  organization forbids GitHub Actions from creating or approving pull requests,
  so no repo-level toggle can fix it. It now refreshes `data/ecosystem.json`
  from the registry, pushes `chore/refresh-upstream`, and opens/updates a
  tracking issue instead of a PR; it fails loudly when the registry is
  unreachable instead of reporting "no drift", and flags a newer Ink or a status
  that contradicts a peer range.
- `tsconfig.json` sets `types: ["node"]`. Without it Ink's `NodeJS.WritableStream`
  resolved to `any`, so the typecheck could not notice that `stdout.columns` no
  longer compiles on Ink 8 (only `columns`/`rows`/`isTTY` are rejected;
  `stdout.on('resize', …)` still compiles).
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
  scoped to its job, and it no longer runs a third-party action
  (`create-pull-request`) with a `contents: write` token.

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
