// Claims for skills/ink/SKILL.md (the router).
//
// A routing row says "this skill covers these APIs". It is proven by (1) every API the row names
// existing where it should (Ink, React, @inkjs/ui, an installed package, Ink's own declarations)
// and (2) the named skill actually mentioning it. Behavioural facts the router states in passing
// (bare text is an error, `useInput` drops unknown sequences, which packages cannot be loaded)
// have claims of their own.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import semver from 'semver';
import { parse as parseYaml } from 'yaml';
import React from 'react';
import { skill, tsx, h, ink, mount, stripAnsi, loadEcosystem, ROOT, extImport } from '../lib/index.mjs';
import { allSkillFiles, loadFile } from '../lib/claims.mjs';
import { factTokens } from '../lib/units.mjs';
import { installed, versionOf, loadsInCleanProcess, renderOnInk8 } from './ink-ecosystem-overview.helpers.mjs';

const { Box, Text, useInput, renderToString } = ink;
const s = skill('ink');
const F = 'SKILL.md';

const data = await loadEcosystem();
const INK = versionOf('ink');
const REACT = versionOf('react');
const byName = (name) => data.packages.find((p) => p.name === name);
const render = (element, columns = 40) => renderToString(element, { columns });
const frontmatter = (name, file = 'SKILL.md') => parseYaml(loadFile(name, file).raw.match(/^---\n([\s\S]*?)\n---/)[1]);
const skills = new Map(allSkillFiles().map((entry) => [entry.skill, entry]));
const skillText = (name) => skills.get(name).files.map((file) => loadFile(name, file).raw).join('\n');
const bindInk = (t, q) => q.tokens.includes('8') && t.equal(Number(q.tok('8')), semver.major(INK), 'Ink 8');
const BIG = { timeout: 120_000 };

// ===================================================================== frontmatter

s.fact(F, ['Router for building terminal UIs (CLIs, TUIs) with Ink, the React renderer for command-line apps built on Yoga flexbox.'], { kind: 'P' }, async (t) => {
  const { dependencies, peerDependencies } = installed('ink').json;
  t.ok('react-reconciler' in dependencies, 'Ink is a React renderer: it is built on react-reconciler');
  t.ok('yoga-layout' in dependencies, 'with Yoga for layout');
  t.ok('react' in peerDependencies, 'and React is its peer');
  t.equal(frontmatter('ink').metadata.category, 'router', 'and this skill is the router');
});

s.guidance(F, ['Use when the user is building, styling, or debugging a Node.js/TypeScript command-line interface with React — mentions Ink, <Box>/<Text>, a TUI, an interactive CLI, or terminal rendering.'], 'the trigger description that tells an agent when to load the skill; it makes no claim about behaviour');

s.fact(F, ['Points to focused sub-skills for layout, components, hooks, testing, and the component ecosystem (@inkjs/ui, ink-spinner, ink-form, etc.) rather than answering from general React knowledge.'], { kind: 'P' }, async (t) => {
  for (const name of ['ink-layout', 'ink-text-styling', 'ink-input-handling', 'ink-testing', 'ink-ecosystem-overview']) t.ok(skills.has(name), `a sub-skill ${name} exists`);
  for (const name of ['@inkjs/ui', 'ink-spinner', 'ink-form']) {
    const entry = byName(name);
    t.ok(entry && entry.skills.every((owner) => skills.has(owner)), `${name} is in the ecosystem data, with skills that exist`);
  }
});

// ===================================================================== opening

s.fact(F, ['[Ink](https://github.com/vadimdemedes/ink) lets you build command-line apps using React components instead of imperative `console.log` calls.'], { kind: 'R' }, async (t, q) => {
  const [object, method] = q.tok('console.log').split('.');
  t.equal(byName('ink').repository, 'https://github.com/vadimdemedes/ink', 'the link is Ink\'s repository');
  const calls = [];
  const original = globalThis[object][method];
  globalThis[object][method] = (...args) => calls.push(args);
  try {
    const app = mount(h(Box, null, h(Text, null, 'from a component')), { columns: 30 });
    await app.flush();
    t.equal(app.screen(), 'from a component', 'a React component draws to the terminal');
    t.deepEqual(calls, [], `without a single ${object}.${method} call`);
  } finally {
    globalThis[object][method] = original;
  }
});

s.fact(F, ['Every element is a Yoga flexbox container; all text must be wrapped in `<Text>`.'], { kind: 'R' }, async (t, q) => {
  const T = q.el(ink, '<Text>');
  t.ok('yoga-layout' in installed('ink').json.dependencies, 'Yoga does the layout');
  t.equal(render(h(Box, null, h(T, null, 'a'), h(T, null, 'b'))), 'ab', 'a Box lays its children out in a row, as a flexbox container does');
  t.equal(render(h(Box, { flexDirection: 'column' }, h(T, null, 'a'), h(T, null, 'b'))), 'a\nb', 'and flexDirection changes the axis');
  t.throws(() => render(h(Box, null, 'bare')), /Text string "bare" must be rendered inside <Text> component/, 'text outside <Text> is an error');
  t.equal(render(h(Box, null, h(T, null, 'bare'))), 'bare', 'inside <Text> it renders');
});

s.fact(F, ['This skill is a **router** — it does not itself contain component APIs or code.'], { kind: 'P', ctx: [] }, async (t, q) => {
  t.equal(frontmatter('ink').metadata.category, q.tok('router'), 'it is the router');
  t.equal(loadFile('ink', 'SKILL.md').fences.length, 0, 'and has no code fence');
});

s.guidance(F, ['Its job is to identify which sub-skill has the answer and defer to it.'], 'states the router\'s purpose; the routing table below is what is proven');

// ===================================================================== routing policy

s.guidance(F, ['**Always route before answering an Ink-specific question.**'], 'a rule for the agent reading the skill', { exempt: ['Always route before answering an Ink-specific question.'] });

s.fact(F, ['Even a question that looks answerable from general React knowledge (e.g. "how do I center content?") maps to an Ink-specific mechanism (Yoga flexbox via `<Box>`, not CSS)'], { kind: 'R' }, async (t, q) => {
  // the question names what to do ("center"): that word is the value of the Yoga prop that does it
  const how = q.tok('how do I center content?').match(/^how do I (\w+) content\?$/)[1];
  const B = q.el(ink, '<Box>');
  t.equal(render(h(B, { width: 10, justifyContent: how }, h(Text, null, 'ab'))), '    ab', 'centring is a Box prop, Yoga flexbox');
  t.equal(render(h(B, { width: 10, height: 3, alignItems: how, justifyContent: how }, h(Text, null, 'ab'))).split('\n')[1], '    ab', 'on either axis');
});

s.types(
  F,
  ['Even a question that looks answerable from general React knowledge (e.g. "how do I center content?") maps to an Ink-specific mechanism (Yoga flexbox via `<Box>`, not CSS)'],
  tsx`
import React from 'react';
import {Box, Text} from 'ink';

// how do I center content?
export const flexbox = <Box width={10} justifyContent="center"><Text>ab</Text></Box>;
export const css = <Box style={{justifyContent: 'center'}}><Text>ab</Text></Box>; //! TS2322
export const className = <Box className="center"><Text>ab</Text></Box>; //! TS2322
`,
  { ctx: ['how do I center content?', '<Box>'] },
);

s.fact(F, ['load the matching sub-skill rather than answering from memory, so the props and defaults you use are correct for Ink 8.'], { kind: 'P' }, async (t, q) => {
  bindInk(t, q);
  for (const [name, entry] of skills) t.equal(frontmatter(name).metadata.ink, INK, `${name} is written against the installed Ink (${INK})`);
});

s.guidance(F, ['**One sub-skill is usually enough.**'], 'a heuristic for how many skills to load', { exempt: ['One sub-skill is usually enough.'] });
s.guidance(F, ['Most tasks land in a single row below.'], 'a heuristic about how requests map onto the routing table, not a measurable fact');
s.fact(F, ['Only load a second skill when the task genuinely spans two concerns (e.g. a focusable, animated list touches both `ink-focus-management` and `ink-animation-and-performance`).'], { kind: 'P' }, async (t, q) => {
  const focus = q.tok('ink-focus-management');
  const animation = q.tok('ink-animation-and-performance');
  t.ok(skillText(focus).includes('useFocus'), 'one skill covers focus (useFocus)');
  t.ok(skillText(animation).includes('useAnimation'), 'the other covers animation (useAnimation)');
  t.notEqual(focus, animation);
});

s.fact(F, ['**Don\'t route for plain React/JavaScript questions** that happen to occur inside an Ink project (e.g. "how do I use `useReducer`?") — those aren\'t Ink-specific, answer directly.'], { kind: 'R', ctx: ["Don't route for plain React/JavaScript questions", 'how do I use  ?'] }, async (t, q) => {
  const hook = q.tok('useReducer');
  t.equal(typeof React[hook], 'function', 'useReducer is a React hook');
  t.ok(!(hook in ink), 'which Ink does not provide: it is not Ink-specific');
});

s.guidance(F, ['**New project?**'], 'a lead-in label for the next sentence', { exempt: ['New project?'] });
s.fact(F, ['Start at `ink-getting-started` regardless of the specific question — it covers the scaffold, TypeScript/ESM setup, and `package.json` `bin` wiring.'], { kind: 'P' }, async (t, q) => {
  const name = q.tok('ink-getting-started');
  t.ok(skills.has(name));
  const text = skillText(name);
  t.ok(text.includes(q.tok('package.json')), 'it covers package.json');
  t.ok(text.includes(q.tok('bin')), 'and its bin field');
  t.match(text, /TypeScript/, 'and TypeScript');
  t.match(text, /ESM|"type": "module"/, 'and ESM');
});

s.guidance(F, ['**Recommending a third-party component?**'], 'a lead-in label for the next sentences', { exempt: ['Recommending a third-party component?'] });
s.fact(F, ['Always load `ink-ecosystem-overview` first and check its compatibility table.'], { kind: 'P' }, async (t, q) => {
  const name = q.tok('ink-ecosystem-overview');
  t.match(skillText(name), /<!-- ECOSYSTEM_MATRIX:START/, 'the skill holds the compatibility table');
  t.ok(data.packages.every((p) => skillText(name).includes(`| \`${p.name}\` |`)), 'with a row for every package');
});

s.fact(F, ['A peer range does not tell you whether a package works on Ink 8: several packages cannot be loaded at all (`ink-table`, `ink-markdown`, `ink-progress-bar`, `ink-divider`) even though their ranges look permissive, while others declare ranges that exclude Ink 8 yet render on it (`ink-tab`, `ink-scroll-view`).'], { kind: 'P', ...BIG }, async (t, q) => {
  bindInk(t, q);
  for (const token of ['ink-table', 'ink-markdown', 'ink-progress-bar', 'ink-divider']) {
    const name = q.tok(token);
    t.equal(byName(name).status, 'broken', `${name} is broken on Ink 8`);
    t.equal(loadsInCleanProcess(name).ok, false, `${name} cannot be loaded`);
    const range = installed(name).json.peerDependencies?.ink;
    t.ok(range === undefined || semver.satisfies(INK, range), `${name}: its ink peer range (${range ?? 'none'}) does not exclude Ink ${INK}`);
  }
  for (const token of ['ink-tab', 'ink-scroll-view']) {
    const name = q.tok(token);
    t.ok(!semver.satisfies(INK, installed(name).json.peerDependencies.ink), `${name} declares a range that excludes Ink ${INK}`);
    t.ok((await renderOnInk8(name)).trim().length > 0, `${name} renders on it`);
  }
});

// ===================================================================== routing table

/** Where a token named in a routing row has to exist. */
const inkDeclarations = (() => {
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : entry.name.endsWith('.d.ts') ? [join(dir, entry.name)] : []));
  return walk(join(installed('ink').dir, 'build')).map((file) => readFileSync(file, 'utf8')).join('\n');
})();
const uiExports = await import('@inkjs/ui');
const routerExports = await extImport('react-router');
// tokens that name something outside any package. The skill must still cover these; nothing to look up:
const NOT_AN_API = new Set(['CI=false', 'bin']);
// example programs and values in a row's description: context, bound to nothing
const ILLUSTRATIVE = new Set(['$EDITOR', 'less']);
// `<Box>` and `<Rule />` name components; `useStdout()` and `render()` name functions
const identifier = (token) => token.replace(/^<|\s*\/?>$/g, '').replace(/\(\).*$/, '').match(/^[A-Za-z_$@][\w$@./-]*/)?.[0] ?? token;

function resolves(token) {
  const id = identifier(token);
  const kinds = [];
  if (skills.has(id)) kinds.push('skill');
  if (id in ink) kinds.push('ink export');
  if (id in React) kinds.push('react export');
  if (id in uiExports) kinds.push('@inkjs/ui export');
  if (id in routerExports) kinds.push('react-router export');
  if (new RegExp(`\\b${id.replace(/[$.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(inkDeclarations)) kinds.push('ink declaration');
  try {
    installed(id);
    kinds.push('installed package');
  } catch {}
  return kinds;
}

const routerText = readFileSync(join(ROOT, 'skills', 'ink', 'SKILL.md'), 'utf8');
const routingRows = routerText.split('\n').filter((line) => /^\| `ink[\w-]*` \|/.test(line) || /^\| `inkjs-ui[\w-]*` \|/.test(line));

for (const row of routingRows) {
  const owner = row.match(/^\| `([\w-]+)` \|/)[1];
  s.fact(F, [row], { kind: 'P', ctx: factTokens(row).filter((x) => ILLUSTRATIVE.has(x)), ...BIG }, async (t, q) => {
    bindInk(t, q);
    t.equal(q.tok(owner), owner, 'the row names the skill');
    t.ok(skills.has(owner), `${owner} is a skill`);
    const text = skillText(owner);
    if (q.tokens.includes('19.3')) t.equal(q.tok('19.3'), `${semver.major(REACT)}.${semver.minor(REACT)}`, 'the React version the skills target');
    for (const token of q.tokens.filter((x) => x !== owner && x !== '8' && x !== '19.3' && !ILLUSTRATIVE.has(x))) {
      const named = q.tok(token);
      const kinds = resolves(named);
      t.ok(kinds.length > 0 || NOT_AN_API.has(named), `${named} is something real (${kinds.join(', ') || 'not an API'})`);
      t.ok(text.includes(named) || text.includes(identifier(named)), `${owner} covers ${named}`);
    }
  });
}

s.types(
  F,
  ['migrating `useStdout().stdout.columns/rows/isTTY` (no longer type-checks) → `useWindowSize`'],
  tsx`
import {useStdout, useWindowSize} from 'ink';

export const Probe = () => {
  const {stdout} = useStdout();
  const columns = stdout.columns; //! TS2339
  const rows = stdout.rows; //! TS2339
  const isTTY = stdout.isTTY; //! TS2339
  const size = useWindowSize();
  return [columns, rows, isTTY, size.columns, size.rows];
};
`,
  { ctx: ['useStdout().stdout.columns/rows/isTTY', 'useWindowSize'] },
);

// ===================================================================== compatibility

s.fact(F, ["Every sub-skill's frontmatter carries `metadata.ink` pinning the Ink version its examples target (currently `8.0.0`, peer `react >=19.3.0` / `@types/react >=19.3.0`, Node `>=22`)."], { kind: 'P' }, async (t, q) => {
  const version = q.tok('8.0.0');
  const field = q.tok('metadata.ink').split('.');
  for (const [name, entry] of skills) {
    if (name === 'ink') continue;
    t.equal(frontmatter(name)[field[0]][field[1]], version, `${name}: ${field.join('.')} is ${version}`);
  }
  t.equal(installed('ink').json.version, version, 'the installed Ink');
  const { peerDependencies, engines } = installed('ink').json;
  for (const token of ['react >=19.3.0', '@types/react >=19.3.0']) {
    const [name, range] = q.tok(token).split(' ');
    t.equal(peerDependencies[name], range, `peer ${name}`);
  }
  t.equal(engines.node, q.tok('>=22'), 'and Node');
});

s.fact(F, ["If the user's `package.json` pins an older Ink major, say so before applying an example; the Ink 8 specifics are in `ink-layout` and `ink-input-handling`."], { kind: 'P' }, async (t, q) => {
  bindInk(t, q);
  t.ok(q.tok('package.json').endsWith('.json'));
  const layout = q.tok('ink-layout');
  const input = q.tok('ink-input-handling');
  t.match(skillText(layout), /`minWidth`\/`maxWidth` accept only numbers/, `${layout} has the number-only minWidth/maxWidth`);
  t.match(skillText(input), /Unrecognized control sequences/, `${input} has what useInput does with unrecognised sequences`);
});

s.fact(F, ['Ink 8 specifics to watch for: `<Box>` `minWidth`/`maxWidth` are number-only, `render()` streams are typed `NodeJS.WritableStream`/`NodeJS.ReadableStream`, and `useInput` drops unrecognized control sequences.'], { kind: 'R' }, async (t, q) => {
  bindInk(t, q);
  const B = q.el(ink, '<Box>');
  const [minWidth, maxWidth] = [q.tok('minWidth'), q.tok('maxWidth')];
  const width = (props, text) => render(h(B, { borderStyle: 'single', alignSelf: 'flex-start', ...props }, h(Text, null, text))).split('\n')[0].length;
  t.equal(width({}, 'ab'), 4, 'a bordered box as wide as its content');
  t.equal(width({ [minWidth]: 8 }, 'ab'), 8, 'a number works for minWidth');
  t.equal(width({ [maxWidth]: 5 }, 'abcdefgh'), 5, 'and for maxWidth');
  const render_ = q.api(ink, 'render()');
  t.equal(typeof render_, 'function');
  const declarations = readFileSync(join(installed('ink').dir, 'build', 'render.d.ts'), 'utf8');
  t.match(declarations, new RegExp(`stdout\\?: ${q.tok('NodeJS.WritableStream').replace('.', '\\.')};`), 'stdout is a NodeJS.WritableStream');
  t.match(declarations, new RegExp(`stdin\\?: ${q.tok('NodeJS.ReadableStream').replace('.', '\\.')};`), 'stdin is a NodeJS.ReadableStream');
  const input = q.api(ink, 'useInput');
  const got = [];
  const App = () => {
    input((value) => got.push(value));
    return h(Text, null, 'x');
  };
  const app = mount(h(App), { columns: 10 });
  await app.flush();
  await app.press('a', '\x1b[999;5~', 'b');
  t.deepEqual(got, ['a', 'b'], 'useInput hands over the keys it recognises and drops the control sequence it does not');
});

s.types(
  F,
  ['Ink 8 specifics to watch for: `<Box>` `minWidth`/`maxWidth` are number-only, `render()` streams are typed `NodeJS.WritableStream`/`NodeJS.ReadableStream`, and `useInput` drops unrecognized control sequences.'],
  tsx`
import React from 'react';
import {Box, Text, render} from 'ink';

export const numbers = <Box minWidth={10} maxWidth={20}><Text>x</Text></Box>;
export const percentMin = <Box minWidth="50%"><Text>x</Text></Box>; //! TS2322
export const percentMax = <Box maxWidth="50%"><Text>x</Text></Box>; //! TS2322

const writable: NodeJS.WritableStream = process.stdout;
const readable: NodeJS.ReadableStream = process.stdin;
export const instance = render(<Text>x</Text>, {stdout: writable, stdin: readable});
export const wrongStdout = render(<Text>x</Text>, {stdout: 5}); //! TS2322
export const wrongStdin = render(<Text>x</Text>, {stdin: 'in'}); //! TS2322
`,
  { ctx: ['<Box>', 'minWidth', 'maxWidth', 'render()', 'NodeJS.WritableStream', 'NodeJS.ReadableStream', '8', 'useInput'] },
);
