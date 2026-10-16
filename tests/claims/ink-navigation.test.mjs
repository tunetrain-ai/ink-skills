// Claims for skills/ecosystem/interaction/ink-navigation/SKILL.md.
import semver from 'semver';
import { skill, tsx, h, ink, React, stripAnsi, keys, mount, waitFor, externalHarness, extImport, extPkg, extReadFile, pkg } from '../lib/index.mjs';
import { npmInstall } from './ink-navigation.helpers.mjs';

const s = skill('ink-navigation');
const F = 'SKILL.md';

const base = { ink: pkg('ink').version, react: pkg('react').version };
const PACKAGES = ['ink-tab', 'ink-stepper', 'ink-scroll-view', 'ink-scroll-list', 'ink-virtual-list'];

// the external project's own Ink and React: its components must be mounted by them
let harness;
const ext = () => (harness ??= externalHarness());
const lib = async (name) => extImport(name);

/** The highest Ink major a peer range accepts. */
const ceiling = (range) => Math.max(...[...Array(20).keys()].filter((major) => semver.satisfies(`${major}.99.0`, range)));
/** Two peer ranges that accept exactly the same versions (the skill spells them shorter than the package does). */
const sameRange = (a, b) => semver.validRange(a) === semver.validRange(b);
const lines = (app) => app.screen().split('\n');
const items = (count) => Array.from({ length: count }, (_, i) => `Item ${i}`);

// ---------------------------------------------------------------------------
// ink-tab
// ---------------------------------------------------------------------------

/** Mount `<Tabs>` with one `<Tab>` per name; `changes` records every onChange. */
const tabs = async ({ names = ['overview', 'logs'], label = (name) => name, props = {} } = {}) => {
  const { h, mount } = await ext();
  const { Tab, Tabs } = await lib('ink-tab');
  const changes = [];
  const app = mount(h(Tabs, { onChange: (name) => changes.push(name), ...props }, ...names.map((name) => h(Tab, { key: name, name }, label(name)))), { columns: 60 });
  await app.flush();
  return { app, changes, at: () => changes.at(-1) };
};

// ---------------------------------------------------------------------------
// the five packages mounted the way the sections below use them
// ---------------------------------------------------------------------------

const scrollView = async ({ count = 20, height = 5, props = {}, children } = {}) => {
  const { h, mount, ink: eink, React: ereact } = await ext();
  const { ScrollView } = await lib('ink-scroll-view');
  const ref = ereact.createRef();
  const app = mount(h(eink.Box, { height, flexDirection: 'column' }, h(ScrollView, { ref, ...props }, ...(children ?? items(count).map((text) => h(eink.Text, { key: text }, text))))), { columns: 40, rows: 24 });
  await app.flush();
  return { app, ref };
};

const scrollList = async ({ count = 20, height = 5, selectedIndex, selectedProp = 'selectedIndex', extra = {} } = {}) => {
  const { h, mount, ink: eink, React: ereact } = await ext();
  const { ScrollList } = await lib('ink-scroll-list');
  const ref = ereact.createRef();
  const element = (index) => h(eink.Box, { height, flexDirection: 'column' }, h(ScrollList, { ref, [selectedProp]: index, ...extra }, ...items(count).map((text) => h(eink.Text, { key: text }, text))));
  const app = mount(element(selectedIndex), { columns: 40, rows: 24 });
  await app.flush();
  return { app, ref, select: (index) => app.rerender(element(index)) };
};

const virtualList = async ({ count = 1000, props = {}, columns = 40, rows = 24, render } = {}) => {
  const { h, mount, ink: eink, React: ereact } = await ext();
  const { VirtualList } = await lib('ink-virtual-list');
  const ref = ereact.createRef();
  const all = items(count);
  const app = mount(h(VirtualList, { ref, items: all, renderItem: render ?? (({ item }) => h(eink.Text, null, item)), ...props }), { columns, rows });
  await app.flush();
  return { app, ref, all };
};

// ===================================================================== description

s.fact(
  F,
  ['Tabs (ink-tab), step wizards (ink-stepper), and scrollable/virtualized lists for Ink — native <Box contentOffsetY> scrolling plus ink-scroll-view, ink-scroll-list and ink-virtual-list.'],
  { kind: 'R' },
  async (t) => {
    const { app } = await tabs();
    t.equal(app.screen(), '1. overview | 2. logs', 'ink-tab draws tabs');
    const { h: eh, mount: emount, ink: eink } = await ext();
    const { Stepper, Step } = await lib('ink-stepper');
    const wizard = emount(eh(Stepper, { onComplete() {} }, eh(Step, { name: 'One' }, eh(eink.Text, null, 'body'))), { columns: 40 });
    await wizard.flush();
    t.match(wizard.screen(), /One\n\nbody/, 'ink-stepper draws a wizard');
    const native = ink.renderToString(h(ink.Box, { height: 2, overflow: 'hidden', flexDirection: 'column', contentOffsetY: 3 }, h(ink.Box, { flexDirection: 'column', flexShrink: 0 }, ...items(10).map((text) => h(ink.Text, { key: text }, text)))));
    t.equal(stripAnsi(native), 'Item 3\nItem 4', 'the <Box contentOffsetY> scrolls');
    const view = await scrollView();
    t.equal(lines(view.app)[0], 'Item 0', 'ink-scroll-view draws a scrollable viewport');
    const list = await scrollList({ selectedIndex: 0 });
    t.equal(lines(list.app)[0], 'Item 0', 'ink-scroll-list draws a list');
    const virtual = await virtualList();
    t.ok(lines(virtual.app).includes('Item 0'), 'ink-virtual-list draws the window of a long list');
  },
);

s.guidance(
  F,
  ["Use when the user wants tabbed navigation, a multi-step wizard flow, or a scrollable/long list that shouldn't render every item at once."],
  'tells an agent when to load the skill; the packages it points to are covered by the claims on their own sections',
);

// ===================================================================== install caveat

const CAVEAT =
  '**Install caveat for everything below.** `ink-tab`, `ink-stepper`, `ink-scroll-view`, `ink-scroll-list` and `ink-virtual-list` all declare peer ranges that stop at Ink 6 or 7, so `npm install` fails with `ERESOLVE` on Ink 8 unless you pass `--legacy-peer-deps` (or add an `overrides` entry).';

s.fact(F, [CAVEAT], { kind: 'P', ctx: ['Install caveat for everything below.'] }, async (t, q) => {
  const names = PACKAGES.map((name) => q.tok(name));
  const installed = extPkg('ink').version;
  t.equal(semver.major(installed), Number(q.tok('8')), 'the Ink in use');
  const peers = names.map((name) => extPkg(name).peerDependencies.ink);
  t.ok(peers.every((range) => !semver.satisfies(installed, range)), `none of ${peers.join(', ')} accepts Ink ${installed}`);
  t.deepEqual([...new Set(peers.map(ceiling))].sort(), [Number(q.tok('6')), Number(q.tok('7'))].sort(), 'they stop at Ink 6 or 7');

  const command = q.tok('npm install').split(' ')[1];
  const everything = Object.fromEntries(names.map((name) => [name, extPkg(name).version]));
  for (const name of names) {
    const strict = await npmInstall({ dependencies: base, command, install: [name] });
    t.equal(strict.status, 1, `${command} ${name}: fails ...`);
    t.equal(strict.code, q.tok('ERESOLVE'), '... with ERESOLVE');
    const legacy = await npmInstall({ dependencies: base, command, install: [name], args: [q.tok('--legacy-peer-deps')] });
    t.equal(legacy.status, 0, `${q.tok('--legacy-peer-deps')}: installs`);
  }
  const plain = await npmInstall({ dependencies: { ...base, ...everything } });
  t.equal(plain.code, 'ERESOLVE', 'all five together fail the same way');
  const overridden = await npmInstall({ dependencies: { ...base, ...everything }, manifest: { [q.tok('overrides')]: Object.fromEntries(names.map((name) => [name, { ink: '$ink' }])) } });
  t.equal(overridden.status, 0, 'an overrides entry that points their ink peer at the root ink lets them install');
});

s.fact(F, ['All five render on Ink 8.'], { kind: 'R' }, async (t, q) => {
  t.equal(semver.major(extPkg('ink').version), Number(q.tok('8')), 'the Ink in use');
  t.equal(PACKAGES.length, 5);
  const { app: tabApp } = await tabs();
  t.equal(tabApp.screen(), '1. overview | 2. logs', 'ink-tab');
  const { h: eh, mount: emount, ink: eink } = await ext();
  const { Stepper, Step } = await lib('ink-stepper');
  const wizard = emount(eh(Stepper, { onComplete() {} }, eh(Step, { name: 'One' }, eh(eink.Text, null, 'body'))), { columns: 40 });
  await wizard.flush();
  t.equal(wizard.screen(), '●\nOne\n\nbody', 'ink-stepper');
  t.deepEqual(lines((await scrollView()).app), items(5), 'ink-scroll-view');
  t.deepEqual(lines((await scrollList({ selectedIndex: 0 })).app), items(5), 'ink-scroll-list');
  t.deepEqual(lines((await virtualList({ props: { height: 4 } })).app), ['', 'Item 0', 'Item 1', '  ▼ 998 more'], 'ink-virtual-list');
});

// ===================================================================== ink-tab

s.fact(F, ['Peer `^4 || ^5 || ^6`.'], { kind: 'P' }, async (t, q) => {
  const range = extPkg('ink-tab').peerDependencies.ink;
  t.ok(sameRange(q.tok('^4 || ^5 || ^6'), range), `the package declares ${range}`);
  t.ok(!semver.satisfies(extPkg('ink').version, range), 'which excludes the Ink in use');
});

s.fact(
  F,
  ['Its readme has no prop list: it links to [the ink-tab docs](https://jdeniau.gitbook.io/ink-tab/), and the installed package ships its docs pages under `docs/` (`docs/api/tabs.md` lists the `Tabs` props).'],
  { kind: 'P' },
  async (t, q) => {
    const readme = extReadFile('ink-tab', 'README.md');
    t.ok(readme.includes('(https://jdeniau.gitbook.io/ink-tab/)'), 'the readme links to the docs site');
    for (const prop of ['onChange', 'keyMap', 'isFocused', 'defaultValue', 'flexDirection', 'showIndex']) t.ok(!readme.includes(prop), `and says nothing about ${prop}`);
    const page = extReadFile('ink-tab', q.tok('docs/api/tabs.md'));
    t.ok(q.tok('docs/api/tabs.md').startsWith(q.tok('docs/')), 'docs/api/tabs.md is under docs/');
    t.match(page, new RegExp(`^# ${q.tok('Tabs')}$`, 'm'), 'it is the page for Tabs');
    for (const prop of ['children', 'onChange', 'colors', 'keyMap']) t.match(page, new RegExp(`^### \\*\\*${prop}\\*\\*$`, 'm'), `listing ${prop}`);
  },
);

s.fence(F, 0, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const logged = [];
    const log = console.log;
    console.log = (...args) => logged.push(args);
    try {
      const { apps } = await runFence(fence, { mountOptions: { columns: 60 } });
      await apps[0].flush();
      t.equal(apps[0].screen(), '1. Overview | 2. Logs', 'two tabs in a row');
      await apps[0].press(keys.right);
      t.deepEqual(logged, [['overview'], ['logs']], 'onChange logs the name once on mount and again on each switch');
    } finally {
      console.log = log;
    }
  },
});

s.fact(F, ['It renders a row like `1. Overview | 2. Logs`.'], { kind: 'R' }, async (t, q) => {
  const row = q.tok('1. Overview | 2. Logs');
  const { app } = await tabs({ label: (name) => name[0].toUpperCase() + name.slice(1) });
  t.equal(app.screen(), row, 'a numbered label, a bar between tabs');
  t.equal(app.screen().split('\n').length, 1, 'in a single row');
});

const ARROWS =
  'The Right and Left arrows (Down and Up when `flexDirection` is `"column"`) and Tab and Shift+Tab move to the next and previous tab, wrapping around at the ends; Alt with a digit (`1` to `9`) jumps to that tab, and a bare digit does nothing.';

s.fact(F, [ARROWS], { kind: 'R' }, async (t, q) => {
  const [first, last] = [Number(q.tok('1')), Number(q.tok('9'))];
  const names = Array.from({ length: last }, (_, i) => `t${i + 1}`);
  const row = await tabs({ names });
  t.equal(row.at(), 't1', 'onChange reports the first tab on mount');
  await row.app.press(keys.right);
  t.equal(row.at(), 't2', 'Right: the next tab');
  await row.app.press(keys.left);
  t.equal(row.at(), 't1', 'Left: the previous tab');
  await row.app.press(keys.left);
  t.equal(row.at(), 't9', 'Left on the first tab wraps to the last');
  await row.app.press(keys.right);
  t.equal(row.at(), 't1', 'Right on the last tab wraps to the first');
  await row.app.press(keys.tab);
  t.equal(row.at(), 't2', 'Tab: the next tab');
  await row.app.press(keys.shiftTab);
  t.equal(row.at(), 't1', 'Shift+Tab: the previous tab');
  const before = row.changes.length;
  await row.app.press(keys.down, keys.up);
  t.equal(row.changes.length, before, 'in a row, Down and Up do nothing');

  await row.app.press(keys.right, keys.right, keys.right);
  t.equal(row.at(), 't4');
  await row.app.press(`\x1b${first - 1}`);
  t.equal(row.at(), 't4', `Alt+${first - 1} is not a shortcut`);
  for (let digit = first; digit <= last; digit++) {
    await row.app.press(`\x1b${digit}`);
    t.equal(row.at(), `t${digit}`, `Alt+${digit} jumps to tab ${digit}`);
  }
  await row.app.press('\x1b5');
  const count = row.changes.length;
  await row.app.press(...Array.from({ length: last }, (_, i) => String(i + 1)));
  t.equal(row.changes.length, count, 'a bare digit does nothing');
  t.equal(row.at(), 't5');

  const [flexDirection, direction] = [q.tok('flexDirection'), q.tok('"column"').slice(1, -1)];
  const column = await tabs({ names: ['a', 'b', 'c'], props: { [flexDirection]: direction } });
  await column.app.press(keys.down);
  t.equal(column.at(), 'b', 'in a column, Down: the next tab');
  await column.app.press(keys.up);
  t.equal(column.at(), 'a', 'Up: the previous tab');
  await column.app.press(keys.up);
  t.equal(column.at(), 'c', 'wrapping around too');
  const moved = column.changes.length;
  await column.app.press(keys.right, keys.left);
  t.equal(column.changes.length, moved, 'and Right and Left do nothing');
  await column.app.press(keys.tab);
  t.equal(column.at(), 'a', 'while Tab still moves');
});

const KEYMAP =
  "`keyMap` changes this: `useNumbers: false` and `useTab: false` turn the digit and Tab shortcuts off, and `previous` and `next` (arrays of key names such as `['h']`) replace the arrows.";

s.fact(F, [KEYMAP], { kind: 'R' }, async (t, q) => {
  const keyMap = q.tok('keyMap');
  const [numbers, numbersValue] = q.tok('useNumbers: false').split(': ');
  const [tab, tabValue] = q.tok('useTab: false').split(': ');
  const [previous, next] = [q.tok('previous'), q.tok('next')];
  const [hKey] = JSON.parse(q.tok("['h']").replace(/'/g, '"'));
  const names = ['a', 'b', 'c'];

  const standard = await tabs({ names });
  await standard.app.press('\x1b3');
  t.equal(standard.at(), 'c', 'positive control: by default Alt+3 jumps ...');
  await standard.app.press(keys.tab);
  t.equal(standard.at(), 'a', '... and Tab moves');

  const noDigits = await tabs({ names, props: { [keyMap]: { [numbers]: JSON.parse(numbersValue) } } });
  await noDigits.app.press('\x1b3');
  t.equal(noDigits.at(), 'a', 'useNumbers: false: Alt+3 does nothing');
  await noDigits.app.press(keys.tab);
  t.equal(noDigits.at(), 'b', '... while Tab still works');

  const noTab = await tabs({ names, props: { [keyMap]: { [tab]: JSON.parse(tabValue) } } });
  await noTab.app.press(keys.tab);
  t.equal(noTab.at(), 'a', 'useTab: false: Tab does nothing');
  await noTab.app.press('\x1b3');
  t.equal(noTab.at(), 'c', '... while Alt+3 still works');
  await noTab.app.press(keys.right);
  t.equal(noTab.at(), 'a', '... and so does the arrow');

  const custom = await tabs({ names, props: { [keyMap]: { [previous]: [hKey], [next]: ['l'] } } });
  await custom.app.press('l');
  t.equal(custom.at(), 'b', `next: ['l'] moves forward on l`);
  await custom.app.press(hKey);
  t.equal(custom.at(), 'a', `previous: ['${hKey}'] moves back on ${hKey}`);
  const count = custom.changes.length;
  await custom.app.press(keys.right, keys.left);
  t.equal(custom.changes.length, count, 'and the arrows no longer do');
});

s.types(
  F,
  [KEYMAP, '`Tabs` also takes `flexDirection` and `width`.'],
  tsx`
import React from 'react';
import {Tab, Tabs} from 'ink-tab';
import type {TabsProps} from 'ink-tab';
import type {BoxProps} from 'ink';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const keyMapShape: Same<NonNullable<TabsProps['keyMap']>, {useNumbers?: boolean; useTab?: boolean; previous?: string[]; next?: string[]}> = true;
export const flexDirection: Same<TabsProps['flexDirection'], BoxProps['flexDirection']> = true;
export const width: Same<TabsProps['width'], BoxProps['width']> = true;

export const ok = (
	<Tabs onChange={() => {}} keyMap={{useNumbers: false, useTab: false, previous: ['h'], next: ['l']}} flexDirection="column" width={20}>
		<Tab name="a">A</Tab>
		<Tab name="b">B</Tab>
	</Tabs>
);
export const keyMapNames = <Tabs onChange={() => {}} keyMap={{useLetters: true}}><Tab name="a">A</Tab><Tab name="b">B</Tab></Tabs>; //! TS2353
export const previousIsAnArray = <Tabs onChange={() => {}} keyMap={{previous: 'h'}}><Tab name="a">A</Tab><Tab name="b">B</Tab></Tabs>; //! TS2322
`,
  { project: 'external', ctx: ['keyMap', 'useNumbers: false', 'useTab: false', 'previous', 'next', "['h']", 'Tabs', 'flexDirection', 'width'] },
);

s.fact(F, ['`Tabs` also takes `flexDirection` and `width`.'], { kind: 'R' }, async (t, q) => {
  const { Tabs } = await lib('ink-tab');
  t.equal(typeof q.api({ Tabs }, 'Tabs'), 'function');
  const [flexDirection, width] = [q.tok('flexDirection'), q.tok('width')];
  const row = await tabs({ names: ['one', 'two'] });
  t.equal(row.app.screen(), '1. one | 2. two', 'by default the tabs sit in one row');
  const column = await tabs({ names: ['one', 'two'], props: { [flexDirection]: 'column' } });
  t.deepEqual(lines(column.app), ['1. one', '──────', '2. two'], 'flexDirection="column" stacks them with a rule between');
  const narrow = await tabs({ names: ['overview', 'logs'], props: { [width]: 12 } });
  t.ok(lines(narrow.app).length > 1 && lines(narrow.app).every((line) => line.length <= 12), 'width limits the box, so the row wraps');
  const wide = await tabs({ names: ['overview', 'logs'] });
  t.equal(lines(wide.app).length, 1, 'positive control: without it the row fits on one line');
  const ruled = await tabs({ names: ['one', 'two'], props: { [flexDirection]: 'column', [width]: 9 } });
  t.equal(lines(ruled.app).find((line) => /^─+$/.test(line)), '─'.repeat(9), 'in a column, width is also the length of the rule');
});

s.fact(F, ["`onChange` fires once on mount with the first tab's `name`, then on each switch."], { kind: 'R' }, async (t, q) => {
  const [onChange, name] = [q.tok('onChange'), q.tok('name')];
  const { h, mount } = await ext();
  const { Tab, Tabs } = await lib('ink-tab');
  const calls = [];
  const app = mount(h(Tabs, { [onChange]: (...args) => calls.push(args) }, h(Tab, { key: 'a', [name]: 'overview' }, 'Overview'), h(Tab, { key: 'b', [name]: 'logs' }, 'Logs')), { columns: 60 });
  await app.flush();
  t.deepEqual(calls.map(([value]) => value), ['overview'], 'once on mount, with the first tab name');
  t.equal(calls[0].length, 2, 'next to the Tab element');
  await app.press(keys.right);
  t.deepEqual(calls.map(([value]) => value), ['overview', 'logs'], 'then once on each switch');
  await app.press(keys.tab);
  t.deepEqual(calls.map(([value]) => value), ['overview', 'logs', 'overview']);
});

s.fact(
  F,
  ['The `Tab` children are only the label — it does not render tab *contents*, so switch on the `name` from `onChange` yourself.'],
  { kind: 'R' },
  async (t, q) => {
    const { h, mount, ink: eink } = await ext();
    const lib_ = await lib('ink-tab');
    const [Tab, Tabs] = [q.api(lib_, 'Tab'), lib_.Tabs];
    const [name, onChange] = [q.tok('name'), q.tok('onChange')];
    const seen = [];
    const app = mount(h(Tabs, { [onChange]: (value) => seen.push(value) }, h(Tab, { key: 'a', [name]: 'a' }, h(eink.Text, null, 'AAA')), h(Tab, { key: 'b', [name]: 'b' }, 'BBB')), { columns: 60 });
    await app.flush();
    t.equal(app.screen(), '1. AAA | 2. BBB', 'whatever the children are, they are drawn as the tab label, all tabs at once');
    await app.press(keys.right);
    t.equal(app.screen(), '1. AAA | 2. BBB', 'switching tabs shows nothing else');
    t.deepEqual(seen, ['a', 'b'], 'the name is all that tells you which tab is active');
  },
);

s.types(
  F,
  ['`children` is typed as an array, so give it at least two `<Tab>` elements.'],
  tsx`
import React from 'react';
import {Tab, Tabs} from 'ink-tab';
import type {TabsProps, TabProps} from 'ink-tab';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const childrenIsAnArray: Same<TabsProps['children'], Array<React.ReactElement<typeof Tab>>> = true;
export const labels: Same<TabProps['children'], React.ReactNode> = true;

export const two = (
	<Tabs onChange={() => {}}>
		<Tab name="a">A</Tab>
		<Tab name="b">B</Tab>
	</Tabs>
);
export const mapped = <Tabs onChange={() => {}}>{['a', 'b'].map((name) => <Tab key={name} name={name}>{name}</Tab>)}</Tabs>;
export const one = <Tabs onChange={() => {}}><Tab name="a">A</Tab></Tabs>; //! TS2745
`,
  { project: 'external', ctx: ['children', '<Tab>'] },
);

s.fact(F, ['`children` is typed as an array, so give it at least two `<Tab>` elements.'], { kind: 'R' }, async (t, q) => {
  const { h, catchRenderError } = await ext();
  const lib_ = await lib('ink-tab');
  const Tab = q.el(lib_, '<Tab>');
  const children = q.tok('children');
  const tab = (name) => h(Tab, { key: name, name }, name);
  t.equal(catchRenderError(h(lib_.Tabs, { onChange() {} }, tab('a'), tab('b'))), null, 'two <Tab> children render');
  const one = catchRenderError(h(lib_.Tabs, { onChange() {}, [children]: tab('a') }));
  t.match(String(one?.message), /children\.map is not a function/, 'a single one is not an array: render throws');
  t.equal(catchRenderError(h(lib_.Tabs, { onChange() {}, [children]: [tab('a')] })), null, 'while an array of one works');
});

// ===================================================================== ink-stepper

s.fact(F, ['Peer `^6.6.0 || ^7.0.0`.'], { kind: 'P' }, async (t, q) => {
  const range = extPkg('ink-stepper').peerDependencies.ink;
  t.ok(sameRange(q.tok('^6.6.0 || ^7.0.0'), range), `the package declares ${range}`);
  t.ok(!semver.satisfies(extPkg('ink').version, range), 'which excludes the Ink in use');
  t.ok(semver.satisfies('6.6.0', range) && !semver.satisfies('6.5.9', range), 'and starts at 6.6.0');
});

s.fence(F, 1, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const exits = [];
    const exit = process.exit;
    process.exit = (code) => exits.push(code);
    try {
      const { apps } = await runFence(fence, { mountOptions: { columns: 60, rows: 12 } });
      const app = apps[0];
      await app.flush();
      t.match(app.screen(), /^●━+○\nTheme\s+Directory\n\nPick a theme$/, 'a progress bar with the step names, then the first step');
      await app.press(keys.enter);
      t.match(app.screen(), /Directory\n\nc to confirm, b to go back$/, 'Enter moves to the second step');
      await app.press('b');
      t.match(app.screen(), /Pick a theme$/, 'its goBack returns to the first');
      await app.press(keys.enter, 'c');
      await waitFor(() => exits.length > 0, { message: 'onComplete' });
      t.deepEqual(exits, [0], 'confirming the last step (its canProceed is async) calls onComplete');
      const second = await runFence(fence, { mountOptions: { columns: 60, rows: 12 } });
      await second.apps[0].press(keys.esc);
      t.deepEqual(exits, [0, 1], 'Escape on the first step calls onCancel');
    } finally {
      process.exit = exit;
    }
  },
});

const WIZARD_KEYS = 'By default Enter advances and Escape goes back (on the first step it calls `onCancel`); `keyboardNav={false}` turns both off.';

/** Mount a `<Stepper>`: `steps` is [{name, props, render}]; `events` records the default onComplete / onCancel. */
const wizard = async (steps, props = {}, { columns = 60 } = {}) => {
  const { h, mount, ink: eink } = await ext();
  const { Stepper, Step } = await lib('ink-stepper');
  const events = [];
  const record = (name) => (...args) => (events.push([name, ...args]), undefined);
  const element = (extra = {}) =>
    h(
      Stepper,
      { onComplete: record('complete'), onCancel: record('cancel'), ...props, ...extra },
      ...steps.map(({ name, props: stepProps, render }) => h(Step, { key: name, name, ...stepProps }, render ?? h(eink.Text, null, `${name} body`))),
    );
  const app = mount(element(), { columns });
  await app.flush();
  return { app, events, element, body: () => lines(app).at(-1) };
};
const ONE_TWO = [{ name: 'One' }, { name: 'Two' }];

s.fact(F, [WIZARD_KEYS], { kind: 'D' }, async (t, q) => {
  const onCancel = q.tok('onCancel');
  const [keyboardNav, off] = q.tok('keyboardNav={false}').match(/^(\w+)=\{(.+)\}$/).slice(1);
  const cancelled = [];
  const normal = await wizard(ONE_TWO, { [onCancel]: () => cancelled.push('cancel') });
  t.equal(normal.body(), 'One body');
  await normal.app.press(keys.enter);
  t.equal(normal.body(), 'Two body', 'Enter advances');
  await normal.app.press(keys.esc);
  t.equal(normal.body(), 'One body', 'Escape goes back');
  t.deepEqual(cancelled, [], 'without calling onCancel');
  await normal.app.press(keys.esc);
  t.deepEqual(cancelled, ['cancel'], 'on the first step Escape calls onCancel');
  const stayed = [];
  const disabled = await wizard(ONE_TWO, { [onCancel]: () => stayed.push('cancel'), [keyboardNav]: JSON.parse(off) });
  await disabled.app.press(keys.enter);
  t.equal(disabled.body(), 'One body', 'keyboardNav={false}: Enter does nothing ...');
  await disabled.app.press(keys.esc);
  t.deepEqual(stayed, [], '... and neither does Escape');
});

const STEP_SENTENCE =
  'Each `<Step>` can be a plain child or a render-prop function receiving navigation controls (`goNext`, `goBack`, and a raw `goTo` that skips `canProceed`); `canProceed` is a boolean or a (possibly async) function that gates advancing past a step.';

s.fact(F, [STEP_SENTENCE], { kind: 'R', ctx: [] }, async (t, q) => {
  const { h, ink: eink } = await ext();
  const lib_ = await lib('ink-stepper');
  const Step = q.el(lib_, '<Step>');
  t.equal(typeof Step, 'function');
  const [goNext, goBack, goTo, canProceed] = [q.tok('goNext'), q.tok('goBack'), q.tok('goTo'), q.tok('canProceed')];
  const contexts = [];
  const controls = (index) => (context) => (contexts[index] = context, h(eink.Text, null, `step ${index}`));
  const gated = await wizard(
    [{ name: 'Plain' }, { name: 'Gated', props: { [canProceed]: false }, render: controls(1) }, { name: 'Last', render: controls(2) }],
    {},
  );
  t.equal(gated.body(), 'Plain body', 'a plain child is drawn as it is');
  await gated.app.press(keys.enter);
  t.equal(gated.body(), 'step 1', 'a render-prop function is called with the controls and draws its result');
  t.deepEqual([goNext, goBack, goTo].map((name) => typeof contexts[1][name]), ['function', 'function', 'function'], 'it receives navigation functions: goNext, goBack and goTo');
  contexts[1][goNext]();
  await gated.app.flush();
  t.equal(gated.body(), 'step 1', 'goNext respects canProceed={false}');
  await gated.app.press(keys.enter);
  t.equal(gated.body(), 'step 1', 'and so does Enter');
  contexts[1][goTo](2);
  await gated.app.flush();
  t.equal(gated.body(), 'step 2', 'goTo is a raw jump: it skips canProceed');
  contexts[2][goBack]();
  await gated.app.flush();
  t.equal(gated.body(), 'step 1', 'goBack returns to the previous step');

  // canProceed: a boolean, or a function that may be async
  const advances = async (value) => {
    const run = await wizard([{ name: 'A', props: { [canProceed]: value } }, { name: 'B' }]);
    await run.app.press(keys.enter);
    for (let i = 0; i < 5; i++) await run.app.flush();
    return run.body() === 'B body';
  };
  const cases = [
    ['true', true, true],
    ['false', false, false],
    ['() => true', () => true, true],
    ['() => false', () => false, false],
    ['async () => true', async () => true, true],
    ['async () => false', async () => false, false],
  ];
  for (const [label, value, expected] of cases) t.equal(await advances(value), expected, `canProceed ${label}: ${expected ? 'advances' : 'stays'}`);
  t.equal(await advances(undefined), true, 'and by default a step can be left');
});

s.types(
  F,
  [STEP_SENTENCE],
  tsx`
import React from 'react';
import {Text} from 'ink';
import {Step} from 'ink-stepper';
import type {StepContext, StepProps} from 'ink-stepper';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const controls: Same<keyof StepContext, 'goNext' | 'goBack' | 'goTo' | 'cancel' | 'currentStep' | 'totalSteps' | 'isFirst' | 'isLast' | 'isValidating'> = true;
export const canProceedType: Same<StepProps['canProceed'], boolean | (() => boolean | Promise<boolean>) | undefined> = true;
export const goToTakesAnIndex: Same<StepContext['goTo'], (step: number) => void> = true;

export const plain = <Step name="a"><Text>x</Text></Step>;
export const renderProp = <Step name="a" canProceed={async () => true}>{({goNext, goBack, goTo}) => { goNext(); goBack(); goTo(0); return <Text>x</Text>; }}</Step>;
export const flag = <Step name="a" canProceed={false}><Text>x</Text></Step>;
export const badGate = <Step name="a" canProceed="yes"><Text>x</Text></Step>; //! TS2322
export const noName = <Step><Text>x</Text></Step>; //! TS2741
`,
  { project: 'external', ctx: ['<Step>', 'goNext', 'goBack', 'goTo', 'canProceed'] },
);

const STEPPER_SENTENCE = '`Stepper` also takes `onStepChange`, `onEnterStep`, `onExitStep` (return `false` to cancel the move), `onError`, and `step` for a controlled wizard.';

s.fact(F, [STEPPER_SENTENCE], { kind: 'R' }, async (t, q) => {
  const lib_ = await lib('ink-stepper');
  t.equal(typeof q.api(lib_, 'Stepper'), 'function');
  const [onStepChange, onEnterStep, onExitStep, onError, step] = ['onStepChange', 'onEnterStep', 'onExitStep', 'onError', 'step'].map((name) => q.tok(name));
  const refuse = JSON.parse(q.tok('false'));

  const calls = [];
  const lifecycle = await wizard(ONE_TWO, {
    [onExitStep]: (index) => (calls.push(['exit', index]), true),
    [onStepChange]: (index) => calls.push(['change', index]),
    [onEnterStep]: (index) => calls.push(['enter', index]),
  });
  await lifecycle.app.press(keys.enter);
  t.deepEqual(calls, [['exit', 0], ['change', 1], ['enter', 1]], 'leaving step 0 reports exit, change and enter, in that order, with step indexes');
  t.equal(lifecycle.body(), 'Two body');

  const blocked = [];
  const cancelling = await wizard(ONE_TWO, { [onExitStep]: (index) => (blocked.push(['exit', index]), refuse), [onStepChange]: (index) => blocked.push(['change', index]) });
  await cancelling.app.press(keys.enter);
  t.deepEqual(blocked, [['exit', 0]], 'onExitStep returning false: the move is cancelled, no change is reported');
  t.equal(cancelling.body(), 'One body', 'and the wizard stays');

  const errors = [];
  const failure = new Error('validation failed');
  const failing = await wizard([{ name: 'A', props: { canProceed: async () => { throw failure; } } }, { name: 'B' }], { [onError]: (error) => errors.push(error) });
  await failing.app.press(keys.enter);
  await waitFor(() => errors.length > 0, { message: 'onError' });
  t.equal(errors[0], failure, 'onError receives what an async canProceed threw');
  t.equal(failing.body(), 'A body', 'and the wizard stays on the step');

  const reported = [];
  const controlled = await wizard([{ name: 'One' }, { name: 'Two' }, { name: 'Three' }], { [step]: 1, [onStepChange]: (index) => reported.push(index) });
  t.equal(controlled.body(), 'Two body', 'step picks the step shown');
  await controlled.app.press(keys.enter);
  t.deepEqual(reported, [2], 'navigating only reports the requested step');
  t.equal(controlled.body(), 'Two body', 'it does not move until you update step');
  await controlled.app.rerender(controlled.element({ [step]: 2 }));
  t.equal(controlled.body(), 'Three body', 'then it does');
});

s.types(
  F,
  [STEPPER_SENTENCE],
  tsx`
import React from 'react';
import {Text} from 'ink';
import {Stepper, Step} from 'ink-stepper';
import type {StepperProps} from 'ink-stepper';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const onExitStepType: Same<StepperProps['onExitStep'], ((step: number) => void | boolean | Promise<void | boolean>) | undefined> = true;
export const onErrorType: Same<StepperProps['onError'], ((error: unknown) => void) | undefined> = true;
export const stepType: Same<StepperProps['step'], number | undefined> = true;

export const all = (
	<Stepper onComplete={() => {}} onStepChange={(next) => next.toFixed()} onEnterStep={(next) => next.toFixed()} onExitStep={(from) => (from > 0 ? false : undefined)} onError={(error) => String(error)} step={0}>
		<Step name="a"><Text>x</Text></Step>
	</Stepper>
);
export const needsOnComplete = <Stepper><Step name="a"><Text>x</Text></Step></Stepper>; //! TS2741
export const stepIsANumber = <Stepper onComplete={() => {}} step="1"><Step name="a"><Text>x</Text></Step></Stepper>; //! TS2322
`,
  { project: 'external', ctx: ['Stepper', 'onStepChange', 'onEnterStep', 'onExitStep', 'false', 'onError', 'step'] },
);

s.fact(
  F,
  ['For a *linear* wizard without named steps, back-navigation, or async validation gates'],
  { kind: 'R' },
  async (t) => {
    const named = await wizard(ONE_TWO);
    t.match(named.app.screen(), /^●━+○\nOne\s+Two\n/, 'Stepper shows the name of each step in its progress bar');
    await named.app.press(keys.enter);
    await named.app.press(keys.esc);
    t.equal(named.body(), 'One body', 'Escape navigates back');
    let validated = 0;
    const gated = await wizard([{ name: 'A', props: { canProceed: async () => (validated++, false) } }, { name: 'B' }]);
    await gated.app.press(keys.enter);
    await waitFor(() => validated > 0, { message: 'validation' });
    t.equal(gated.body(), 'A body', 'and an async canProceed gates the step');
  },
);

s.guidance(
  F,
  ['plain `useState` tracking a step index is simpler — see `ink-app-architecture`.'],
  'a recommendation about when not to reach for a package; what Stepper adds over a bare index is shown by the claim on the clause before it',
  { exempt: ['useState'] },
);

// ===================================================================== scrolling natively

const ROWS = 20;

s.fact(
  F,
  ['Ink 8 scrolls natively: put the content in a fixed-height `<Box overflow="hidden">`, wrap it in a `flexShrink={0}` content box, and shift the content with `contentOffsetY`.'],
  { kind: 'R' },
  async (t, q) => {
    t.equal(semver.major(pkg('ink').version), Number(q.tok('8')), 'the Ink in use');
    const [, overflow] = q.tok('<Box overflow="hidden">').match(/^<Box overflow="(\w+)">$/);
    const [, shrink] = q.tok('flexShrink={0}').match(/^flexShrink=\{(\d+)\}$/);
    const offset = q.tok('contentOffsetY');
    const rows = items(ROWS);
    const view = ({ top = 0, clip = overflow, keep = Number(shrink), header = false } = {}) =>
      stripAnsi(ink.renderToString(h(ink.Box, { flexDirection: 'column' }, header ? h(ink.Text, null, 'HEADER') : null, h(ink.Box, { height: 5, flexDirection: 'column', overflow: clip, [offset]: top }, h(ink.Box, { flexDirection: 'column', flexShrink: keep }, ...rows.map((text) => h(ink.Text, { key: text }, text))))))).split('\n');
    t.deepEqual(view(), items(5), 'a fixed-height viewport shows the first rows');
    t.deepEqual(view({ top: 3 }), rows.slice(3, 8), 'contentOffsetY shifts the content up, row for row');
    t.deepEqual(view({ top: ROWS - 5 }), rows.slice(-5), 'until the last row is at the bottom');
    t.equal(view({ top: 3, header: true })[0], 'HEADER', 'the rows scrolled out of the top are clipped, so what is above the viewport is untouched');
    t.notEqual(view({ top: 3, header: true, clip: 'visible' })[0], 'HEADER', 'positive control: without overflow="hidden" they are drawn over it');
    t.notDeepEqual(view({ keep: 1, top: 3 }), rows.slice(3, 8), 'positive control: with the default flexShrink the content is squeezed to the viewport and the rows no longer line up');
  },
);

s.fact(
  F,
  ['Measure both boxes with `useBoxMetrics` and clamp the offset to `content.height - viewport.clientHeight`.'],
  { kind: 'R' },
  async (t, q) => {
    const useMetrics = q.api(ink, 'useBoxMetrics');
    const [contentHeight, clientHeight] = q.tok('content.height - viewport.clientHeight').split(' - ').map((part) => part.split('.')[1]);
    const rows = items(ROWS);
    let seen;
    const View = ({ requested }) => {
      const viewportRef = React.useRef(null);
      const contentRef = React.useRef(null);
      const viewport = useMetrics(viewportRef);
      const content = useMetrics(contentRef);
      const max = Math.max(0, content[contentHeight] - viewport[clientHeight]);
      const top = Math.min(requested, max);
      seen = { max, top };
      return h(ink.Box, { ref: viewportRef, height: 5, flexDirection: 'column', overflow: 'hidden', contentOffsetY: top }, h(ink.Box, { ref: contentRef, flexDirection: 'column', flexShrink: 0 }, ...rows.map((text) => h(ink.Text, { key: text }, text))));
    };
    const app = mount(h(View, { requested: 99 }), { columns: 40, rows: 24 });
    await app.flush();
    await app.flush();
    t.equal(seen.max, ROWS - 5, 'content.height - viewport.clientHeight is how far there is to scroll');
    t.deepEqual(lines(app), rows.slice(-5), 'clamped to it, the last rows fill the viewport however far you ask to scroll');
    const unclamped = mount(h(ink.Box, { height: 5, flexDirection: 'column', overflow: 'hidden', contentOffsetY: 99 }, h(ink.Box, { flexDirection: 'column', flexShrink: 0 }, ...rows.map((text) => h(ink.Text, { key: text }, text)))), { columns: 40, rows: 24 });
    await unclamped.flush();
    t.equal(unclamped.screen().trim(), '', 'positive control: unclamped, the same request scrolls everything out of view');
  },
);

s.fact(F, ['That needs no dependency, handles variable item heights'], { kind: 'R' }, async (t) => {
  const reference = skill('ink-layout');
  const code = reference.fenceOf('references/scrollable-view.md', 0).code;
  t.deepEqual([...code.matchAll(/from '([^']+)'/g)].map((m) => m[1]), ['react', 'ink'], 'the full component in ink-layout imports React and Ink and nothing else');
  const { mod } = await reference.runFence('references/scrollable-view.md', 0);
  t.equal(typeof mod.ScrollView, 'function');
  const variable = [['a'], ['b', 'b2', 'b3'], ['c', 'c2'], ['d']].map((rowsOfItem) => rowsOfItem.join('\n'));
  const App = () => h(mod.ScrollView, { height: 4 }, ...variable.map((text) => h(ink.Text, { key: text }, text)));
  const app = mount(h(App), { columns: 20, rows: 24 });
  await app.flush();
  await app.flush();
  t.deepEqual(lines(app), ['a', 'b', 'b2', 'b3'], 'items of different heights fill the viewport row by row');
  await app.press(keys.down, keys.down, keys.down, keys.down, keys.down, keys.down, keys.down);
  t.deepEqual(lines(app), ['b3', 'c', 'c2', 'd'], 'and the last one ends at the bottom: the scroll range is the sum of their heights');
});

s.guidance(F, ['and is the right default for a log or document view.'], 'a recommendation about which approach to start with; no test can decide it');

s.fact(F, ['`ink-layout` has the full component (`references/scrollable-view.md`).'], { kind: 'R' }, async (t, q) => {
  const reference = skill(q.tok('ink-layout'));
  const fence = reference.fenceOf(q.tok('references/scrollable-view.md'), 0);
  t.ok(['contentOffsetY', 'useBoxMetrics', 'overflow="hidden"', 'flexShrink={0}'].every((token) => fence.code.includes(token)), 'the reference holds the recipe described above');
  const { mod, apps } = await reference.runFence(q.tok('references/scrollable-view.md'), 0, { mountOptions: { columns: 30, rows: 24 } });
  await apps[0].flush();
  t.equal(typeof mod.ScrollView, 'function', 'as a component');
  t.equal(apps[0].screen().split('\n')[0], 'Row 1', 'which draws');
});

s.guidance(
  F,
  ['Reach for a package when you want selection, scroll-into-view or true virtualization on top of that:'],
  'introduces the table below; each capability it names is demonstrated by the claim on its own row',
);

// ===================================================================== the packages table

s.fact(
  F,
  ["| `ink-scroll-view` | `^7` | A generic scrollable viewport — auto-measures children, handles resize/dynamic content. You still own selection state. | You need to scroll arbitrary, non-list content (a long log or document view) and don't want to write the offset clamping yourself. |"],
  { kind: 'R' },
  async (t, q) => {
    const name = q.tok('ink-scroll-view');
    const range = extPkg(name).peerDependencies.ink;
    t.ok(sameRange(q.tok('^7'), range), `peer ${range}`);
    t.ok(!semver.satisfies(extPkg('ink').version, range));
    const { h: eh, mount: emount, ink: eink } = await ext();
    const { ScrollView } = await lib(name);
    const text = (value) => eh(eink.Text, { key: value }, value);
    const heights = [['a'], ['b', 'b2', 'b3'], ['c', 'c2'], ['d']].map((rowsOfItem) => rowsOfItem.join('\n'));

    const { app, ref } = await scrollView({ height: 4, children: heights.map(text) });
    t.deepEqual([0, 1, 2, 3].map((i) => ref.current.getItemHeight(i)), [1, 3, 2, 1], 'it measures its children itself, whatever their height');
    t.equal(ref.current.getContentHeight(), 7);
    t.equal(ref.current.getViewportHeight(), 4);
    t.equal(ref.current.getBottomOffset(), 3, 'so it knows how far there is to scroll');
    ref.current.scrollBy(2);
    await app.flush();
    t.deepEqual(lines(app), ['b2', 'b3', 'c', 'c2'], 'and scrolls by rows');

    const changes = [];
    const make = (list) => eh(eink.Box, { height: 4, flexDirection: 'column' }, eh(ScrollView, { onContentHeightChange: (height) => changes.push(height) }, ...list.map(text)));
    const dynamic = emount(make(heights), { columns: 40, rows: 24 });
    await dynamic.flush();
    await dynamic.rerender(make([...heights, 'e', 'f']));
    t.deepEqual(changes, [7, 9], 'dynamic content: it notices children being added (content height 7, then 9)');

    const wrapped = await scrollView({ height: 6, children: [text('word '.repeat(10).trim())] });
    const wide = wrapped.ref.current.getContentHeight();
    await wrapped.app.resize(20, 24);
    t.ok(wrapped.ref.current.getContentHeight() > wide, `resize: after the terminal narrows the text wraps to more rows (${wide}, then ${wrapped.ref.current.getContentHeight()}) and it measures them again without being asked`);
  },
);

s.types(
  F,
  ["| `ink-scroll-view` | `^7` | A generic scrollable viewport — auto-measures children, handles resize/dynamic content. You still own selection state. | You need to scroll arbitrary, non-list content (a long log or document view) and don't want to write the offset clamping yourself. |"],
  tsx`
import React from 'react';
import {Text} from 'ink';
import {ScrollView} from 'ink-scroll-view';
import type {ScrollViewProps} from 'ink-scroll-view';

export const plain = <ScrollView><Text key="a">a</Text></ScrollView>;
export const asABox = <ScrollView height={4} flexDirection="column"><Text key="a">a</Text></ScrollView>;
export const noSelection = <ScrollView selectedIndex={1}><Text key="a">a</Text></ScrollView>; //! TS2322
export const props: 'selectedIndex' extends keyof ScrollViewProps ? true : false = false;
`,
  { project: 'external', ctx: ['ink-scroll-view', '^7'] },
);

s.guidance(
  F,
  ["You need to scroll arbitrary, non-list content (a long log or document view) and don't want to write the offset clamping yourself."],
  'says when to pick the package over the native recipe; the clamping it saves is the recipe described above the table',
);

s.fact(
  F,
  ['| `ink-scroll-list` | `^7` | Built on `ink-scroll-view` — a **controlled** selectable list (`selectedIndex` prop you own) with auto-scroll-to-selection and alignment modes (`scrollAlignment`: `auto`/`top`/`bottom`/`center`) and an imperative ref API. |'],
  { kind: 'R', ctx: ['controlled'] },
  async (t, q) => {
    const name = q.tok('ink-scroll-list');
    const meta = extPkg(name);
    t.ok(sameRange(q.tok('^7'), meta.peerDependencies.ink), `peer ${meta.peerDependencies.ink}`);
    t.ok(meta.dependencies[q.tok('ink-scroll-view')], 'built on ink-scroll-view: it depends on it');
    const selectedProp = q.tok('selectedIndex');
    const alignmentProp = q.tok('scrollAlignment');

    const { ref } = await scrollList({ selectedIndex: 0, selectedProp });
    for (const method of ['scrollBy', 'scrollTo', 'getContentHeight', 'getViewportHeight', 'getItemHeight']) t.equal(typeof ref.current[method], 'function', `its ref has ink-scroll-view's ${method}`);
    t.ok(['scrollToTop', 'scrollToBottom', 'getBottomOffset', 'remeasure', 'remeasureItem'].every((method) => typeof ref.current[method] === 'function'), 'an imperative ref API');

    const view = await scrollList({ selectedIndex: 0, selectedProp });
    t.equal(lines(view.app)[0], 'Item 0');
    await view.select(10);
    t.equal(lines(view.app).at(-1), 'Item 10', 'a new selectedIndex scrolls the list so the item is in view');
    await view.select(2);
    t.equal(lines(view.app)[0], 'Item 2', 'in either direction');

    const [auto, top, bottom, center] = ['auto', 'top', 'bottom', 'center'].map((mode) => q.tok(mode));
    const declared = extReadFile(name, 'dist/index.d.ts').match(/type ScrollAlignment = ([^;]+);/)[1];
    t.deepEqual(declared.split(' | ').map((member) => member.slice(1, -1)).sort(), [auto, top, bottom, center].sort(), 'these are the four alignment modes the package declares');
    const shown = async (mode, [from, to]) => {
      const list = await scrollList({ selectedIndex: from, selectedProp, extra: mode ? { [alignmentProp]: mode } : {} });
      await list.select(to);
      return lines(list.app);
    };
    const [down, up] = [[0, 10], [18, 16]];
    const row = async (mode, move) => (await shown(mode, move)).indexOf(`Item ${move[1]}`);
    t.equal(await row(top, down), 0, 'top puts the selected item in the first row');
    t.equal(await row(bottom, down), 4, 'bottom in the last row');
    t.equal(await row(center, down), 2, 'center in the middle');
    t.equal(await row(auto, down), 4, 'auto scrolls just far enough: moving down, the item ends up at the bottom ...');
    t.equal(await row(auto, up), 2, '... and an item that is already in view does not move the list');
    t.equal(await row(bottom, up), 4, 'whereas bottom aligns it again');
    t.equal(await row(center, up), 2, 'and center too');
    t.deepEqual(await shown(undefined, down), await shown(auto, down), 'auto is the default');
  },
);

s.fact(
  F,
  ['**controlled** selectable list (`selectedIndex` prop you own)'],
  { kind: 'R', ctx: ['controlled'] },
  async (t, q) => {
    const prop = q.tok('selectedIndex');
    const { app, ref } = await scrollList({ selectedIndex: 3, selectedProp: prop });
    t.equal(lines(app)[0], 'Item 0', 'an item inside the first screenful: nothing to scroll');
    const before = app.screen();
    await app.press(keys.down, keys.down, keys.up, keys.right, keys.tab, keys.enter, keys.pageDown, 'j');
    t.equal(app.screen(), before, 'no key moves the selection: the list does not read input');
    t.equal(typeof ref.current.select, 'undefined', 'and it has no methods that change it');
    const { h, mount, ink: eink } = await ext();
    const { ScrollList } = await lib('ink-scroll-list');
    const dropped = mount(h(eink.Box, { height: 5, flexDirection: 'column' }, h(ScrollList, { [prop]: 12 }, ...items(20).map((text) => h(eink.Text, { key: text }, text)))), { columns: 40, rows: 24 });
    await dropped.flush();
    t.equal(lines(dropped).at(-1), 'Item 12', 'the prop alone decides which item is selected');
  },
);

s.types(
  F,
  ['| `ink-scroll-list` | `^7` | Built on `ink-scroll-view` — a **controlled** selectable list (`selectedIndex` prop you own) with auto-scroll-to-selection and alignment modes (`scrollAlignment`: `auto`/`top`/`bottom`/`center`) and an imperative ref API. |'],
  tsx`
import React from 'react';
import {Text} from 'ink';
import {ScrollList} from 'ink-scroll-list';
import type {ScrollListProps, ScrollListRef, ScrollAlignment} from 'ink-scroll-list';
import type {ScrollViewProps, ScrollViewRef} from 'ink-scroll-view';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const alignments: Same<ScrollAlignment, 'auto' | 'top' | 'bottom' | 'center'> = true;
export const alignmentProp: Same<ScrollListProps['scrollAlignment'], ScrollAlignment | undefined> = true;
export const selectedIndexProp: Same<ScrollListProps['selectedIndex'], number | undefined> = true;
export const builtOnScrollView: ScrollListProps extends ScrollViewProps ? true : false = true;
export const refIsAScrollViewRef: ScrollListRef extends ScrollViewRef ? true : false = true;

export const ok = <ScrollList selectedIndex={2} scrollAlignment="center" height={5} onScroll={(offset) => offset.toFixed()}><Text key="a">a</Text></ScrollList>;
export const badAlignment = <ScrollList selectedIndex={0} scrollAlignment="middle"><Text key="a">a</Text></ScrollList>; //! TS2322
export const noCallback = <ScrollList selectedIndex={0} onSelectionChange={() => {}}><Text key="a">a</Text></ScrollList>; //! TS2322
`,
  { project: 'external', ctx: ['ink-scroll-list', '^7', 'ink-scroll-view', 'controlled', 'selectedIndex', 'scrollAlignment', 'auto', 'top', 'bottom', 'center'] },
);

s.guidance(
  F,
  ['You need a scrollable, keyboard-navigable list and want scroll-into-view handled automatically.'],
  'says when to pick the package; the automatic scroll-into-view is shown by the claim on the same row',
);

s.fact(
  F,
  ['| `ink-virtual-list` | `^6 || ^7` | Renders only the items visible in the viewport (true virtualization, not just scroll-clipping), with "N more" overflow indicators and an imperative ref (`scrollToIndex`, which keeps the selected item in view). |'],
  { kind: 'R' },
  async (t, q) => {
    const name = q.tok('ink-virtual-list');
    const range = extPkg(name).peerDependencies.ink;
    t.ok(sameRange(q.tok('^6 || ^7'), range), `peer ${range}`);
    t.ok(!semver.satisfies(extPkg('ink').version, range));

    const { h, ink: eink } = await ext();
    const rendered = new Set();
    const { app } = await virtualList({ render: ({ item, index }) => (rendered.add(index), h(eink.Text, null, item)), props: { height: 10 } });
    t.ok(rendered.size <= 10 && rendered.has(0), `of 1000 items, renderItem was called for ${rendered.size}: only the visible ones`);
    t.deepEqual(lines(app).filter((line) => /^Item \d+$/.test(line)).length, 8, 'eight rows of items fit; the other two lines of the height are the indicators');
    const view = await scrollView({ count: 1000, height: 10 });
    t.equal(view.ref.current.getContentHeight(), 1000, 'positive control: ink-scroll-view lays out and measures all 1000 children and clips the rest');

    const indicator = new RegExp(q.tok('N more').replace('N', '\\d+'));
    t.match(lines(app).at(-1), indicator, 'below the window an indicator counts the items that are not shown');
    t.match(lines(app).at(-1), /^ {2}▼ 992 more$/, '(1000 items, 8 shown)');
    t.equal(lines(app)[0], '', 'with nothing above there is no indicator');
    const method = q.tok('scrollToIndex');
    const { app: scrolled, ref } = await virtualList({ props: { height: 10, selectedIndex: 7 } });
    t.deepEqual(lines(scrolled).slice(1, 9), items(8), 'the window starts at the first item, with item 7 selected at its bottom');
    ref.current[method](1, 'top');
    await scrolled.flush();
    t.equal(lines(scrolled)[1], 'Item 1', `${method} moves the window: the item it is given is now at the top ...`);
    t.match(lines(scrolled)[0], /^ {2}▲ 1 more$/, '... and the items above it are counted');
    ref.current[method](500, 'top');
    await scrolled.flush();
    await scrolled.flush();
    t.ok(!lines(scrolled).includes('Item 500'), 'it cannot take the selected item out of view: asked for item 500 ...');
    t.equal(lines(scrolled)[1], 'Item 7', '... the window stops with item 7, the selected one, at its top');
    t.equal(ref.current.getViewport().offset, 7);
  },
);

s.guidance(
  F,
  ['The list can be very long (hundreds+ items) and per-item render cost matters, not just visual scrolling.'],
  'says when to pick the package over the others; what counts as long or costly depends on the app, so no test can decide it',
);

s.types(
  F,
  ['| `ink-virtual-list` | `^6 || ^7` | Renders only the items visible in the viewport (true virtualization, not just scroll-clipping), with "N more" overflow indicators and an imperative ref (`scrollToIndex`, which keeps the selected item in view). |'],
  tsx`
import React from 'react';
import {Text} from 'ink';
import {VirtualList} from 'ink-virtual-list';
import type {VirtualListRef} from 'ink-virtual-list';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const scrollToIndex: Same<VirtualListRef['scrollToIndex'], (index: number, alignment?: 'auto' | 'top' | 'center' | 'bottom') => void> = true;
const ref = React.createRef<VirtualListRef>();
export const call = () => ref.current?.scrollToIndex(3);
export const ok = <VirtualList ref={ref} items={['a']} renderItem={({item}) => <Text>{item}</Text>} />;
`,
  { project: 'external', ctx: ['ink-virtual-list', '^6 || ^7', 'N more', 'scrollToIndex'] },
);

// ===================================================================== wiring input

const ARROWS_SENTENCE =
  '`ink-scroll-view`, `ink-scroll-list` and `ink-virtual-list` do not move on the arrow keys by themselves: you own the selection state (for `ink-scroll-view`, the scroll offset) and drive it from `useInput`.';

s.fact(F, [ARROWS_SENTENCE], { kind: 'R' }, async (t, q) => {
  const [view, list, virtual] = [q.tok('ink-scroll-view'), q.tok('ink-scroll-list'), q.tok('ink-virtual-list')];
  const useInputName = q.tok('useInput');
  const battery = [keys.up, keys.down, keys.left, keys.right, keys.pageDown, keys.pageUp, keys.home, keys.end, keys.tab, keys.enter, ' ', 'j', 'k'];
  const untouched = {
    [view]: (await scrollView()).app,
    [list]: (await scrollList({ selectedIndex: 0 })).app,
    [virtual]: (await virtualList({ count: 100, props: { height: 6 } })).app,
  };
  for (const [name, app] of Object.entries(untouched)) {
    const before = app.screen();
    await app.press(...battery);
    t.equal(app.screen(), before, `${name}: none of ${battery.length} keys moves it`);
  }

  // positive control: the same keys, handled by useInput in the parent, do move each of them
  const { h: eh, mount: emount, ink: eink, React: ereact } = await ext();
  const useInput = eink[useInputName];
  const { ScrollView } = await lib(view);
  const { ScrollList } = await lib(list);
  const { VirtualList } = await lib(virtual);
  const rows = items(20);
  const Wired = ({ kind }) => {
    const ref = ereact.useRef(null);
    const [selected, setSelected] = ereact.useState(0);
    useInput((_input, key) => {
      const delta = key.downArrow ? 1 : key.upArrow ? -1 : 0;
      if (kind === view) ref.current?.scrollBy(delta);
      else setSelected((i) => Math.max(0, Math.min(rows.length - 1, i + delta)));
    });
    if (kind === virtual) return eh(VirtualList, { items: rows, height: 6, selectedIndex: selected, renderItem: ({ item }) => eh(eink.Text, null, item) });
    const props = kind === view ? { ref } : { ref, selectedIndex: selected };
    return eh(eink.Box, { height: 5, flexDirection: 'column' }, eh(kind === view ? ScrollView : ScrollList, props, ...rows.map((text) => eh(eink.Text, { key: text }, text))));
  };
  for (const kind of [view, list, virtual]) {
    const app = emount(eh(Wired, { kind }), { columns: 40, rows: 24 });
    await app.flush();
    const start = app.screen();
    await app.press(...Array.from({ length: 8 }, () => keys.down));
    t.notEqual(app.screen(), start, `positive control: ${kind} moves when useInput drives it`);
  }
});

s.fact(
  F,
  ['With that wiring, `ink-scroll-list` and `ink-virtual-list` scroll the window to follow the selection.'],
  { kind: 'R' },
  async (t, q) => {
    const [list, virtual] = [q.tok('ink-scroll-list'), q.tok('ink-virtual-list')];
    const { h: eh, mount: emount, ink: eink, React: ereact } = await ext();
    const { ScrollList } = await lib(list);
    const { VirtualList } = await lib(virtual);
    const rows = items(30);
    const Wired = ({ kind }) => {
      const [selected, setSelected] = ereact.useState(0);
      eink.useInput((_input, key) => {
        if (key.downArrow) setSelected((i) => Math.min(rows.length - 1, i + 1));
        if (key.upArrow) setSelected((i) => Math.max(0, i - 1));
      });
      if (kind === list) return eh(eink.Box, { height: 5, flexDirection: 'column' }, eh(ScrollList, { selectedIndex: selected }, ...rows.map((text, i) => eh(eink.Text, { key: text, inverse: i === selected }, text))));
      return eh(VirtualList, { items: rows, height: 7, selectedIndex: selected, renderItem: ({ item, isSelected }) => eh(eink.Text, { inverse: isSelected }, item) });
    };
    for (const kind of [list, virtual]) {
      const app = emount(eh(Wired, { kind }), { columns: 40, rows: 24 });
      await app.flush();
      t.ok(lines(app).includes('Item 0'));
      await app.press(...Array.from({ length: 12 }, () => keys.down));
      t.ok(lines(app).includes('Item 12'), `${kind}: the selected item, 12 rows down, is in the window`);
      t.ok(!lines(app).includes('Item 0'), `${kind}: and the window has left the first items behind`);
      await app.press(...Array.from({ length: 12 }, () => keys.up));
      t.ok(lines(app).includes('Item 0'), `${kind}: moving back brings them into view again`);
    }
  },
);

// ===================================================================== VirtualList example

s.fence(F, 2, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const { mod } = await runFence(fence);
    const { h: eh, mount: emount } = await ext();
    const app = emount(eh(mod.App), { columns: 40, rows: 24 });
    await app.flush();
    t.deepEqual(lines(app), ['', ...items(8), '  ▼ 992 more'], 'ten lines: the first eight of a thousand items, between two indicator lines');
    await app.press(...Array.from({ length: 20 }, () => keys.down));
    t.ok(lines(app).includes('Item 20'), 'down arrow moves the selection, and the window follows it');
    t.match(lines(app)[0], /^ {2}▲ \d+ more$/);
    await app.press(...Array.from({ length: 5 }, () => keys.up));
    t.ok(lines(app).includes('Item 15'), 'up arrow moves it back');
    const bytes = app.bytes();
    t.match(bytes, /\x1b\[7mItem 15\x1b\[27m/, 'the selected row is drawn inverse');
  },
});

// ===================================================================== renderItem, height

const RENDER_ITEM_SENTENCE = '`renderItem` receives an object — `{item, index, isSelected}` — not the item itself.';

s.fact(F, [RENDER_ITEM_SENTENCE], { kind: 'R' }, async (t, q) => {
  const renderItem = q.tok('renderItem');
  const fields = q.tok('{item, index, isSelected}').slice(1, -1).split(', ');
  const received = [];
  const { h, mount: emount, ink: eink } = await ext();
  const { VirtualList } = await lib('ink-virtual-list');
  const rows = ['alpha', 'beta', 'gamma'];
  const app = emount(h(VirtualList, { items: rows, height: 5, selectedIndex: 1, [renderItem]: (argument) => (received.push(argument), h(eink.Text, null, argument[fields[0]])) }), { columns: 40 });
  await app.flush();
  t.deepEqual(Object.keys(received[0]).sort(), [...fields].sort(), 'what it receives has exactly those fields');
  t.equal(typeof received[0], 'object', 'an object ...');
  t.notEqual(received[0], rows[0], '... not the item itself');
  t.deepEqual(received.slice(0, 3).map((argument) => [argument[fields[0]], argument[fields[1]], argument[fields[2]]]), [['alpha', 0, false], ['beta', 1, true], ['gamma', 2, false]], 'item is the entry, index its position, isSelected whether selectedIndex points at it');
});

s.fact(
  F,
  ['Writing `renderItem={(item) => <Text>{item}</Text>}` passes that object to `<Text>` as a child, which throws `Objects are not valid as a React child`.'],
  { kind: 'R' },
  async (t, q) => {
    const [renderItem] = q.tok('renderItem={(item) => <Text>{item}</Text>}').split('=');
    const { h: eh, ink: eink, catchRenderError } = await ext();
    const Text = q.el(eink, '<Text>');
    const { VirtualList } = await lib('ink-virtual-list');
    const rows = ['alpha', 'beta'];
    const wrong = catchRenderError(eh(VirtualList, { items: rows, [renderItem]: (item) => eh(Text, null, item) }));
    t.match(String(wrong?.message), new RegExp(q.tok('Objects are not valid as a React child').replace(/[()]/g, '\\$&')), 'rendering it throws');
    t.match(String(wrong?.message), /object with keys \{item, index, isSelected\}/, 'about that very object');
    t.equal(catchRenderError(eh(VirtualList, { items: rows, [renderItem]: ({ item }) => eh(Text, null, item) })), null, 'positive control: destructuring the argument works');
  },
);

s.fact(
  F,
  ['There is no `onSelectedIndexChange` prop; `height` defaults to `10` (or `"auto"` to fill the terminal, with `reservedLines` for headers/footers).'],
  { kind: 'D', ctx: ['onSelectedIndexChange'] },
  async (t, q) => {
    const [height, reservedLines] = [q.tok('height'), q.tok('reservedLines')];
    const auto = q.tok('"auto"').slice(1, -1);
    const handler = 'onSelectedIndexChange';
    const declared = extReadFile('ink-virtual-list', 'dist/index.d.ts');
    t.ok(!declared.includes(handler), 'the shipped types have no such prop');
    t.ok(declared.includes('selectedIndex?: number'), 'positive control: selectedIndex is one');
    t.match(declared, new RegExp(`height\\?: number \\| "${auto}"`), 'height takes a number or auto');
    const calls = [];
    const fixed = await virtualList({ props: { [handler]: (index) => calls.push(index) } });
    await fixed.app.press(keys.down, keys.down);
    t.deepEqual(calls, [], 'passing it anyway does nothing: it is never called');
    t.equal(lines(fixed.app).length, Number(q.tok('10')), 'the default height is 10 lines (two of them for the indicators)');
    t.equal(lines((await virtualList({ props: { [height]: 6 } })).app).length, 6, 'positive control: height sets it');
    t.equal(lines((await virtualList({ props: { [height]: auto }, rows: 24 })).app).length, 24, 'auto fills the terminal');
    t.equal(lines((await virtualList({ props: { [height]: auto, [reservedLines]: 5 }, rows: 24 })).app).length, 19, 'less the lines you reserve for a header and footer');
    t.equal(lines((await virtualList({ props: { [height]: auto }, rows: 12 })).app).length, 12, 'whatever the terminal height is');
  },
);

s.types(
  F,
  ['There is no `onSelectedIndexChange` prop; `height` defaults to `10` (or `"auto"` to fill the terminal, with `reservedLines` for headers/footers).'],
  tsx`
import React from 'react';
import {Text} from 'ink';
import {VirtualList} from 'ink-virtual-list';
import type {VirtualListProps} from 'ink-virtual-list';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const heightType: Same<VirtualListProps<string>['height'], number | 'auto' | undefined> = true;
export const reserved: Same<VirtualListProps<string>['reservedLines'], number | undefined> = true;

export const sized = <VirtualList items={['a']} height={10} renderItem={({item}) => <Text>{item}</Text>} />;
export const auto = <VirtualList items={['a']} height="auto" reservedLines={3} renderItem={({item}) => <Text>{item}</Text>} />;
export const noHandler = <VirtualList items={['a']} onSelectedIndexChange={() => {}} renderItem={({item}) => <Text>{item}</Text>} />; //! TS2322
export const wrongRender = <VirtualList items={['a']} renderItem={(item: string) => <Text>{item}</Text>} />; //! TS2322
`,
  { project: 'external', ctx: ['height', '10', '"auto"', 'reservedLines', 'onSelectedIndexChange'] },
);
