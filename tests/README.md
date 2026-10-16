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
npm run test:mutate     # the audit: changing a bound token in the text must fail its claim
node tests/run.mjs ink-layout   # claims files whose name contains "ink-layout"
node tests/mutate.mjs ink-layout   # audit only the claims whose id contains it
```

## Writing claims — `tests/claims/<skill>.test.mjs`

One file per markdown file: `<skill>.test.mjs` for `SKILL.md` and `<skill>.<reference>.test.mjs` for
each `references/<reference>.md` (ids are `skill/file#NNN`, numbered per markdown file). Shared
fixtures go in `<skill>.helpers.mjs`. Import from `../lib/index.mjs`; never import `node:test`
(collect mode must not run tests).

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

**Reading is not enough — bind the token.** `npm run test:mutate` changes each token a claim reads
(a digit up, a letter replaced, a suffix) and requires the claim to fail; a token that survives is
bound to nothing. Bind it by using the returned value where the assertion depends on it:

```js
const Gradient = q.api(mod, 'Gradient');            // a named export: a changed name throws
const Box = q.el(ink, '<Box>');                     // a <Component> token
const range = q.tok('ink ^5.1.0').split(' ')[1];    // a value: compare it with the real data
const props = { [q.tok('flexGrow')]: 1 };           // a prop name: a changed name changes the output
t.equal(Number(q.tok('31')), columns);              // a number
```

For a *negative* claim ("X is ignored") bind the token to a positive control first (X is a
recognised option, here is where it is defined), or the mutated name passes just as well. Tokens that
are only context (an illustrative HTML snippet, an emphasis word) go in `ctx`, not in a fake read.

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
   JSON line (a probe for an external package lives in `tests/external/probes/` and is run with
   `project: 'external'`). To feed stdin, print a line `READY` once mounted and pass
   `stdin: [[delayMs, data], …]`; the delays count from that line, not from spawn. The suite itself runs with `CI` *absent*, `FORCE_COLOR=3`, `COLORTERM=truecolor`
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
9. **Run the fence itself, not a copy.** `s.runFence(file, nth, {stubs?, mountOptions?})` transpiles
   the fence as written, points its `from 'ink'` at a shim whose `render()` goes to the recording
   harness, and returns `{mod, apps}`: `mod` has every top-level declaration (exported or not), `apps`
   the mounts its `render(...)` calls made. A fence that imports an external-only package is
   mounted by the external project's Ink automatically. Use `stubs` for placeholder imports; a
   test that retypes the fence's code proves nothing about the text.
10. **Registry and package facts** (a name is not on npm, who maintains it, what it depends on) are
    read from `data/ecosystem.json` by `loadEcosystem()`; they are refreshed by the weekly fetch,
    never typed into a test. Peer ranges and versions of *installed* packages come from `extPkg()` /
    `pkg()` and are compared with `semver`.
11. **No network.** Tests that need an HTTP server start one on `127.0.0.1` (see `serve()` in
    `ink-decoration.helpers.mjs`); installing the external project is the only network use.

## What the gate counts (`tests/coverage.mjs`)

Units, from the markdown lexer: frontmatter description sentences, prose and list sentences, each
table row, each fence, each comment line inside a fence, and headings that read like a statement.
`Related skills:` lines and `metadata.ink` are enforced by `scripts/validate.mjs`. The generated
`ECOSYSTEM_MATRIX` block is one unit. A unit is covered when a claim's quote overlaps it; every
fact token in it must be named by a fact claim; every registered claim must have *passed*.
It also lints shipped skill text (outside `ink-testing`) for wording that mentions the tests;
legitimate uses are allow-listed by exact quote in `tests/lint-allow.json`.

If a skill edit breaks a quote, the failing claim prints the nearest matching text.
