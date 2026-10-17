// Claims for skills/ecosystem/ink-ecosystem-overview/SKILL.md.
//
// The matrix is generated from data/ecosystem.json. Each row is proven twice: its cells (name,
// peers, engines, status) against the installed package and against what the package really does
// on Ink 8 -- strict `npm install` next to the installed Ink and React (offline, with stubs that
// carry the real peer ranges), a clean-process import, a minimal render -- and its note, sentence
// by sentence, by the specs below. A note whose text changes must be re-proven: `note` is compared
// with the text the spec was written for.
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import semver from 'semver';
import { skill, tsx, h, ink, mount, stripAnsi, loadEcosystem, ROOT, EXT, externalHarness, extImport, runIsolated, keys, findCaseInsensitive } from '../lib/index.mjs';
import { allSkillFiles, loadFile } from '../lib/claims.mjs';
import { renderTable } from '../../scripts/lib/ecosystem.mjs';
import { installed, versionOf, loadsInCleanProcess, npmInstall, renderOnInk8, hasRecipe, projectOf } from './ink-ecosystem-overview.helpers.mjs';

const { Box, Text, renderToString } = ink;
const s = skill('ink-ecosystem-overview');
const F = 'SKILL.md';

const data = await loadEcosystem();
const INK = versionOf('ink');
const REACT = versionOf('react');
const byName = (name) => data.packages.find((p) => p.name === name);
const render = (element, columns = 40) => renderToString(element, { columns });

// ---------------------------------------------------------------------------
// the rows, as the generator writes them
// ---------------------------------------------------------------------------

const TABLE = renderTable(data, { group: null, withRegistry: false }).split('\n');
const rowOf = (name) => TABLE.find((line) => line.startsWith(`| \`${name}\` |`));
/** [cells quote, note quote | null] for a matrix row (pipes un-escaped, as quotes are normalised). */
function rowQuotes(name) {
  const cells = rowOf(name).replace(/\\\|/g, '|').slice(2, -2).split(' | ');
  return [`| ${cells.slice(0, 3).join(' | ')} |`, cells[3] ? `${cells[2]} | ${cells[3]} |` : null];
}
const peersOf = (json) => Object.entries(json.peerDependencies ?? {}).filter(([name]) => name !== 'react-devtools-core');
/** The `8` of "Ink 8" in a quote is the major version of the installed Ink. */
function bindInk(t, q) {
  if (q.tokens.includes('8')) t.equal(Number(q.tok('8')), semver.major(INK), 'Ink 8');
}
const STATUS_LABEL = { broken: 'broken', avoid: 'avoid', 'peer-excluded': 'peer excludes Ink 8' };

/** Everything the status of a package promises, checked against what it does. */
async function statusProblems(p) {
  const problems = [];
  const strict = p.name === 'ink' ? null : npmInstall(p.name);
  const legacy = p.name === 'ink' ? null : npmInstall(p.name, { legacy: true });
  const load = loadsInCleanProcess(p.name);
  const drew = async () => (hasRecipe(p.name) ? (await renderOnInk8(p.name)).trim().length > 0 : false);
  switch (p.status) {
    case 'core':
      if (installed(p.name).json.version !== data.verifiedWith.ink) problems.push('the installed Ink is not the version the matrix is for');
      if (!load.ok || !(await drew())) problems.push('does not load and render');
      break;
    case 'works':
      if (!strict.ok) problems.push(`strict install fails: ${strict.message.split('\n')[0]}`);
      if (!load.ok) problems.push(`does not load: ${load.message}`);
      if (!(await drew())) problems.push('draws nothing on Ink 8');
      break;
    case 'peer-excluded':
      if (!strict.eresolve) problems.push('a strict install succeeds, so the peer range does not exclude the installed Ink/React');
      if (!legacy.ok) problems.push('even --legacy-peer-deps fails');
      if (!load.ok) problems.push(`does not load: ${load.message}`);
      if (!(await drew())) problems.push('draws nothing on Ink 8');
      break;
    case 'broken':
      if (load.ok) problems.push('loads, so it is not broken');
      break;
    case 'avoid':
      if (!data.packages.some((other) => other.status === 'works' && p.note.includes(`\`${other.name}\``))) problems.push('no working package is named as the right one');
      break;
    default:
      problems.push(`status ${p.status} is not covered`);
  }
  return problems;
}

// ===================================================================== description

s.fact(F, ['Decision guide and Ink 8 compatibility matrix for the Ink component ecosystem — which third-party package to reach for, which ones cannot be loaded on Ink 8 (CommonJS builds, a bundled old Ink) and which only declare peer ranges that exclude it.'], { kind: 'P', timeout: 180_000 }, async (t, q) => {
  bindInk(t, q);
  const broken = data.packages.filter((p) => p.status === 'broken');
  t.ok(broken.some((p) => loadsInCleanProcess(p.name).code === 'ERR_REQUIRE_ASYNC_MODULE'), 'there are CommonJS builds that cannot be loaded');
  t.ok(broken.some((p) => p.name === 'ink-divider' && installed('ink-divider').json.dependencies.ink && !semver.satisfies(INK, installed('ink-divider').json.dependencies.ink)), 'and one that bundles an old Ink');
  const excluded = data.packages.filter((p) => p.status === 'peer-excluded');
  t.ok(excluded.length > 0 && excluded.every((p) => !semver.satisfies(INK, installed(p.name).json.peerDependencies.ink ?? '*') || !semver.satisfies(REACT, installed(p.name).json.peerDependencies.react ?? '*')), 'and some that declare peer ranges excluding the installed Ink or React');
  for (const p of data.packages) t.ok(rowOf(p.name), `${p.name} has a row in the matrix`);
});

s.guidance(F, ['Load this before recommending any third-party ink-* or @inkjs/ui package.'], 'an instruction to the reader about when to load the skill; the matrix it points to is proven row by row below', { exempt: ['ink-*', '@inkjs/ui'] });

// ===================================================================== opening

s.fact(F, ["Ink's own components are `Box`, `Text`, `Newline`, `Spacer`, `Static` and `Transform`; everything else"], { kind: 'R' }, async (t, q) => {
  const named = ['Box', 'Text', 'Newline', 'Spacer', 'Static', 'Transform'].map((name) => q.tok(name));
  for (const name of named) t.ok(['function', 'object'].includes(typeof ink[name]), `${name} is exported by ink`);
  const components = Object.keys(ink).filter((name) => /^[A-Z]/.test(name)).sort();
  t.deepEqual(components, [...named].sort(), 'and they are all the components ink exports');
});

s.fact(F, ['This skill is the map; the `inkjs-ui-*`, `ink-tables`, `ink-charts`, `ink-markdown-and-code`, `ink-decoration`, `ink-forms`, `ink-navigation`, and `ink-task-runners` skills hold the actual usage detail.'], { kind: 'P' }, async (t, q) => {
  const skills = allSkillFiles();
  const names = skills.map((f) => f.skill);
  const prefix = q.tok('inkjs-ui-*').replace('*', '');
  t.ok(names.filter((n) => n.startsWith(prefix)).length >= 4, 'the inkjs-ui-* skills exist');
  for (const token of ['ink-tables', 'ink-charts', 'ink-markdown-and-code', 'ink-decoration', 'ink-forms', 'ink-navigation', 'ink-task-runners']) {
    const name = q.tok(token);
    t.ok(names.includes(name), `${name} is a skill`);
    t.ok(loadFile(name, 'SKILL.md').fences.length > 0, `${name} has code to use`);
  }
});

s.fact(F, ["**A package's peer range is not proof it works.**"], { kind: 'P', ctx: ["A package's peer range is not proof it works."] }, async (t) => {
  const table = installed('ink-table').json;
  t.ok(semver.satisfies(INK, table.peerDependencies.ink), 'ink-table\'s peer range covers the installed Ink');
  t.equal(loadsInCleanProcess('ink-table').ok, false, 'yet it cannot be loaded');
});

s.fact(F, ['Ink 8 is ESM with top-level `await`, so a CommonJS package that `require()`s it fails with `ERR_REQUIRE_ASYNC_MODULE` however permissive its peer range is (`ink-table` declares `>=3.0.0` and cannot be loaded).'], { kind: 'P', timeout: 180_000 }, async (t, q) => {
  t.equal(semver.major(INK), Number(q.tok('8')), 'the installed Ink is Ink 8');
  t.equal(installed('ink').json.type, 'module', 'Ink is ESM');
  const name = q.tok('ink-table');
  const load = loadsInCleanProcess(name);
  t.equal(load.code, q.tok('ERR_REQUIRE_ASYNC_MODULE'), 'requiring it from a CommonJS package fails with that code');
  t.match(load.message, new RegExp(q.tok('await')), 'because its graph has a top-level await');
  t.match(readAllJs(installed(name).dir), new RegExp(`${q.tok('require()').slice(0, -2)}\\(["']ink["']\\)`), 'ink-table is a CommonJS build that require()s ink');
  t.equal(installed(name).json.peerDependencies.ink, q.tok('>=3.0.0'), 'its peer range');
  t.ok(semver.satisfies(INK, '>=3.0.0'), 'which is satisfied by this Ink');
});

s.fact(F, ['The opposite also happens: `ink-tab` declares `^4 || ^5 || ^6` yet renders on Ink 8.'], { kind: 'P', timeout: 180_000 }, async (t, q) => {
  bindInk(t, q);
  const name = q.tok('ink-tab');
  const declared = q.tok('^4 || ^5 || ^6');
  const peer = installed(name).json.peerDependencies.ink;
  t.equal(semver.validRange(declared), semver.validRange(peer), 'the range it declares');
  t.ok(!semver.satisfies(INK, peer), 'excludes the installed Ink');
  t.ok((await renderOnInk8(name)).includes('One'), 'yet it renders on it');
});

s.fact(F, ['The matrix below says what each package does on Ink 8, not only what it declares.'], { kind: 'P', timeout: 180_000 }, async (t, q) => {
  bindInk(t, q);
  for (const p of data.packages) t.deepEqual(await statusProblems(p), [], `${p.name}: its status (${p.status}) is what it does on Ink 8`);
});

// ===================================================================== decision table

s.fact(F, ["| Text/email/password input, confirm, select, multi-select | `@inkjs/ui` (`inkjs-ui-inputs`) | By Ink's authors; its peer range covers Ink 8 and it works."], { kind: 'P', timeout: 180_000, ctx: ['inkjs-ui-inputs'] }, async (t, q) => {
  bindInk(t, q);
  const ui = await import(q.tok('@inkjs/ui'));
  for (const component of ['TextInput', 'EmailInput', 'PasswordInput', 'ConfirmInput', 'Select', 'MultiSelect']) t.equal(typeof ui[component], 'function', `${component}`);
  const owner = (name) => byName(name).repository.split('/')[3];
  t.equal(owner('@inkjs/ui'), owner('ink'), "from the same GitHub owner as Ink: Ink's authors");
  t.ok(byName('@inkjs/ui').maintainers.includes('vdemedes'), 'whose npm account maintains it');
  t.ok(semver.satisfies(INK, installed('@inkjs/ui').json.peerDependencies.ink), 'its peer range covers Ink 8');
  t.deepEqual(await statusProblems(byName('@inkjs/ui')), [], 'and it works');
});

s.guidance(F, ['Default choice for interactive prompts.'], 'a recommendation; the facts behind it (the components exist, the package works on Ink 8) are asserted by the claim on the same row');

s.fact(F, ['| Spinner, progress bar, status/alert messages, badges | `@inkjs/ui` (`inkjs-ui-feedback`) | Same package. Use its `ProgressBar`, not `ink-progress-bar`. |'], { kind: 'P', ctx: ['inkjs-ui-feedback'] }, async (t, q) => {
  const ui = await import(q.tok('@inkjs/ui'));
  for (const component of ['Spinner', 'StatusMessage', 'Alert', 'Badge']) t.equal(typeof ui[component], 'function', component);
  t.equal(typeof q.api(ui, 'ProgressBar'), 'function', '@inkjs/ui has a ProgressBar');
  const other = byName(q.tok('ink-progress-bar'));
  t.equal(other.status, 'broken', 'ink-progress-bar is broken on Ink 8');
  t.equal(loadsInCleanProcess(other.name).ok, false, 'it cannot be loaded');
});

s.fact(F, ['| Bullet/numbered lists | `@inkjs/ui` (`inkjs-ui-lists`) | Same package. |'], { kind: 'P', ctx: ['inkjs-ui-lists'] }, async (t, q) => {
  const ui = await import(q.tok('@inkjs/ui'));
  t.equal(typeof ui.UnorderedList, 'function', 'bullet lists');
  t.equal(typeof ui.OrderedList, 'function', 'numbered lists');
});

s.fact(F, ['| Tabular data | `@alcalzone/ink-table`, or a hand-rolled `<Box>` grid | `ink-tables`. Not `ink-table`: it cannot be loaded on Ink 8. |'], { kind: 'P', ctx: ['ink-tables'] }, async (t, q) => {
  bindInk(t, q);
  t.deepEqual(await statusProblems(byName(q.tok('@alcalzone/ink-table'))), [], '@alcalzone/ink-table works');
  const B = q.el(ink, '<Box>');
  const grid = render(h(B, { flexDirection: 'column' }, ...[['a', 'b'], ['c', 'd']].map((row, i) => h(B, { key: i }, ...row.map((cell, j) => h(B, { key: j, width: 4 }, h(Text, null, cell)))))));
  t.equal(grid, 'a   b\nc   d', 'a hand-rolled grid of boxes lines the columns up');
  const broken = byName(q.tok('ink-table'));
  t.equal(broken.status, 'broken', 'ink-table is a package the matrix lists as broken');
  t.equal(loadsInCleanProcess(broken.name).ok, false, 'and it cannot be loaded');
});

s.fact(F, ['| Sparklines / bar / line charts | `@pppp606/ink-chart` | `ink-charts`. Not `ink-chart`: that is an unrelated package. |'], { kind: 'P', ctx: ['ink-charts'] }, async (t, q) => {
  const charts = await import(q.tok('@pppp606/ink-chart'));
  for (const component of ['Sparkline', 'BarChart', 'LineGraph']) t.ok(isComponent(charts[component]), `${component}`);
  const other = byName(q.tok('ink-chart'));
  const mine = byName('@pppp606/ink-chart');
  t.notEqual(other.repository, mine.repository, 'ink-chart is another repository');
  t.deepEqual(other.maintainers.filter((m) => mine.maintainers.includes(m)), [], 'with other maintainers');
});

s.fact(F, ['| Rendering Markdown or highlighted code | `marked` + `marked-terminal`, `cli-highlight` | `ink-markdown-and-code`. `ink-markdown` cannot be loaded on Ink 8. |'], { kind: 'P', ctx: ['ink-markdown-and-code'] }, async (t, q) => {
  bindInk(t, q);
  const { marked } = await import(q.tok('marked'));
  const { markedTerminal } = await import(q.tok('marked-terminal'));
  marked.use(markedTerminal());
  t.match(stripAnsi(marked.parse('# Title')), /Title/, 'marked + marked-terminal render Markdown for a terminal');
  const { highlight } = await import(q.tok('cli-highlight'));
  t.match(highlight('const a = 1;', { language: 'js' }), /\x1b\[/, 'cli-highlight colours code');
  const broken = byName(q.tok('ink-markdown'));
  t.equal(broken.status, 'broken', 'ink-markdown is a package the matrix lists as broken');
  t.equal(loadsInCleanProcess(broken.name).ok, false, 'and it cannot be loaded');
});

s.fact(F, ['| Links, gradients, big ASCII text | `ink-link`, `ink-gradient`, `ink-big-text` | `ink-decoration`. |'], { kind: 'P', ctx: ['ink-decoration'] }, async (t, q) => {
  for (const name of [q.tok('ink-link'), q.tok('ink-gradient'), q.tok('ink-big-text')]) t.deepEqual(await statusProblems(byName(name)), [], `${name} works`);
});

s.fact(F, ['| Dividers, titled boxes | A `<Box>` border; `@mishieck/ink-titled-box` | `ink-decoration`. `ink-divider` crashes on React 19. |'], { kind: 'P', ctx: ['ink-decoration'] }, async (t, q) => {
  const B = q.el(ink, '<Box>');
  t.equal(render(h(B, { width: 6, flexDirection: 'column' }, h(B, { borderStyle: 'single', borderBottom: false, borderLeft: false, borderRight: false }))), '──────', 'a border on one side is a divider');
  t.deepEqual(await statusProblems(byName(q.tok('@mishieck/ink-titled-box'))), [], 'the titled box works on Ink 8');
  const divider = loadsInCleanProcess(q.tok('ink-divider'));
  t.equal(divider.ok, false, 'ink-divider cannot be used');
  t.match(divider.message, /ReactCurrentOwner/, 'it crashes inside the React reconciler');
  t.equal(semver.major(REACT), Number(q.tok('19')), 'on React 19');
});

s.fact(F, ['| A full multi-field form | `ink-form` | `ink-forms`. |'], { kind: 'P', ctx: ['ink-forms'] }, async (t, q) => {
  t.deepEqual(await statusProblems(byName(q.tok('ink-form'))), [], 'ink-form works');
  t.ok((await renderOnInk8('ink-form')).includes('Profile'), 'and draws a form');
});

s.fact(F, ['| Tabs, step wizards | `ink-tab`, `ink-stepper` | `ink-navigation`. Peer ranges exclude Ink 8 but both render on it. |'], { kind: 'P', timeout: 180_000, ctx: ['ink-navigation'] }, async (t, q) => {
  bindInk(t, q);
  for (const name of [q.tok('ink-tab'), q.tok('ink-stepper')]) {
    const peer = installed(name).json.peerDependencies.ink;
    t.ok(!semver.satisfies(INK, peer), `${name}: the peer range ${peer} excludes the installed Ink`);
    t.ok((await renderOnInk8(name)).trim().length > 0, `${name}: renders on it`);
  }
});

s.fact(F, ['| Scrolling a region, long lists | `<Box overflow="hidden" contentOffsetY>` | `ink-layout` (built into Ink 8); `ink-navigation` for the libraries. |'], { kind: 'R', timeout: 180_000, ctx: ['ink-layout', 'ink-navigation'] }, async (t, q) => {
  bindInk(t, q);
  const [element, ...props] = q.tok('<Box overflow="hidden" contentOffsetY>').slice(1, -1).split(' ');
  const [overflowName, overflowValue] = props[0].split('=');
  const offset = props[1];
  const scrolled = (n) => render(h(ink[element], { height: 2, flexDirection: 'column', [overflowName]: overflowValue.replace(/"/g, ''), [offset]: n }, h(ink[element], { flexDirection: 'column', flexShrink: 0 }, ...['a', 'b', 'c', 'd'].map((x) => h(Text, { key: x }, x)))));
  t.equal(scrolled(0), 'a\nb');
  t.equal(scrolled(2), 'c\nd', 'a plain <Box> scrolls its content: no package needed');
  t.deepEqual(await statusProblems(byName('ink-scroll-view')), [], 'the libraries (ink-navigation) are the other way to do it');
});

s.fact(F, ['| A task-list UI, spawning subprocesses | `ink-task-list`, `ink-spawn` | `ink-task-runners`. |'], { kind: 'P', ctx: ['ink-task-runners'] }, async (t, q) => {
  for (const name of [q.tok('ink-task-list'), q.tok('ink-spawn')]) t.deepEqual(await statusProblems(byName(name)), [], `${name} works`);
});

// ===================================================================== the matrix

s.fact(F, ['Generated from `data/ecosystem.json` — `works` installs with strict peer dependencies and renders on Ink 8; `peer excludes Ink 8` needs `--legacy-peer-deps` to install and the note says what works; `broken` fails to load or crashes; `avoid` is the wrong package for what these skills document.'], { kind: 'P', timeout: 180_000 }, async (t, q) => {
  bindInk(t, q);
  t.ok(statSync(join(ROOT, q.tok('data/ecosystem.json'))).isFile(), 'the data file');
  const statusOfLabel = { works: 'works', 'peer excludes Ink 8': 'peer-excluded', broken: 'broken', avoid: 'avoid' };
  const labelled = (token) => data.packages.filter((p) => p.status === statusOfLabel[token]);
  const flag = q.tok('--legacy-peer-deps');
  const works = labelled(q.tok('works'));
  const excluded = labelled(q.tok('peer excludes Ink 8'));
  const broken = labelled(q.tok('broken'));
  const avoid = labelled(q.tok('avoid'));
  for (const [label, group] of [['works', works], ['peer excludes Ink 8', excluded], ['broken', broken], ['avoid', avoid]]) t.ok(group.length > 0, `some package is "${label}"`);
  for (const p of works) t.ok(npmInstall(p.name).ok, `${p.name}: installs with strict peer dependencies`);
  for (const p of excluded) {
    t.ok(npmInstall(p.name).eresolve, `${p.name}: a strict install is refused`);
    t.ok(npmInstall(p.name, { legacy: true, flag }).ok, `${p.name}: ${flag} installs it`);
  }
  for (const p of data.packages) t.deepEqual(await statusProblems(p), [], `${p.name}: ${p.status}`);
});

s.fact(F, ['generated by `npm run index` from data/ecosystem.json, do not edit by hand'], { kind: 'P' }, async (t, q) => {
  const script = q.tok('npm run index').split(' ').pop();
  t.equal(q.tokens.length, 1, 'the only fact token of the quote');
  t.match(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts[script], /generate-index/, 'npm run index is the generator');
  const text = readFileSync(join(ROOT, 'skills', 'ecosystem', 'ink-ecosystem-overview', 'SKILL.md'), 'utf8');
  const block = text.slice(text.indexOf('-->', text.indexOf('ECOSYSTEM_MATRIX:START')) + 3, text.indexOf('<!-- ECOSYSTEM_MATRIX:END')).trim();
  t.equal(block, TABLE.join('\n'), 'the table in the skill is exactly what the generator writes from the data');
  t.ok(readdirSync(join(ROOT, 'data')).includes('ecosystem.json'), 'the data file it reads');
});

// every row: the cells ...
for (const p of data.packages) {
  const [cells, note] = rowQuotes(p.name);
  s.fact(F, [cells], { kind: 'P', timeout: 180_000 }, async (t, q) => {
    const info = installed(p.name);
    t.equal(q.tok(p.name), info.json.name, 'the package');
    const ranges = new Set([...peersOf(info.json).map(([, range]) => range), info.json.engines?.node].filter(Boolean));
    for (const range of ranges) t.equal(q.tok(range), range, `declared range ${range}`);
    t.equal(info.json.version, p.version, `the recorded version (${p.version}) is the installed one`);
    const label = STATUS_LABEL[p.status];
    if (label) t.equal(q.tok(label), label, `status ${p.status}`);
    bindInk(t, q);
    t.deepEqual(await statusProblems(p), [], `${p.status}: what the package does on Ink 8`);
  });
  // the ink-task-list note is a type-level fact, proven by the types() claim below
  if (note && p.name !== 'ink-task-list') s.fact(F, [note], { kind: 'P', timeout: 180_000 }, async (t, q) => {
    const spec = NOTES[p.name];
    t.ok(spec, `${p.name} has a note spec`);
    t.equal(p.note, spec.text, 'the note is the text the spec was written for');
    const label = STATUS_LABEL[p.status];
    if (label) t.equal(q.tok(label), label, `status ${p.status}`);
    bindInk(t, q);
    await spec.check(t, q, p);
  });
}

// ===================================================================== the notes

const isComponent = (value) => typeof value === 'function' || (typeof value === 'object' && value !== null && '$$typeof' in value);
const allJs = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? (entry.name === 'node_modules' ? [] : allJs(join(dir, entry.name))) : /\.(c?js)$/.test(entry.name) ? [join(dir, entry.name)] : []));
function readAllJs(dir) {
  return allJs(dir).map((file) => readFileSync(file, 'utf8')).join('\n');
}

/** "CommonJS build `require()`s Ink ... (`ERR_REQUIRE_ASYNC_MODULE`). Use X instead." */
async function commonJsBuild(t, q, name) {
  const load = loadsInCleanProcess(name);
  t.equal(load.code, q.tok('ERR_REQUIRE_ASYNC_MODULE'), 'importing it fails with that code');
  t.notEqual(installed(name).json.type, 'module', 'it is not an ES module package');
  t.match(readAllJs(installed(name).dir), new RegExp(`${q.tok('require()').slice(0, -2)}\\(["']ink["']\\)`), 'its build calls require("ink")');
  t.equal(installed('ink').json.type, 'module', 'and Ink is an ES module');
}

const NOTES = {
  '@inkjs/ui': {
    text: "Made by Ink's authors; its peer `ink >=5` covers Ink 8.",
    async check(t, q) {
      const [name, range] = q.tok('ink >=5').split(' ');
      t.equal(installed('@inkjs/ui').json.peerDependencies[name], range);
      t.equal(Number(q.tok('8')), semver.major(INK));
      t.ok(semver.satisfies(INK, range), 'the range covers the installed Ink');
      const owner = (n) => byName(n).repository.split('/')[3];
      t.equal(owner('@inkjs/ui'), owner('ink'), "same GitHub owner as Ink: Ink's authors");
    },
  },
  'ink-testing-library': {
    text: 'Its only peer is `@types/react`; no `ink` peer to exclude Ink 8.',
    async check(t, q) {
      const peers = Object.keys(installed('ink-testing-library').json.peerDependencies);
      t.deepEqual(peers, [q.tok('@types/react')], 'its only peer');
      const inkPeer = q.tok('ink');
      t.ok(Object.keys(installed('@inkjs/ui').json.peerDependencies).includes(inkPeer), 'other packages do declare an ink peer');
      t.ok(!peers.includes(inkPeer), 'this one does not');
      t.equal(Number(q.tok('8')), semver.major(INK));
      t.ok((await renderOnInk8('ink-testing-library')).includes('hello'), 'and it works with Ink 8');
    },
  },
  'ink-text-input': {
    text: 'Controlled text input; `@inkjs/ui` `TextInput` is the uncontrolled alternative.',
    async check(t, q) {
      const ext = await externalHarness();
      const { default: ControlledInput } = await extImport('ink-text-input');
      const typed = [];
      const controlled = ext.mount(ext.h(ControlledInput, { value: 'ab', onChange: (v) => typed.push(v) }), { columns: 20 });
      await controlled.flush();
      await controlled.press('c');
      t.deepEqual(typed, ['abc'], 'it reports what the new value would be ...');
      t.equal(controlled.screen(), 'ab', '... and shows the value it is given until the parent changes it');
      const ui = await import(q.tok('@inkjs/ui'));
      const Uncontrolled = q.api(ui, 'TextInput');
      const free = mount(h(Uncontrolled, { placeholder: 'type' }), { columns: 20 });
      await free.flush();
      await free.press('x', 'y');
      t.match(free.screen(), /^xy/, 'the @inkjs/ui one keeps its own value: nothing is passed in');
    },
  },
  '@alcalzone/ink-table': {
    text: 'ESM package with a named `Table` export.',
    async check(t, q) {
      t.equal(installed('@alcalzone/ink-table').json.type, 'module', 'ESM');
      const mod = await import('@alcalzone/ink-table');
      t.ok(isComponent(q.api(mod, 'Table')), 'a named export');
      t.equal(mod.default, undefined, 'and there is no default one');
    },
  },
  'ink-multi-select': {
    text: 'CommonJS build `require()`s Ink, which is ESM with top-level await (`ERR_REQUIRE_ASYNC_MODULE`). Use `@inkjs/ui` `MultiSelect`.',
    async check(t, q) {
      await commonJsBuild(t, q, 'ink-multi-select');
      t.match(loadsInCleanProcess('ink-multi-select').message, /top-level await/, 'Ink has a top-level await');
      t.equal(typeof q.api(await import(q.tok('@inkjs/ui')), 'MultiSelect'), 'function', '@inkjs/ui has the replacement');
    },
  },
  'ink-table': {
    text: 'CommonJS build `require()`s Ink (`ERR_REQUIRE_ASYNC_MODULE`). Use `@alcalzone/ink-table` or a `<Box>` grid.',
    async check(t, q) {
      await commonJsBuild(t, q, 'ink-table');
      t.ok(isComponent((await import(q.tok('@alcalzone/ink-table'))).Table), 'the replacement works');
      t.ok(isComponent(q.el(ink, '<Box>')));
    },
  },
  'ink-divider': {
    text: 'Hard-depends on `ink ^5.1.0`, so it installs a second Ink 5 whose reconciler crashes on React 19. Draw a rule with a `<Box>` border instead.',
    async check(t, q) {
      const [name, range] = q.tok('ink ^5.1.0').split(' ');
      const dir = installed('ink-divider').dir;
      t.equal(installed('ink-divider').json.dependencies[name], range, 'a hard dependency on that range');
      const nested = JSON.parse(readFileSync(join(dir, 'node_modules', name, 'package.json'), 'utf8')).version;
      t.equal(semver.major(nested), Number(q.tok('5')), `so npm gives it its own copy (ink ${nested})`);
      t.notEqual(nested, INK);
      t.match(loadsInCleanProcess('ink-divider').message, /ReactCurrentOwner/, 'whose reconciler crashes');
      t.equal(semver.major(REACT), Number(q.tok('19')), 'on React 19');
      const B = q.el(ink, '<Box>');
      t.equal(render(h(B, { width: 4, flexDirection: 'column' }, h(B, { borderStyle: 'single', borderBottom: false, borderLeft: false, borderRight: false }))), '────', 'a border is a rule');
    },
  },
  '@mishieck/ink-titled-box': {
    text: 'Peer `ink ^6`; renders on Ink 8. The unscoped name `ink-titled-box` does not exist on npm.',
    async check(t, q) {
      const [name, range] = q.tok('ink ^6').split(' ');
      t.equal(semver.validRange(range), semver.validRange(installed('@mishieck/ink-titled-box').json.peerDependencies[name]), 'the peer range');
      t.match(await renderOnInk8('@mishieck/ink-titled-box'), /Status/, 'it renders on Ink 8');
      const unscoped = data.notOnNpm.find((entry) => entry.name === q.tok('ink-titled-box'));
      t.equal(unscoped?.registry404, true, 'the registry has no package by the unscoped name');
      t.equal(unscoped.useInstead, '@mishieck/ink-titled-box');
    },
  },
  'ink-picture': {
    text: 'Queries the terminal on mount; wrap the app in `<InkPictureProvider>`.',
    async check(t, q) {
      const picture = await extImport('ink-picture');
      const provider = q.el(picture, '<InkPictureProvider>');
      t.equal(typeof provider, 'function');
      const run = await runIsolated({ probe: 'ink-picture-stdin', project: 'external', env: { FORCE_COLOR: '0' }, tty: { isTTY: true, columns: 80, rows: 24 }, stdin: [] });
      t.ok(run.stdout.includes('\x1b[c') && run.stdout.includes('\x1b[16t'), 'on mount it writes terminal queries');
      const readme = readFileSync(findCaseInsensitive(installed('ink-picture').dir, 'README.md'), 'utf8').replace(/\s+/g, ' ');
      t.ok(readme.includes('Always wrap your app with `InkPictureProvider`.'), 'and its README says to wrap the app in the provider');
    },
  },
  'ink-progress-bar': {
    text: 'CommonJS build `require()`s Ink (`ERR_REQUIRE_ASYNC_MODULE`). Use `@inkjs/ui` `ProgressBar`.',
    async check(t, q) {
      await commonJsBuild(t, q, 'ink-progress-bar');
      t.equal(typeof q.api(await import(q.tok('@inkjs/ui')), 'ProgressBar'), 'function');
    },
  },
  'ink-confirm-input': {
    text: 'CommonJS build whose dependency `ink-text-input` 3 `require()`s Ink (`ERR_REQUIRE_ASYNC_MODULE`). Use `@inkjs/ui` `ConfirmInput`.',
    async check(t, q) {
      const { json, dir } = installed('ink-confirm-input');
      t.notEqual(json.type, 'module', 'a CommonJS build');
      const dependency = q.tok('ink-text-input');
      t.match(json.dependencies[dependency], new RegExp(`^\\^${q.tok('3')}\\.`), 'it depends on version 3 of that package');
      const nested = join(dir, 'node_modules', dependency);
      t.equal(JSON.parse(readFileSync(join(nested, 'package.json'), 'utf8')).version.split('.')[0], '3', 'and has its own copy of it');
      t.match(readAllJs(nested), new RegExp(`${q.tok('require()').slice(0, -2)}\\(["']ink["']\\)`), 'which calls require("ink")');
      t.equal(loadsInCleanProcess('ink-confirm-input').code, q.tok('ERR_REQUIRE_ASYNC_MODULE'), 'so importing the package fails with that code');
      t.equal(typeof q.api(await import(q.tok('@inkjs/ui')), 'ConfirmInput'), 'function', '@inkjs/ui has the replacement');
    },
  },
  'ink-quicksearch-input': {
    text: 'Peers `ink 2.6.x` and uses the removed `<Color>`; CommonJS build fails to load. Combine `@inkjs/ui` `TextInput` with a filtered `Select`.',
    async check(t, q) {
      const [name, range] = q.tok('ink 2.6.x').split(' ');
      t.equal(installed('ink-quicksearch-input').json.peerDependencies[name], range, 'its peer');
      const component = q.tok('<Color>').slice(1, -1);
      t.ok(!(component in ink), 'Ink no longer has that component');
      t.match(readAllJs(installed('ink-quicksearch-input').dir), new RegExp(`ink_1\\.${component}\\b`), 'the package still uses it');
      t.equal(loadsInCleanProcess('ink-quicksearch-input').ok, false, 'it fails to load');
      const ui = await import(q.tok('@inkjs/ui'));
      t.equal(typeof q.api(ui, 'TextInput'), 'function');
      t.equal(typeof q.api(ui, 'Select'), 'function');
    },
  },
  'ink-tab': {
    text: 'Peer `^4 || ^5 || ^6`; renders on Ink 8.',
    async check(t, q) {
      t.equal(semver.validRange(q.tok('^4 || ^5 || ^6')), semver.validRange(installed('ink-tab').json.peerDependencies.ink));
      t.ok((await renderOnInk8('ink-tab')).includes('One'), 'renders on Ink 8');
    },
  },
  'ink-stepper': {
    text: 'Peer `^6.6 || ^7`; renders on Ink 8.',
    async check(t, q) {
      t.equal(semver.validRange(q.tok('^6.6 || ^7')), semver.validRange(installed('ink-stepper').json.peerDependencies.ink));
      t.ok((await renderOnInk8('ink-stepper')).includes('step one'), 'renders on Ink 8');
    },
  },
  'ink-scroll-view': {
    text: "Peer `^7`; renders on Ink 8. Ink 8's native `contentOffsetY` covers simple scrolling.",
    async check(t, q) {
      t.equal(semver.validRange(q.tok('^7')), semver.validRange(installed('ink-scroll-view').json.peerDependencies.ink));
      t.equal((await renderOnInk8('ink-scroll-view')).trim(), 'a\nb\nc', 'renders on Ink 8');
      const offset = q.tok('contentOffsetY');
      const view = render(h(Box, { height: 2, flexDirection: 'column', overflow: 'hidden', [offset]: 1 }, h(Box, { flexDirection: 'column', flexShrink: 0 }, ...['a', 'b', 'c'].map((x) => h(Text, { key: x }, x)))));
      t.equal(view, 'b\nc', 'a plain Box scrolls with it');
    },
  },
  'ink-scroll-list': {
    text: 'Peer `^7`; renders on Ink 8.',
    async check(t, q) {
      t.equal(semver.validRange(q.tok('^7')), semver.validRange(installed('ink-scroll-list').json.peerDependencies.ink));
      t.equal((await renderOnInk8('ink-scroll-list')).trim(), 'a\nb\nc', 'renders on Ink 8');
    },
  },
  'ink-virtual-list': {
    text: 'Peer `^6 || ^7`; renders on Ink 8.',
    async check(t, q) {
      t.equal(semver.validRange(q.tok('^6 || ^7')), semver.validRange(installed('ink-virtual-list').json.peerDependencies.ink));
      t.match(await renderOnInk8('ink-virtual-list'), /\ba\b/, 'renders on Ink 8');
    },
  },
  'ink-chart': {
    text: 'An unrelated package with a different API. The components documented in `ink-charts` are `@pppp606/ink-chart`.',
    async check(t, q) {
      const other = byName('ink-chart');
      const mine = byName(q.tok('@pppp606/ink-chart'));
      t.notEqual(other.repository, mine.repository, 'unrelated: another repository');
      t.deepEqual(other.maintainers.filter((m) => mine.maintainers.includes(m)), [], 'and other maintainers');
      const readme = readFileSync(findCaseInsensitive(installed('ink-chart').dir, 'README.md'), 'utf8');
      t.match(readme, /import Chart from 'ink-chart'/, 'ink-chart documents one default Chart component');
      const names = Object.keys(await import(mine.name));
      t.ok(['Sparkline', 'BarChart', 'LineGraph'].every((n) => names.includes(n)) && !names.includes('Chart'), 'a different API: named chart components');
      t.ok(loadFile(q.tok('ink-charts'), 'SKILL.md').raw.includes(`\`${mine.name}\``), 'and the ink-charts skill documents the other one');
    },
  },
  '@pppp606/ink-chart': {
    text: 'Pre-1.0; pin the version.',
    async check(t, q) {
      t.ok(semver.lt(installed('@pppp606/ink-chart').json.version, `${q.tok('1.0')}.0`), 'its version is below 1.0');
    },
  },
  'ink-markdown': {
    text: 'CommonJS build `require()`s Ink (`ERR_REQUIRE_ASYNC_MODULE`). Render with `marked` + `marked-terminal` instead.',
    async check(t, q) {
      await commonJsBuild(t, q, 'ink-markdown');
      const { marked } = await import(q.tok('marked'));
      const { markedTerminal } = await import(q.tok('marked-terminal'));
      marked.use(markedTerminal());
      t.match(stripAnsi(marked.parse('# Title')), /Title/);
    },
  },
  '@kud/ink-markdown': {
    text: 'Peer `7.x`; renders on Ink 8.',
    async check(t, q) {
      t.equal(installed('@kud/ink-markdown').json.peerDependencies.ink, q.tok('7.x'));
      t.match(await renderOnInk8('@kud/ink-markdown'), /Title/, 'renders on Ink 8');
    },
  },
  'ink-syntax-highlight': {
    text: 'Peers `ink ^5.1.0` and `react ^18.3.1`; renders on Ink 8 + React 19. Calling `cli-highlight` directly avoids the peer conflict.',
    async check(t, q) {
      const peers = installed('ink-syntax-highlight').json.peerDependencies;
      for (const token of ['ink ^5.1.0', 'react ^18.3.1']) {
        const [name, range] = q.tok(token).split(' ');
        t.equal(peers[name], range, `peer ${name}`);
      }
      t.equal(Number(q.tok('8')), semver.major(INK));
      t.equal(Number(q.tok('19')), semver.major(REACT));
      t.match(await renderOnInk8('ink-syntax-highlight'), /const a = 1;/, 'renders on Ink 8 + React 19');
      const name = q.tok('cli-highlight');
      t.deepEqual(Object.keys(installed(name).json.peerDependencies ?? {}), [], 'cli-highlight has no peer ranges to conflict with');
      t.match((await import(name)).highlight('const a = 1;', { language: 'js' }), /\x1b\[/, 'and highlights code itself');
    },
  },
};

s.types(
  F,
  ['`state="loading"` requires a `spinner` prop.'],
  tsx`
import React from 'react';
import {Task} from 'ink-task-list';

const spinner = {interval: 80, frames: ['-', '\\\\', '|', '/']};
export const loadingWithSpinner = <Task label="Build" state="loading" spinner={spinner} />;
export const loadingWithoutSpinner = <Task label="Build" state="loading" />; //! TS2322
export const otherStatesNeedNone = <Task label="Build" state="success" />;
`,
  { ctx: ['state="loading"', 'spinner'] },
);

// ===================================================================== before recommending

s.guidance(F, ['Do not infer compatibility from the peer range alone.'], 'the instruction that the matrix above demonstrates: ink-table and ink-tab are the proofs');

s.guidance(F, ['In a scratch project with the current `ink` and `react`:'], 'introduces the numbered procedure; each step is proven below', { exempt: ['ink', 'react'] });

s.fact(F, ['`npm view <package> peerDependencies type main exports` — no `"type": "module"`, a `main` ending in `.js` and no `exports` entry for `import` mean a CommonJS build.'], { kind: 'P', ctx: ['<package>'] }, async (t, q) => {
  const command = q.tok('npm view <package> peerDependencies type main exports').split(' ');
  const cjsShaped = (json) => json.type !== 'module' && /\.js$/.test(json.main ?? '') && !(json.exports && typeof json.exports === 'object' && JSON.stringify(json.exports).includes('"import"'));
  const field = q.tok('"type": "module"').match(/"(\w+)": "(\w+)"/);
  for (const p of data.packages) {
    const info = installed(p.name);
    const shaped = cjsShaped({ ...info.json, type: info.json[field[1]] === field[2] ? 'module' : info.json.type });
    const failsToRequireInk = loadsInCleanProcess(p.name).code === 'ERR_REQUIRE_ASYNC_MODULE';
    t.equal(shaped, failsToRequireInk, `${p.name}: ${shaped ? 'looks like' : 'does not look like'} a CommonJS build and ${failsToRequireInk ? 'is one' : 'is not'}`);
  }
  const view = spawnSync(command[0], [command[1], installed('ink-table').dir, ...command.slice(3), '--json'], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, npm_config_loglevel: 'error' } });
  t.equal(view.status, 0, 'npm view accepts those fields');
  const shown = JSON.parse(view.stdout);
  t.deepEqual(Object.keys(shown).sort(), ['main', 'peerDependencies'], 'and prints the ones the package has');
  t.equal(shown.main, installed('ink-table').json.main);
  t.match(q.tok('.js'), /^\.js$/);
  t.equal(q.tok('main'), 'main');
  t.equal(q.tok('exports'), 'exports');
  t.equal(q.tok('import'), 'import');
});

s.fact(F, ['`npm install <package>` with strict peers — an `ERESOLVE` error naming `ink` means the range excludes your Ink.'], { kind: 'P', ctx: ['<package>', 'npm install <package>'] }, async (t, q) => {
  const code = q.tok('ERESOLVE');
  const peer = q.tok('ink');
  let refusedCount = 0;
  for (const p of data.packages.filter((x) => x.name !== 'ink')) {
    const range = installed(p.name).json.peerDependencies?.[peer];
    const refused = npmInstall(p.name);
    const namesInk = new RegExp(`peer ${peer}@`).test(refused.message) && refused.message.includes(code);
    if (namesInk) refusedCount++;
    t.equal(namesInk, range !== undefined && !semver.satisfies(INK, range), `${p.name}: ${namesInk ? `ERESOLVE names ${peer}` : `no ERESOLVE for ${peer}`} exactly when its range ${range ?? '(none)'} excludes Ink ${INK}`);
  }
  t.ok(refusedCount >= 5, `npm did refuse packages naming ${peer} (${refusedCount} of them)`);
});

s.fact(F, ['`node -e "import(\'<package>\')"` — `ERR_REQUIRE_ASYNC_MODULE` means a CommonJS build that `require()`s Ink; a React internals error means it bundles its own old Ink.'], { kind: 'P', ctx: ['<package>', 'node -e "import(\'<package>\')"'] }, async (t, q) => {
  const code = q.tok('ERR_REQUIRE_ASYNC_MODULE');
  const requireCall = q.tok('require()').slice(0, -2);
  const run = (name) => spawnSync(process.execPath, ['-e', `import('${name}')`], { cwd: EXT, env: { PATH: '', HOME: process.env.HOME ?? '', NODE_NO_WARNINGS: '1' }, encoding: 'utf8' });
  for (const name of ['ink-table', 'ink-multi-select', 'ink-markdown']) {
    const result = run(name);
    t.match(result.stderr, new RegExp(code), `${name}: the command prints ${code}`);
    t.match(readAllJs(installed(name).dir), new RegExp(`${requireCall}\\(["']ink["']\\)`), `${name} is a CommonJS build that calls ${requireCall}("ink")`);
  }
  const bundled = run('ink-divider');
  t.match(bundled.stderr, /ReactCurrentOwner/, 'a React internals error');
  t.ok(installed('ink-divider').json.dependencies.ink && JSON.parse(readFileSync(join(installed('ink-divider').dir, 'node_modules', 'ink', 'package.json'), 'utf8')).version !== INK, 'because the package brings its own, older Ink');
});

s.fact(F, ['Render a minimal tree with `ink-testing-library` (`ink-testing`) and read `lastFrame()`.'], { kind: 'R', ctx: ['ink-testing'] }, async (t, q) => {
  const lib = await import(q.tok('ink-testing-library'));
  const app = lib.render(h(Text, null, 'hello'));
  t.equal(typeof q.api(app, 'lastFrame()'), 'function', 'the render result has lastFrame');
  t.equal(app.lastFrame(), 'hello', 'which returns the last frame');
  app.unmount();
});

s.guidance(F, ['Say plainly when a need has no working package rather than recommending one that merely installs.'], 'an instruction about how to answer; it asserts nothing about behaviour');
