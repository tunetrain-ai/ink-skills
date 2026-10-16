// Evidence about the packages in the compatibility matrix: where each is installed, whether it
// loads in a clean process, whether npm accepts it next to the installed Ink and React with
// strict peer dependencies, and a minimal render on Ink 8.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, EXT, h, ink as rootInk, mount as rootMount, stripAnsi, externalHarness, extImport } from '../lib/index.mjs';
import { png, picture } from './ink-decoration.helpers.mjs';

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const rootPackage = readJson(join(ROOT, 'package.json'));
const externalPackage = readJson(join(EXT, 'package.json'));
const rootDeps = new Set([...Object.keys(rootPackage.dependencies ?? {}), ...Object.keys(rootPackage.devDependencies ?? {})]);

/** Which project holds the copy of `name` the matrix is about. */
export const projectOf = (name) => (rootDeps.has(name) || name === 'ink' ? 'root' : 'external');

/** package.json (and directory) of the installed copy the matrix is about. */
export function installed(name) {
  const base = projectOf(name) === 'root' ? ROOT : EXT;
  const dir = join(base, 'node_modules', name);
  if (!existsSync(join(dir, 'package.json'))) throw new Error(`${name} is not installed in the ${projectOf(name)} project`);
  return { json: readJson(join(dir, 'package.json')), dir, project: projectOf(name) };
}

/** Version of any installed package, wherever it is (root first). */
export function versionOf(name) {
  for (const base of [ROOT, EXT]) {
    const file = join(base, 'node_modules', name, 'package.json');
    if (existsSync(file)) return readJson(file).version;
  }
  return null;
}

export const declaredExternally = (name) => name in (externalPackage.dependencies ?? {});

// ---------------------------------------------------------------------------
// a clean-process import
// ---------------------------------------------------------------------------

const CLEAN_ENV = { PATH: '', HOME: process.env.HOME ?? '', TMPDIR: process.env.TMPDIR ?? '/tmp', NODE_NO_WARNINGS: '1' };
const imports = new Map();

/** import(name) in a fresh Node process in the right project. {ok, exports?, code?, message?} */
export function loadsInCleanProcess(name) {
  if (!imports.has(name)) {
    const code = `try { const m = await import(${JSON.stringify(name)}); console.log(JSON.stringify({ok: true, exports: Object.keys(m)})); } catch (e) { console.log(JSON.stringify({ok: false, code: e.code ?? null, name: e.name, message: String(e.message).split('\\n')[0]})); }`;
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: projectOf(name) === 'root' ? ROOT : EXT, env: CLEAN_ENV, encoding: 'utf8' });
    const line = run.stdout.split('\n').reverse().find((l) => l.startsWith('{'));
    imports.set(name, line ? JSON.parse(line) : { ok: false, code: 'NO_OUTPUT', message: run.stderr.split('\n')[0] });
  }
  return imports.get(name);
}

// ---------------------------------------------------------------------------
// npm with strict peers, offline
// ---------------------------------------------------------------------------

let scratch;
const tarballs = new Map();
const npmEnv = () => {
  scratch ??= mkdtempSync(join(tmpdir(), 'ink-skills-npm-'));
  const user = join(scratch, 'npmrc-user');
  const global = join(scratch, 'npmrc-global');
  writeFileSync(user, '');
  writeFileSync(global, '');
  return { PATH: process.env.PATH ?? '', HOME: scratch, TMPDIR: process.env.TMPDIR ?? '/tmp', npm_config_userconfig: user, npm_config_globalconfig: global, npm_config_update_notifier: 'false', npm_config_loglevel: 'error' };
};
process.on('exit', () => scratch && rmSync(scratch, { recursive: true, force: true }));

/** An empty package with this name, version and peer ranges, packed to a tarball (cached). */
function stub(name, version, peerDependencies, peerDependenciesMeta) {
  const key = JSON.stringify([name, version, peerDependencies, peerDependenciesMeta]);
  if (!tarballs.has(key)) {
    const dir = mkdtempSync(join(scratch ?? (npmEnv(), scratch), 'stub-'));
    const manifest = { name, version };
    if (peerDependencies) manifest.peerDependencies = peerDependencies;
    if (peerDependenciesMeta) manifest.peerDependenciesMeta = peerDependenciesMeta;
    writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest));
    const packed = spawnSync('npm', ['pack', '--silent', '--pack-destination', dir], { cwd: dir, env: npmEnv(), encoding: 'utf8' });
    if (packed.status !== 0) throw new Error(`npm pack failed: ${packed.stderr}`);
    tarballs.set(key, join(dir, packed.stdout.trim().split('\n').pop()));
  }
  return tarballs.get(key);
}

const installs = new Map();

/**
 * Install the package's peer-range stub next to stubs of the installed Ink, React and every
 * other peer it asks for, using npm itself and no network. `legacy` passes `flag` (default --legacy-peer-deps), which switches peer checking off.
 * @returns {{ok: boolean, eresolve: boolean, message: string}}
 */
export function npmInstall(name, { legacy = false, flag = '--legacy-peer-deps' } = {}) {
  const key = `${name}|${legacy}|${flag}`;
  if (!installs.has(key)) {
    const { json } = installed(name);
    const files = [];
    const wanted = new Set(Object.entries(json.peerDependencies ?? {}).filter(([peer]) => !json.peerDependenciesMeta?.[peer]?.optional).map(([peer]) => peer));
    for (const peer of ['ink', 'react', ...wanted]) {
      if (peer === name) continue;
      const version = versionOf(peer);
      if (version) files.push(stub(peer, version));
      else if (wanted.has(peer)) throw new Error(`peer ${peer} of ${name} is not installed anywhere, so there is no version to offer npm`);
    }
    files.push(stub(name, json.version, json.peerDependencies, json.peerDependenciesMeta));
    const dir = mkdtempSync(join(scratch ?? (npmEnv(), scratch), 'proj-'));
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'scratch', version: '1.0.0', private: true }));
    const args = ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', ...(legacy ? [flag] : []), ...new Set(files)];
    const run = spawnSync('npm', args, { cwd: dir, env: npmEnv(), encoding: 'utf8' });
    const output = `${run.stdout}${run.stderr}`;
    installs.set(key, { ok: run.status === 0, eresolve: /ERESOLVE/.test(output), message: output });
  }
  return installs.get(key);
}

// ---------------------------------------------------------------------------
// a minimal render of each package on Ink 8
// ---------------------------------------------------------------------------

const external = () => externalHarness();
const use = async (name) => (projectOf(name) === 'root' ? import(name) : extImport(name));

/** Each recipe returns what the first render drew. */
const recipes = {
  ink: async () => draw(rootInk, h(rootInk.Box, null, h(rootInk.Text, null, 'hello'))),
  '@inkjs/ui': async () => draw(rootInk, h((await use('@inkjs/ui')).Badge, { color: 'green' }, 'ok')),
  'ink-testing-library': async () => {
    const { render } = await use('ink-testing-library');
    const app = render(h(rootInk.Text, null, 'hello'));
    const frame = app.lastFrame();
    app.unmount();
    return frame;
  },
  'ink-text-input': async () => ext(async ({ h: e }) => e((await use('ink-text-input')).default, { value: 'abc', onChange() {} })),
  'ink-spinner': async () => ext(async ({ h: e }) => e((await use('ink-spinner')).default, { type: 'dots' })),
  'ink-select-input': async () => ext(async ({ h: e }) => e((await use('ink-select-input')).default, { items: [{ label: 'First', value: 1 }, { label: 'Second', value: 2 }] })),
  '@alcalzone/ink-table': async () => draw(rootInk, h((await use('@alcalzone/ink-table')).Table, { data: [{ a: 1, b: 'x' }] })),
  'ink-link': async () => draw(rootInk, h((await use('ink-link')).default, { url: 'https://example.com' }, 'site')),
  'ink-gradient': async () => draw(rootInk, h((await use('ink-gradient')).default, { name: 'rainbow' }, 'hello')),
  'ink-big-text': async () => draw(rootInk, h((await use('ink-big-text')).default, { text: 'hi' })),
  '@mishieck/ink-titled-box': async () => ext(async ({ h: e, ink }) => e((await use('@mishieck/ink-titled-box')).TitledBox, { titles: ['Status'], borderStyle: 'round', width: 20 }, e(ink.Text, null, 'x'))),
  'ink-picture': async () => {
    const { file } = await png();
    const pic = await picture({ props: { src: file, width: 6, height: 3 } });
    await pic.settle();
    const screen = pic.app.screen();
    pic.app.unmount();
    return screen;
  },
  'ink-task-list': async () => {
    const { Task, TaskList } = await use('ink-task-list');
    return draw(rootInk, h(TaskList, null, h(Task, { label: 'Build', state: 'success' })));
  },
  'ink-spawn': async () => draw(rootInk, h((await use('ink-spawn')).Spawn, { command: process.execPath, args: ['-e', 'console.log("hi")'] }), 800),
  'ink-form': async () => draw(rootInk, h((await use('ink-form')).Form, { form: { title: 'Profile', sections: [{ title: 'Name', fields: [{ type: 'string', name: 'name', label: 'Name' }] }] }, onSubmit() {} })),
  'ink-tab': async () => {
    const { Tabs, Tab } = await use('ink-tab');
    return ext(async ({ h: e }) => e(Tabs, { onChange() {} }, e(Tab, { name: 'a' }, 'One'), e(Tab, { name: 'b' }, 'Two')));
  },
  'ink-stepper': async () => {
    const { Stepper, Step } = await use('ink-stepper');
    return ext(async ({ h: e, ink }) => e(Stepper, { onComplete() {} }, e(Step, { name: 's1' }, () => e(ink.Text, null, 'step one'))));
  },
  'ink-scroll-view': async () => {
    const { ScrollView } = await use('ink-scroll-view');
    return ext(async ({ h: e, ink }) => e(ink.Box, { height: 3 }, e(ScrollView, null, ...['a', 'b', 'c', 'd'].map((x) => e(ink.Text, { key: x }, x)))));
  },
  'ink-scroll-list': async () => {
    const { ScrollList } = await use('ink-scroll-list');
    return ext(async ({ h: e, ink }) => e(ink.Box, { height: 3 }, e(ScrollList, null, ...['a', 'b', 'c', 'd'].map((x) => e(ink.Text, { key: x }, x)))));
  },
  'ink-virtual-list': async () => {
    const { VirtualList } = await use('ink-virtual-list');
    return ext(async ({ h: e, ink }) => e(VirtualList, { items: ['a', 'b', 'c', 'd'], height: 3, itemHeight: 1, renderItem: ({ item }) => e(ink.Text, null, item) }));
  },
  '@pppp606/ink-chart': async () => draw(rootInk, h((await use('@pppp606/ink-chart')).Sparkline, { data: [1, 3, 2, 5] })),
  '@kud/ink-markdown': async () => ext(async ({ h: e }) => e((await use('@kud/ink-markdown')).MarkdownViewport, { source: '# Title\n\nbody text', width: 30, height: 4, scrollOffset: 0 })),
  'ink-syntax-highlight': async () => ext(async ({ h: e }) => e((await use('ink-syntax-highlight')).default, { code: 'const a = 1;', language: 'js' })),
};

/** Names with a recipe. */
export const hasRecipe = (name) => name in recipes;

async function draw(inkModule, element, wait = 0) {
  const app = rootMount(element, { columns: 60, rows: 14 });
  if (wait) await new Promise((r) => setTimeout(r, wait));
  await app.flush();
  const screen = app.screen();
  app.unmount();
  return screen;
}

async function ext(build) {
  const harness = await external();
  const app = harness.mount(await build(harness), { columns: 60, rows: 14 });
  await new Promise((r) => setTimeout(r, 120));
  await app.flush();
  const screen = app.screen();
  app.unmount();
  return screen;
}

const renders = new Map();

/** The text the package's recipe drew on its first render(s). */
export async function renderOnInk8(name) {
  if (!recipes[name]) throw new Error(`no render recipe for ${name}`);
  if (!renders.has(name)) renders.set(name, recipes[name]().then((screen) => stripAnsi(String(screen))));
  return renders.get(name);
}
