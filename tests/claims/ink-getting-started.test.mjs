// Claims for skills/core/ink-getting-started/SKILL.md.
import semver from 'semver';
import { skill, tsx, h, ink, mount, pkg, extPkg, runIsolated, stripAnsi, catchRenderError } from '../lib/index.mjs';
import { scaffold, build, baseOptions } from './ink-getting-started.helpers.mjs';

const { Box, Text, renderToString } = ink;
const s = skill('ink-getting-started');
const F = 'SKILL.md';

const TTY = { isTTY: true, columns: 80, rows: 24 };
const processRuns = new Map();
/** One run of the process probe per scenario (shared with the ink-rendering-and-lifecycle claims). */
function processProbe(scenario, hook = 'useInput') {
  const key = `${scenario}/${hook}`;
  if (!processRuns.has(key)) {
    processRuns.set(key, runIsolated({ probe: 'ink-rendering-and-lifecycle-process', env: { FORCE_COLOR: '0', PROBE_SCENARIO: scenario, PROBE_HOOK: hook, PROBE_ALIVE_MS: '1500' }, tty: scenario === 'input' ? TTY : {}, timeout: 20_000 }));
  }
  return processRuns.get(key);
}
const fence = (n) => s.fenceOf(F, n).code;
const cliSource = () => fence(2);
const binManifest = () => fence(4);
const rangeOf = (token) => token.split(' ').slice(1).join(' ');

// ===================================================================== description

s.fact(
  F,
  ['Scaffold a new Ink project — create-ink-app, TypeScript/ESM setup, the package.json bin field for a CLI entry point, and the Node.js process model an Ink app runs under.'],
  { kind: 'R', timeout: 30_000 },
  async (t) => {
    const ts = await scaffold('--typescript', 'topics-ts');
    t.equal(ts.pkg.type, 'module', 'create-ink-app: ESM');
    t.ok('tsconfig.json' in ts.files && 'source/cli.tsx' in ts.files, 'and a TypeScript setup');
    t.equal(ts.pkg.bin, 'dist/cli.js', 'with the package.json bin field pointing at the CLI entry point');
    const none = await processProbe('none');
    t.deepEqual(none.json, { scenario: 'none', alive: false }, 'the process model: with no async work an Ink app is over once it has rendered');
  },
);

s.guidance(
  F,
  ['Use when starting a new Ink CLI, adding Ink to an existing project, or the app exits immediately instead of rendering.'],
  'a pointer to when the skill applies; it asserts nothing about behaviour',
);

// ===================================================================== requirements

s.fact(F, ['Requires Node >=22 and react >=19.3.0 (plus @types/react >=19.3.0 when using TypeScript).'], { kind: 'P' }, async (t, q) => {
  const ink8 = pkg('ink');
  const node = q.tok('22');
  const [reactVersion, typesVersion] = [q.tok('19.3.0'), q.tok('19.3.0')];
  t.equal(ink8.engines.node, `>=${node}`, "Ink's engines.node");
  t.equal(ink8.peerDependencies.react, `>=${reactVersion}`, "Ink's peer range for react");
  t.equal(ink8.peerDependencies['@types/react'], `>=${typesVersion}`, 'and for @types/react');
  t.equal(ink8.peerDependenciesMeta['@types/react'].optional, true, 'which only matters with TypeScript: it is an optional peer');
  t.ok(!('optional' in (ink8.peerDependenciesMeta.react ?? {})), 'while react is required');
});

// ===================================================================== create-ink-app

s.fact(
  F,
  ['[`create-ink-app`](https://github.com/vadimdemedes/create-ink-app) sets up ESM, a `bin` entry, and a sample app (plain JavaScript + Babel by default):'],
  { kind: 'R', timeout: 30_000 },
  async (t, q) => {
    const name = q.tok('create-ink-app');
    const binField = q.tok('bin');
    const meta = extPkg(name);
    t.equal(meta.repository, 'vadimdemedes/create-ink-app', 'the repository the link points at');
    t.equal(typeof meta[binField], 'string', `${name} is a command (${binField})`);
    const app = await scaffold('sample-app');
    t.ok(app.output.includes('Command failed with ENOENT: npm install'), 'the run stopped at the install step: it had no npm to run, the files were copied before that');
    t.equal(app.pkg.type, 'module', 'ESM');
    t.equal(app.pkg[binField], 'dist/cli.js', `a ${binField} entry`);
    t.ok(app.files['source/app.js'].includes('export default function App'), 'a sample app');
    t.ok(app.files['source/cli.js'].startsWith('#!/usr/bin/env node'), 'and a CLI that renders it');
    t.ok(!('source/cli.tsx' in app.files), 'JavaScript by default');
    t.deepEqual(app.pkg.babel, { presets: ['@babel/preset-react'] }, 'compiled with Babel by default');
  },
);

s.fence(F, 0, {
  run: async (t, fence) => {
    const commands = fence.code
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith('#'))
      .map((line) => line.split(' '));
    t.deepEqual(commands, [['npx', 'create-ink-app', 'my-ink-cli'], ['npx', 'create-ink-app', '--typescript', 'my-ink-cli']]);
    const [plain, typescript] = await Promise.all(commands.map(([, , ...args]) => scaffold(...args)));
    t.equal(plain.pkg.name, 'my-ink-cli', 'the project directory argument names the project');
    t.ok('source/app.js' in plain.files, 'the first command scaffolds JavaScript');
    t.ok('source/app.tsx' in typescript.files && 'tsconfig.json' in typescript.files, 'the second one, with --typescript, scaffolds TypeScript');
    t.equal(typescript.pkg.name, 'my-ink-cli');
  },
});

s.fact(F, ['or the TypeScript template'], { kind: 'R', timeout: 30_000 }, async (t) => {
  const js = await scaffold('template-js');
  const ts = await scaffold('--typescript', 'template-ts');
  t.deepEqual(Object.keys(js.files).filter((file) => file.startsWith('source/')).sort(), ['source/app.js', 'source/cli.js']);
  t.deepEqual(Object.keys(ts.files).filter((file) => file.startsWith('source/')).sort(), ['source/app.tsx', 'source/cli.tsx'], '--typescript scaffolds TypeScript sources');
  t.ok('tsconfig.json' in ts.files && !('tsconfig.json' in js.files), 'with a tsconfig.json');
  t.equal(ts.pkg.scripts.build, 'tsc', 'built with tsc');
});

s.fact(
  F,
  ['`create-ink-app` 3.0.2 still scaffolds Ink 4 / React 18 — its templates pin `ink ^4.1.0`, `react ^18.2.0`, `ink-testing-library ^3.0.0` and `"node": ">=16"`.'],
  { kind: 'P', timeout: 30_000 },
  async (t, q) => {
    t.equal(extPkg(q.tok('create-ink-app')).version, q.tok('3.0.2'), 'the version installed for these tests');
    const inkRange = rangeOf(q.tok('ink ^4.1.0'));
    const reactRange = rangeOf(q.tok('react ^18.2.0'));
    const testingRange = rangeOf(q.tok('ink-testing-library ^3.0.0'));
    const nodeRange = JSON.parse(`{${q.tok('"node": ">=16"')}}`).node;
    t.equal(semver.minVersion(inkRange).major, Number(q.tok('4')), 'Ink 4');
    t.equal(semver.minVersion(reactRange).major, Number(q.tok('18')), 'React 18');
    for (const [label, app] of [['JavaScript', await scaffold('pins-js')], ['TypeScript', await scaffold('--typescript', 'pins-ts')]]) {
      t.equal(app.pkg.dependencies.ink, inkRange, `${label} template: ink`);
      t.equal(app.pkg.dependencies.react, reactRange, `${label} template: react`);
      t.equal(app.pkg.devDependencies['ink-testing-library'], testingRange, `${label} template: ink-testing-library`);
      t.equal(app.pkg.engines.node, nodeRange, `${label} template: node`);
    }
  },
);

s.fact(F, ['After scaffolding, upgrade and raise the Node floor:'], { kind: 'R', timeout: 30_000 }, async (t) => {
  const app = await scaffold('upgrade');
  const current = pkg('ink');
  t.ok(!semver.satisfies(current.version, app.pkg.dependencies.ink), `the scaffolded ink range ${app.pkg.dependencies.ink} does not include Ink ${current.version}`);
  t.ok(!semver.satisfies(pkg('react').version, app.pkg.dependencies.react), `nor does react ${app.pkg.dependencies.react} satisfy Ink's peer range ${current.peerDependencies.react}`);
  t.ok(!semver.subset(app.pkg.engines.node, current.engines.node), `and node ${app.pkg.engines.node} allows versions Ink ${current.version} (${current.engines.node}) does not`);
});

s.fence(F, 1, {
  run: async (t, fence) => {
    const specs = [...fence.code.matchAll(/(@?[\w/-]+)@(\^[\d.]+)/g)].map((match) => ({ name: match[1], range: match[2] }));
    t.deepEqual(specs.map((spec) => spec.name), ['ink', 'react', '@types/react', 'ink-testing-library']);
    for (const { name, range } of specs) t.ok(semver.satisfies(pkg(name).version, range), `${name}@${range}: the version used here (${pkg(name).version}) satisfies it`);
    const { peerDependencies } = pkg('ink');
    t.ok(semver.subset(specs[1].range, peerDependencies.react), `react ${specs[1].range} is within Ink's peer range ${peerDependencies.react}`);
    t.ok(semver.subset(specs[2].range, peerDependencies['@types/react']), `@types/react ${specs[2].range} too`);
    const [runtime, development] = fence.code.split('\n').filter(Boolean).map((line) => line.split(' '));
    t.deepEqual([runtime.slice(0, 2), runtime.includes('-D')], [['npm', 'i'], false], 'the first command installs dependencies');
    t.deepEqual([development.slice(0, 3), development.slice(3)], [['npm', 'i', '-D'], ['@types/react@^19.3', 'ink-testing-library@^4']], 'the second one the types and the testing library as devDependencies');
    t.ok(Object.keys(pkg('ink-testing-library').peerDependencies ?? {}).every((peer) => peer === '@types/react'), 'ink-testing-library@^4 has no peers other than @types/react');
  },
});

s.fact(
  F,
  ['Then set `"engines": {"node": ">=22"}` in `package.json`.'],
  { kind: 'R', timeout: 30_000 },
  async (t, q) => {
    const wanted = JSON.parse(`{${q.tok('"engines": {"node": ">=22"}')}}`).engines;
    const manifest = q.tok('package.json');
    const app = await scaffold('engines');
    t.ok(manifest in app.files, `the scaffold's ${manifest}`);
    t.equal(app.pkg.engines.node, '>=16', 'says >=16 until you change it');
    t.deepEqual(wanted, pkg('ink').engines, "the value is Ink's own engines field");
    t.ok(semver.subset(wanted.node, pkg('ink').engines.node));
  },
);

// ===================================================================== hand-written setup

s.fact(F, ['Ink components are ordinary React.'], { kind: 'R' }, async (t) => {
  const React = await import('react');
  const Theme = React.createContext('plain');
  const Ordinary = () => {
    const [count, setCount] = React.useState(0);
    const theme = React.useContext(Theme);
    const label = React.useMemo(() => `${theme} ${count}`, [theme, count]);
    React.useEffect(() => setCount(1), []);
    return h(Text, null, label);
  };
  const app = mount(h(Theme.Provider, { value: 'fancy' }, h(Ordinary)));
  await app.flush();
  t.equal(app.screen(), 'fancy 1', 'state, effects, context and memo work as in any React app');
});

s.fact(
  F,
  ['With a TypeScript + ESM toolchain (`tsc` compiled ahead of time) no Babel config is needed — `tsc` compiles JSX itself when `tsconfig.json` sets `"jsx": "react-jsx"`.'],
  { kind: 'R', timeout: 60_000 },
  async (t, q) => {
    const tsc = q.tok('tsc');
    const configFile = q.tok('tsconfig.json');
    const jsx = JSON.parse(`{${q.tok('"jsx": "react-jsx"')}}`);
    const files = { 'package.json': binManifest(), 'source/cli.tsx': cliSource() };
    t.equal(configFile, 'tsconfig.json');
    const built = await build({ files, compilerOptions: { ...baseOptions, ...jsx }, tsc });
    t.equal(built.compiled.code, 0, built.compiled.stdout);
    t.ok(!/<Text>/.test(built.output) && built.output.includes('react/jsx-runtime'), 'the output has no JSX left: tsc turned it into jsx-runtime calls');
    t.deepEqual(Object.keys(JSON.parse(files['package.json'])), ['name', 'bin', 'type'], 'there is no Babel config or dependency in the project');
    t.equal(built.executed.code, 0, built.executed.stderr);
    t.equal(built.executed.stdout.trim(), 'Hello World', 'and the result runs');

    const without = await build({ files, compilerOptions: baseOptions, tsc });
    t.notEqual(without.compiled.code, 0, 'positive control: without the jsx setting tsc refuses');
    t.match(without.compiled.stdout, /TS17004: Cannot use JSX unless the '--jsx' flag is provided/);
    t.match(without.output, /<Text>Hello World<\/Text>/, 'and what it emits still holds the JSX');
    t.notEqual(without.executed.code, 0, 'which node cannot run');
  },
);

s.fence(F, 2, {
  run: async (t, fence) => {
    const built = await build({ files: { 'package.json': binManifest(), 'source/cli.tsx': fence.code }, compilerOptions: { ...baseOptions, jsx: 'react-jsx' } });
    t.equal(built.compiled.code, 0, `the fence compiles as a file of its own: ${built.compiled.stdout}`);
    t.equal(built.executed.code, 0, built.executed.stderr);
    t.equal(built.executed.stdout.trim(), 'Hello World', 'and prints its text');
  },
});

s.fact(
  F,
  ['Compile it with `tsc`, then run the output with `node` (`node dist/cli.js`).'],
  { kind: 'R', timeout: 60_000 },
  async (t, q) => {
    const tsc = q.tok('tsc');
    const node = q.tok('node');
    const command = q.tok('node dist/cli.js');
    t.equal(command.split(' ')[0], node);
    const built = await build({ files: { 'package.json': binManifest(), 'source/cli.tsx': cliSource() }, compilerOptions: { ...baseOptions, jsx: 'react-jsx' }, tsc, command });
    t.equal(built.compiled.code, 0, built.compiled.stdout);
    t.deepEqual([built.executed.code, built.executed.stdout.trim()], [0, 'Hello World'], `${command} runs what tsc wrote`);
  },
);

s.fact(
  F,
  ['The JavaScript template of `create-ink-app` builds with `@babel/cli` and `@babel/preset-react`, configured in `package.json`:'],
  { kind: 'P', timeout: 30_000 },
  async (t, q) => {
    const manifest = q.tok('package.json');
    const [cli, preset] = [q.tok('@babel/cli'), q.tok('@babel/preset-react')];
    const js = await scaffold('babel-js');
    const ts = await scaffold('--typescript', 'babel-ts');
    t.equal(extPkg(q.tok('create-ink-app')).name, 'create-ink-app');
    const pkgOf = JSON.parse(js.files[manifest]);
    t.ok(cli in pkgOf.devDependencies && preset in pkgOf.devDependencies, 'both are devDependencies of the JavaScript template');
    t.match(pkgOf.scripts.build, /^babel /, 'the build script runs babel');
    t.deepEqual(pkgOf.babel.presets, [preset], 'the preset is configured in package.json');
    t.ok(!(cli in ts.pkg.devDependencies) && !(preset in ts.pkg.devDependencies), 'positive control: the TypeScript template has neither');
  },
);

s.fence(F, 3, {
  run: async (t, fence) => {
    const shown = JSON.parse(fence.code);
    const js = await scaffold('babel-fence');
    t.deepEqual(shown, { scripts: { build: js.pkg.scripts.build }, babel: js.pkg.babel }, 'the scripts.build and babel entries of the generated package.json, as they are');
  },
});

// ===================================================================== the bin field

s.fact(
  F,
  ["For a publishable CLI, point `package.json`'s `bin` field at the compiled entry and keep the shebang line as the very first line of the **compiled** output (`tsc` keeps it):"],
  { kind: 'R', ctx: ['compiled'], timeout: 60_000 },
  async (t, q) => {
    const manifest = q.tok('package.json');
    const field = q.tok('bin');
    const tsc = q.tok('tsc');
    const source = cliSource();
    t.ok(source.startsWith('#!'), 'the source starts with a shebang');
    const built = await build({ files: { 'package.json': binManifest(), 'source/cli.tsx': source }, compilerOptions: { ...baseOptions, jsx: 'react-jsx' }, tsc });
    const app = await scaffold('bin-field');
    const bin = JSON.parse(app.files[manifest])[field];
    t.equal(bin, 'dist/cli.js', `the ${field} field of the ${manifest} create-ink-app writes`);
    t.equal(built.compiled.code, 0, built.compiled.stdout);
    t.equal(JSON.parse(binManifest())[field], bin, 'the same path as in the manifest of the hand-written project');
    t.equal(built.output.split('\n')[0], '#!/usr/bin/env node', `${tsc} keeps the shebang as the first line of the compiled ${bin}`);
    t.equal(built.executed.stdout.trim(), 'Hello World', `${bin} is the file the build wrote, and it runs`);
  },
);

s.fence(F, 4, {
  run: async (t, fence) => {
    const manifest = JSON.parse(fence.code);
    t.deepEqual(Object.keys(manifest), ['name', 'bin', 'type']);
    const built = await build({ files: { 'package.json': fence.code, 'source/cli.tsx': cliSource() }, compilerOptions: { ...baseOptions, jsx: 'react-jsx' }, command: `node ${manifest.bin}` });
    t.ok(built.output.startsWith('#!/usr/bin/env node'), 'bin names a file the build produces, and it begins with the shebang');
    t.equal(built.executed.stdout.trim(), 'Hello World', 'and "type": "module" lets node run it as an ES module');
    const app = await scaffold('bin-fence');
    t.equal(manifest.bin, app.pkg.bin);
    t.equal(manifest.type, app.pkg.type);
  },
});

// ===================================================================== the process model

s.fact(
  F,
  ["An Ink app stays alive only while there's active work in the event loop — timers, open handles such as sockets or child processes, or `useInput` listening on stdin; a pending promise on its own does not keep it alive."],
  { kind: 'R', timeout: 40_000 },
  async (t, q) => {
    const hook = q.tok('useInput');
    const [none, timer, server, child, promise, input] = await Promise.all(['none', 'timer', 'server', 'child', 'promise', 'input'].map((scenario) => processProbe(scenario, hook)));
    t.deepEqual([none.json.alive, promise.json.alive], [false, false], 'nothing, or only a promise that never settles: the process ends');
    t.deepEqual([timer.json.alive, server.json.alive, child.json.alive, input.json.alive], [true, true, true, true], 'a timer, a listening socket, a child process, useInput: it stays');
  },
);

s.fact(F, ['**A component tree with no async work renders once and exits immediately.**'], { kind: 'R', ctx: ['A component tree with no async work renders once and exits immediately.'] }, async (t) => {
  const run = await processProbe('none');
  t.deepEqual([run.code, run.json.alive], [0, false], 'the process ends by itself');
  t.equal(stripAnsi(run.stdout).split('\n').filter((line) => line === 'frame').length, 1, 'after drawing its frame once');
});

s.fact(
  F,
  ['If your CLI prints its UI and then quits before you can interact with it, nothing is keeping the event loop alive — add what the app is waiting for, for example `useInput` (see `ink-input-handling`).'],
  { kind: 'R', ctx: ['ink-input-handling'], timeout: 30_000 },
  async (t, q) => {
    const hook = q.tok('useInput');
    const [without, withInput] = await Promise.all([processProbe('none', hook), processProbe('input', hook)]);
    t.equal(without.json.alive, false, 'without anything: it prints and quits');
    t.equal(withInput.json.alive, true, 'with useInput: it keeps running');
    t.ok(withInput.stdout.includes('frame'), 'after drawing its UI');
  },
);

s.guidance(
  F,
  ["See `ink-rendering-and-lifecycle` for `render()`'s full option set, `waitUntilExit()`, and how to exit deliberately instead of relying on the process just running out of work."],
  'a pointer to another skill; the behaviour of render() and waitUntilExit() is covered in that skill',
  { exempt: ['render()', 'waitUntilExit()'] },
);

// ===================================================================== flexbox

s.fact(
  F,
  ['Layout is flexbox, computed by Yoga — think of every `<Box>` as a browser `<div>` with `display: flex` already applied.'],
  { kind: 'R', ctx: ['<div>'] },
  async (t, q) => {
    const BoxEl = q.el(ink, '<Box>');
    const [prop, value] = q.tok('display: flex').split(': ');
    t.ok('yoga-layout' in pkg('ink').dependencies, 'Ink lays out with Yoga');
    const row = renderToString(h(BoxEl, null, h(Text, null, 'a'), h(Text, null, 'b')));
    t.equal(row, 'ab', 'children sit side by side, as flex items do in a row');
    t.equal(renderToString(h(BoxEl, { [prop]: value }, h(Text, null, 'a'), h(Text, null, 'b'))), row, `display: flex changes nothing: it is already applied`);
    t.equal(renderToString(h(BoxEl, { flexDirection: 'column' }, h(Text, null, 'a'), h(Text, null, 'b'))), 'a\nb', 'flex properties work as in CSS');
    t.equal(renderToString(h(BoxEl, { [prop]: 'none' }, h(Text, null, 'a'))), '', 'and display: none hides it');
  },
);

s.types(
  F,
  ['There is no non-flex layout mode.'],
  tsx`
import {Box} from 'ink';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const modes: Same<NonNullable<React.ComponentProps<typeof Box>['display']>, 'flex' | 'none'> = true;
export const flex = <Box display="flex" />;
export const hidden = <Box display="none" />;
export const block = <Box display="block" />; //! TS2322
export const grid = <Box display="grid" />; //! TS2322
`,
);

s.fact(
  F,
  ['All text must be wrapped in `<Text>`; a raw string as a direct child of `<Box>` throws (`Text string "…" must be rendered inside <Text> component`).'],
  { kind: 'R' },
  async (t, q) => {
    const TextEl = q.el(ink, '<Text>');
    const BoxEl = q.el(ink, '<Box>');
    const template = q.tok('Text string "…" must be rendered inside <Text> component');
    const error = catchRenderError(h(BoxEl, null, 'raw string'));
    t.equal(error?.message, template.replace('…', 'raw string'), 'the message names the string');
    t.equal(renderToString(h(BoxEl, null, h(TextEl, null, 'raw string'))), 'raw string', 'positive control: wrapped in <Text> it renders');
  },
);

s.guidance(F, ['See `ink-layout` for the full flexbox API.'], 'a pointer to another skill');
