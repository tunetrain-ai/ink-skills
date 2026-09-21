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
5. Every runnable code sample goes in a ` ```tsx ` fence and gets
   typechecked in CI against the real `ink`/`react`/`@inkjs/ui` versions in
   `devDependencies`. Tag a fence ` ```tsx no-check ` only for a
   deliberately partial snippet (missing imports, undefined helper
   components) — not as a way to skip fixing a real type error.
6. **Verify against the installed `.d.ts` files, not just a package's
   readme.** `docs/SOURCES.md` documents a case where Ink's own GitHub
   readme was ahead of what's published to npm — several props it
   documented didn't exist in the shipped types. `npm run typecheck` is
   what catches this; don't skip it.
7. Run the full gate locally before opening a PR:

   ```sh
   npm run check   # validate + typecheck
   npm run index   # regenerate skills.sh.json, .claude-plugin/*.json, README's table
   ```

   CI fails if `npm run index` produces a diff you didn't commit.

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
npm version <patch|minor|major>   # bumps package.json, commits, tags
git push --follow-tags
```

The tag push triggers `release.yml`: validates, typechecks, verifies
`npm run index` has no diff, publishes with `--provenance`, and cuts a
GitHub Release with the tarball attached.

To rehearse a release without publishing anything, run the workflow manually
via **Actions → Release → Run workflow** with `dry_run` left at its default
(`true`) — every step runs except the actual `npm publish`.

## Upstream drift

`.github/workflows/refresh-upstream.yml` runs weekly, re-resolves every
pinned package's `latest` version, and opens a PR bumping the version
numbers in `docs/SOURCES.md` when they've moved. That PR is a *signal*, not
a fix — it deliberately doesn't touch skill content. When it lands:

1. Re-read the affected package's current `.d.ts` files (not just its
   readme — see point 6 above).
2. Update whichever skill(s) reference it, including `metadata.ink`/version
   stamps and, for ecosystem packages, the compatibility status in
   `ink-ecosystem-overview` and `docs/SOURCES.md`'s status column.
3. `npm run check` before merging.
