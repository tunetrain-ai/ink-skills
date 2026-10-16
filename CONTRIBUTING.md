# Contributing

## Adding or editing a skill

1. Pick where it belongs in `skills/` — see `skills/ink/SKILL.md`'s routing
   table for the current category structure, and the [Agent Skills
   spec](https://agentskills.io/specification) for `SKILL.md` frontmatter
   rules. Two constraints this repo enforces beyond the spec (see
   `scripts/validate.mjs`):
   - **Max 3 directory levels under `skills/`** — that's as deep as the
     [skills CLI](https://github.com/vercel-labs/skills) walks by default.
   - **No category folder gets its own `SKILL.md`.** A `SKILL.md` in a
     directory that also contains skill subdirectories *shadows* them —
     the CLI's discovery walk stops at the first `SKILL.md` it finds. Keep
     a category's index skill (like `ink-ecosystem-overview`) as a
     *sibling* of its children, not their parent.
2. `name` in frontmatter must equal the skill's directory name, lowercase
   with single hyphens, ≤64 characters. `description` ≤1024 characters,
   third person, naming the real API surface (component/hook/prop names) —
   that's the strongest trigger signal an agent has.
3. Keep `SKILL.md` under ~200 lines; move prop tables and long recipes into
   `references/*.md`.
4. Cross-reference other skills **by name only**, in a `Related skills:`
   line — never a relative path to another skill's directory. The CLI
   installs every skill to a flat `<agent>/skills/<name>/`, so a relative
   link across skills breaks the moment it's installed.
5. Every runnable code sample goes in a ` ```tsx ` fence and is
   typechecked in CI against the real `ink`/`react`/`@inkjs/ui` versions in
   `devDependencies` (packages that cannot be installed next to Ink 8 are
   compiled in `tests/external`). A fence must be complete — imports
   included — and carries a bare language and nothing else; there is no
   opt-out tag (`npm run validate` rejects one). A placeholder module such as
   `./app.js` gets a stub in `tests/fence-stubs.json`.
6. **Verify against the installed `.d.ts` files, not just a package's
   readme.** A package's GitHub readme can be ahead of what's published to
   npm — Ink's own once documented props that didn't exist in the shipped
   types yet. `npm run typecheck` is what catches this; don't skip it.
7. **Every statement is proven by a test, and the skill text never says so.**
   A sentence, list item, table row, code fence or fence comment in `skills/`
   is covered by a claim in `tests/claims/` that quotes it; if the text
   changes, the claim fails as stale and has to be re-proven. Edit a skill →
   run `npm test`, fix or re-anchor the claims it breaks, add claims for what
   you wrote. A claim that cannot be proven locally is rewritten into a form
   that can, or deleted. Never mention tests or verification in a skill
   ("verified", "tested", "first frame", "typechecked" … — the lint fails).
   `tests/README.md` is the guide to writing claims.
8. Run the full gate locally before opening a PR:

   ```sh
   npm ci && npm run test:setup   # once: the root project and the pinned tests/external project
   npm run check      # validate + typecheck + smoke-import + claim tests + coverage gate
   npm run test:mutate   # the audit: changing a token in the text must fail its claim
   npm run index      # regenerate skills.sh.json, .claude-plugin/*.json, README's table, ecosystem tables
   ```

   CI fails if `npm run index` produces a diff you didn't commit.
9. **Recommending a new community package?** Add it to
   `data/ecosystem.json` first (`name`, `group`, `status`, `note`, `skills`),
   run `npm run fetch-sources && npm run check-drift` to fill its registry
   fields, then `npm run index`. Decide `status` by probing it, not by reading
   its peer range — install with strict peers, `import()` it under Node ESM,
   render it (see `docs/SOURCES.md`). `npm run validate` fails if a skill names
   an `ink-*` package that isn't in the data file, or if a status contradicts
   the declared peer range. If the package installs cleanly and ships types,
   add it as a `devDependency` so its snippets are typechecked and
   smoke-imported; otherwise pin it in `tests/external/package.json`. Either
   way add a render recipe and a note spec in
   `tests/claims/ink-ecosystem-overview.helpers.mjs` / `.test.mjs`: the matrix
   test fails for a package it has no recipe for.

## Release process

Releases are tag-triggered (`.github/workflows/release.yml`) and publish to
npm via **trusted publishing (OIDC)** — no `NPM_TOKEN` secret to manage or
rotate.

**One-time setup** (before the first release, on npm's side):

1. Create the `@tunetrain-ai` npm org if it doesn't already exist.
2. Trusted-publisher configuration is set *on an existing package*, so the
   very first publish has to happen the normal way — a maintainer running
   `npm publish --access public` locally, authenticated with their own npm
   account. Every release after that goes through CI.
3. On the package's npm settings page, add a **trusted publisher**: GitHub
   repo `tunetrain-ai/ink-skills`, workflow `release.yml`, environment none.
4. From then on, `id-token: write` in the workflow is all that's needed —
   npm mints a short-lived token scoped to that exact repo + workflow, no
   `NPM_TOKEN` secret involved.

**Cutting a release:**

```sh
npm version <patch|minor|major>   # bumps package.json, regenerates + stages the manifests, commits, tags
git push --follow-tags
```

`npm version` runs the `version` script, which runs `npm run index` and stages
its output, so `.claude-plugin/*.json` carry the new version in the same
commit as `package.json` — without it the release workflow's "generated files
are up to date" gate would fail on every tag.

The tag push triggers `release.yml` (Node 24, no dependency cache — the job can
mint a publish token): runs `npm run check`, verifies
`npm run index` has no diff, publishes with `--provenance`, and cuts a
GitHub Release with the tarball attached.

To rehearse a release without publishing anything, run the workflow manually
via **Actions → Release → Run workflow** with `dry_run` left at its default
(`true`) — every step runs except the actual `npm publish`.

## Upstream drift

`.github/workflows/refresh-upstream.yml` runs weekly, re-resolves every
package in `data/ecosystem.json` from the npm registry (version, peer ranges,
engines, last release, deprecation), and — when anything has moved — pushes
the refreshed fields and the tables generated from them to the
`chore/refresh-upstream` branch and opens (or updates) a tracking issue
labelled `upstream-drift`. That is a *signal*, not a fix: it never changes a
package's `status`, a skill, or a `metadata.ink` stamp, and the issue lists what
needs a human (a newer Ink than the one the catalog targets, a `status` that
now contradicts the declared peer range, a deprecation).

It does not open the pull request itself: the `tunetrain-ai` organization
forbids GitHub Actions from creating or approving pull requests (the API
answers `409 The organization does not allow GitHub Actions to create or approve
pull requests`), and a PR opened with `GITHUB_TOKEN` wouldn't trigger CI
anyway. Open the PR from the link in the issue; CI runs on it as on any other.
(If an org admin ever enables that policy, or the workflow is given a GitHub
App/PAT token, switching the last step to `peter-evans/create-pull-request` is
a small change.)

When the issue appears:

1. Re-probe each affected package against the current Ink — strict-peer
   install, `import()` under Node ESM, render (`docs/SOURCES.md`) — and
   re-read its published `.d.ts` files (not just its readme — see point 6
   above). The claim tests compare `data/ecosystem.json` with the *installed*
   copy of each package, so bump the pin (`devDependencies`, or
   `tests/external/package.json` and its lockfile via `npm install --prefix
   tests/external --legacy-peer-deps`) together with the data, and let the tests
   say which statements stopped being true.
2. Update `status`/`note` in `data/ecosystem.json`, then the skill(s) that
   cover it and their claims, then `npm run index`.
3. If **Ink itself** moved, bump the `ink` devDependency and re-review every
   skill against the new `.d.ts` files; `npm run validate` fails until each
   `metadata.ink` stamp matches the installed `major.minor`.
4. `npm run check` before merging.
