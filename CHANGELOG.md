# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- Initial catalog: 28 skills covering Ink 7.1.1 core (components, hooks,
  rendering/lifecycle), app-building patterns (architecture, full-screen
  layouts, async/Suspense, testing), and the ecosystem (`@inkjs/ui`, tables,
  charts, markdown/syntax highlighting, decoration, forms, navigation, task
  runners), each with an `ink-ecosystem-overview`-anchored Ink 7 / React 19
  compatibility matrix.
- `scripts/validate.mjs` — structural quality gate (frontmatter, the skills
  CLI's 3-level discovery depth, skill-shadowing, cross-reference integrity).
- `scripts/typecheck-snippets.mjs` — every code sample typechecked against
  real `ink`/`react`/`@inkjs/ui` types.
- `scripts/generate-index.mjs` — derives `skills.sh.json`, both
  `.claude-plugin/*.json` manifests, and the README's skill table from the
  `skills/` tree.
- `scripts/fetch-sources.mjs` / `check-upstream-drift.mjs` and the
  `refresh-upstream` workflow — weekly detection of upstream version drift.
- CI (validate, typecheck, generated-file drift check, discovery smoke test,
  `npm pack --dry-run`) and a tag-triggered, OIDC-trusted-publishing release
  workflow.
