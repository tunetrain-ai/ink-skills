# Claim tests

Every factual statement in `skills/` is proven by an executable test in this directory. Nothing here
is shipped (npm `files` and the skills CLI only take `skills/`), and **skill text never mentions
these tests** — no "verified", "tested", "first frame", "typechecked", no tooling tags on fences.
The link runs the other way: a test quotes the skill text, so editing a sentence breaks the claim
that anchors it and forces re-verification.

```sh
npm run test:setup      # once: installs the pinned external project (network)
npm test                # every claim + the harness self-tests (normalised environment)
npm run test:coverage   # the gate: every unit of every skill is covered by a passing claim
node tests/run.mjs ink-layout   # one claims file
```

## Writing claims — `tests/claims/<skill>.test.mjs`

One file per skill (its `references/*.md` included). Import from `../lib/index.mjs`; never import
`node:test` (collect mode must not run tests).

```js
import { skill, tsx, ink, h, keys, mount } from '../lib/index.mjs';
const s = skill('ink-layout');

// a type-level fact: lines that must fail end in //! TSxxxx; the exact set of (line, code) must match tsc
s.types('SKILL.md', ['`minWidth`/`maxWidth` accept only numbers'], tsx`
import {Box} from 'ink';
export const ok = <Box minWidth={10} minHeight="50%" />;
export const bad = <Box minWidth="50%" />; //! TS2322
`);

// a runtime fact: expected values come from the quote through q.tok(), so the test cannot drift from the text
s.fact('SKILL.md', ["`<Box>`'s default `flexDirection` is `row`"], { kind: 'D' }, async (t, q) => {
  const two = (props) => ink.renderToString(h(ink.Box, props, h(ink.Text, null, 'a'), h(ink.Text, null, 'b')));
  t.equal(two({}), two({ [q.tok('flexDirection')]: q.tok('row') }));
  t.notEqual(two({}), two({ flexDirection: 'column' })); // positive control: the harness can tell them apart
}, );
```

| Call | Use for |
| --- | --- |
| `s.fact(file, quotes, {kind, ctx?, timeout?}, async (t, q) => …)` | anything proven by running code. `kind`: `T` type, `R` runtime, `D` default/enumerated, `P` package status, `X` registry/external fact |
| `s.types(file, quotes, tsx\`…\`, {project?: 'external'})` | type-level facts; one `tsc` run per claims file |
| `s.fence(file, nth, {run?})` | a code fence: compiled by `scripts/typecheck-snippets.mjs`; `run(t, fence)` executes it when the prose describes its output |
| `s.guidance(file, quotes, why, {exempt?})` | a recommendation or pointer that asserts nothing. Needs a real `why`; may not hide fact tokens (list them in `exempt` with the reason in `why`) |

**Quotes** are verbatim substrings of the skill file (whitespace-normalised, `\|` → `|`), unique in
the file (or `{q, nth}`), at least three words or a fact token. A quote may span sentences.

**Fact tokens** — backticked spans, `**bold**` terms, numbers/versions/ranges and `"quoted strings"` —
must each be named by a covering *fact* claim and *read* by it with `q.tok('…')` (or listed in `ctx`
as context). A test with no assertion fails; an unread token fails.

### Rules that keep the tests honest

1. **The test decides, the text follows.** If a claim is false, fix the skill; never weaken a test
   to match a falsehood. If it cannot be proven locally, rewrite it into a provable statement or
   delete it. Volatile values (dates, "dormant", "actively developed") do not belong in prose.
2. **Negative claims need a positive control** ("X is not called" ⇒ show X *is* called for the
   recognised input first).
3. **No fixed sleeps, no `frames.length`.** Use `await app.flush()` / `app.press()` / `waitFor`.
   Lone ESC waits out Ink's pending-escape flush inside `press`.
4. **Layout and style: `ink.renderToString`** (synchronous). **Apps, input, throttling, escape
   sequences: `mount()`** (own fake TTY; `bytes()`, `screen()`). `ink-testing-library` only for claims
   *about* ink-testing-library (it forces `debug: true`, 100 columns, no rows/isTTY).
5. **Import-time or process state** (`CI`, chalk level, supports-hyperlinks, `LINES`, exit codes,
   `SIGINT`): `runIsolated({probe, env, tty, path})` with a probe in `tests/probes/` that prints one
   JSON line. The suite itself runs with `CI` *absent*, `FORCE_COLOR=3`, `COLORTERM=truecolor`
   (see `tests/run.mjs`); `is-in-ci` treats even `CI=''` as CI.
6. **Third-party packages not in the root project** live in `tests/external/` (own lockfile,
   `legacy-peer-deps`). Mount their components with `await externalHarness()` — never the root
   `mount()`, or their hooks see a different ink and silently no-op. `extImport`, `extPkg`,
   `runExternal` for imports in a real process. Do dynamic imports *inside* test bodies.
7. **Node versions.** CI runs 22 and 24. Behaviour that differs (e.g. `require(esm)` error codes)
   states its range and branches on `process.versions`. Run your file on Node 22 before handing in.
8. **Fences** are compiled, not just quoted: tsx/jsx fences importing packages only in
   `tests/external` are routed there automatically; `tests/fence-stubs.json` supplies placeholder
   modules such as `./app.js`. Every comment line inside a fence is a unit too.

## What the gate counts (`tests/coverage.mjs`)

Units, from the markdown lexer: frontmatter description sentences, prose and list sentences, each
table row, each fence, each comment line inside a fence, and headings that read like a statement.
`Related skills:` lines and `metadata.ink` are enforced by `scripts/validate.mjs`. The generated
`ECOSYSTEM_MATRIX` block is one unit. A unit is covered when a claim's quote overlaps it; every
fact token in it must be named by a fact claim; every registered claim must have *passed*.
It also lints shipped skill text (outside `ink-testing`) for wording that mentions the tests;
legitimate uses are allow-listed by exact quote in `tests/lint-allow.json`.

If a skill edit breaks a quote, the failing claim prints the nearest matching text.
