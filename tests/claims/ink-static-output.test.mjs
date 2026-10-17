// Claims for skills/core/ink-static-output/SKILL.md.
import { skill, tsx, ink, h, mount, waitFor, screenOf, runIsolated, readPackageFile, loadEcosystem, catchRenderError } from '../lib/index.mjs';
import { pick } from './ink-layout.helpers.mjs';
import { staticList, withoutModes } from './ink-static-output.helpers.mjs';

const { Static, Box, Text } = ink;
const s = skill('ink-static-output');
const F = 'SKILL.md';

/** Mount `element` on a terminal `columns` wide. */
const open = (element, columns = 40) => mount(element, { columns });

// ===================================================================== the example fence

/**
 * The fence runs ten items through <Static> a tenth of a second apart. It is run once and the claims below
 * read what it recorded (the app is unmounted when the first claim that uses it finishes). `atCount[n]` is
 * the screen as it was after the first write that showed the counter reading n, rebuilt from the writes
 * themselves, so no timing is involved in what it contains.
 */
let exampleRun;
const example = () =>
  (exampleRun ??= (async () => {
    const { apps } = await s.runFence(F, 0);
    const app = apps[0];
    await waitFor(() => app.screen().includes('Completed tests: 10'), { timeout: 5000, message: 'Completed tests: 10' });
    await app.flush();
    const atCount = {};
    for (let k = 1; k <= app.stdout.writes.length; k++) {
      const screen = screenOf(app.stdout.writes.slice(0, k).join(''));
      const reading = screen.match(/^Completed tests: (\d+)$/m)?.[1];
      if (reading !== undefined) atCount[reading] ??= screen;
    }
    return { atCount, screen: app.screen(), bytes: app.bytes() };
  })());

// ===================================================================== frontmatter

s.fact(F, ["Render permanent, append-only output above a live-updating Ink UI with <Static> — completed task lists, logs, or any growing collection of items you can't bound in advance."], { kind: 'R' }, async (t) => {
  const list = await staticList();
  const seen = [];
  const all = [];
  // a collection nobody sized in advance: items arrive a few at a time, 120 of them in all
  for (let tick = 1; tick <= 40; tick++) {
    const before = list.printed();
    const batch = Array.from({ length: 3 }, (_, i) => `item ${all.length + i + 1}`);
    all.push(...batch);
    const after = await list.show([...all], tick);
    t.deepEqual(after.slice(0, before.length), before, 'what is already printed stays exactly where it is: output only ever grows');
    t.deepEqual(after.slice(before.length), batch, 'and the new items are added after it');
    seen.push(after.length);
  }
  t.equal(seen.at(-1), 120, 'every item is printed');
  t.equal(list.app.screen().split('\n').at(-1), 'live 40', 'above the live line, which keeps updating below them');
  t.equal(list.calls.length, 120, 'each item was rendered once, however large the list became');
});

s.fact(F, ['Covers the items/style/children(item) API and why previously-rendered items never re-render.'], { kind: 'R' }, async (t) => {
  const list = await staticList({ items: ['a'], style: { paddingLeft: 2 } });
  t.deepEqual(list.printed(), ['  a'], 'items are rendered by children, inside a container that style is applied to');
  t.deepEqual(list.calls, [['a', 0]], 'children is called with the item (and its index)');
  list.newCalls();
  await list.show(['a', 'b'], 1);
  t.deepEqual(list.newCalls(), [['b', 1]], 'a previously-rendered item is not rendered again');
  t.deepEqual(list.printed(), ['  a', '  b']);
});

s.guidance(F, ['Use when the user wants a scrolling log or a "completed items" list alongside a live progress UI.'], 'a routing hint saying when to load the skill; it asserts nothing about Ink', { exempt: ['completed items'] });

// ===================================================================== what <Static> is

s.fact(F, ["`<Static>` renders its output **once**, permanently, above everything else — for activity that doesn't change after it's shown: completed tasks, log lines, anything you can't know the final count of ahead of time."], { kind: 'R' }, async (t, q) => {
  const Component = q.el(ink, '<Static>');
  const times = pick({ once: 1 }, q.tok('once'));
  const steps = ['one', 'two', 'three'];
  // the live element comes first in the tree: the printed items are still above it
  const list = await staticList({ Static: Component, items: steps.slice(0, 1), staticLast: true });
  t.equal(list.newCalls().length, times, 'the render function runs once for the first item');
  const ticks = [steps.slice(0, 1), steps.slice(0, 2), steps.slice(0, 2), steps.slice(0, 3), steps.slice(0, 3)];
  for (const [tick, items] of ticks.entries()) await list.show(items, tick + 1);
  const bytes = withoutModes(list.app.bytes());
  for (const step of steps) t.equal(bytes.split(step).length - 1, times, `"${step}" is written ${times} time, though the live line was redrawn ${ticks.length} times`);
  t.deepEqual(list.app.screen().split('\n'), [...steps, 'live 5'], 'permanently: every item is still on screen, above the live line, in the order added');
  // activity that does not change afterwards: an item whose data changes later is not drawn again
  const changing = [{ text: 'before' }];
  const watched = await staticList({ Static: Component, items: changing, label: (item) => item.text });
  changing[0].text = 'after';
  await watched.show([...changing], 1);
  t.deepEqual(watched.printed(), ['before'], 'what changes after it was shown stays as it was shown');
  t.equal(watched.calls.length, 1);
});

s.fact(F, ["Ink's own documentation for it names Tap's completed-test list and Gatsby's generated-page log, running alongside a live progress bar, as examples."], { kind: 'D' }, async (t) => {
  const docs = readPackageFile('ink', 'build/components/Static.d.ts').replace(/\s+/g, ' ');
  t.match(docs, /\[Tap\]\([^)]*\) uses `<Static>` to display a list of completed tests/, "the doc comment names Tap's list of completed tests");
  t.match(docs, /\[Gatsby\]\([^)]*\) uses it to display a list of generated pages while still displaying a live progress bar/, "and Gatsby's list of generated pages next to a live progress bar");
});

// ---- the example

s.fence(F, 0, {
  run: async (t) => {
    const run = await example();
    const lines = run.screen.split('\n');
    t.deepEqual(lines, [...Array.from({ length: 10 }, (_, i) => `✔ Test #${i + 1}`), '', 'Completed tests: 10'], 'ten completed tests above the live counter (and its top margin)');
  },
});

s.fact(F, ['Rendered once, permanently, as each item is added'], { kind: 'R' }, async (t) => {
  const run = await example();
  t.deepEqual(Object.keys(run.atCount).map(Number).sort((a, b) => a - b).slice(-1), [10], 'the counter reached 10');
  for (const n of Object.keys(run.atCount).map(Number).filter((reading) => reading >= 1)) {
    t.ok(run.atCount[n].includes(`✔ Test #${n}\n`), `Test #${n} is on screen by the time the counter reads ${n}`);
    t.ok(!run.atCount[n].includes(`Test #${n + 1}\n`), `and Test #${n + 1} is not yet`);
    t.equal(run.bytes.match(new RegExp(`Test #${n}(?!\\d)`, 'g')).length, 1, `Test #${n} was written to the terminal exactly once`);
  }
  t.ok(run.screen.includes('✔ Test #1\n'), 'and the first is still on screen after the last was added');
});

s.fact(F, ['Keeps re-rendering as state changes'], { kind: 'R' }, async (t) => {
  const run = await example();
  const readings = Object.keys(run.atCount).map(Number);
  t.ok(readings.length >= 2 && readings.includes(0) && readings.includes(10), 'the counter was drawn with more than one value, from 0 to 10');
  for (const n of readings) {
    const live = run.atCount[n].split('\n').filter((line) => line.startsWith('Completed tests:'));
    t.deepEqual(live, [`Completed tests: ${n}`], `the counter is redrawn in place: one line, reading ${n}`);
  }
});

// ===================================================================== props

s.fact(F, ['`items` | `Array` | Items of any type to render.'], { kind: 'R' }, async (t, q) => {
  const itemsProp = q.tok('items');
  const List = q.api(globalThis, 'Array');
  const things = List.of('text', 7, { nested: { deep: true } }, [1, 2], null, false);
  const list = await staticList({ itemsProp, items: things, label: (item) => JSON.stringify(item) });
  t.equal(list.calls.length, things.length, 'every entry is rendered');
  list.calls.forEach(([item], i) => t.equal(item, things[i], `entry ${i} reaches the render function itself, whatever its type`));
  t.deepEqual(list.printed(), things.map((item) => JSON.stringify(item)));
  t.ok(Array.isArray(things) && things instanceof List, 'items is an array');
  const error = catchRenderError(h(Static, { items: new Set(['a']) }, (item) => h(Text, { key: item }, item)));
  t.ok(error instanceof TypeError, 'and only an array: anything else cannot be sliced');
});

s.types(F, ['`items` | `Array` | Items of any type to render.', '`children(item, index)` | `Function` | Called once per item in `items`.'], tsx`
import React from 'react';
import {Static, Text} from 'ink';

export const numbers = <Static items={[1, 2]}>{(item, index) => <Text key={item}>{item + index}</Text>}</Static>;
export const mixed = <Static items={['a', {b: 1}, [3]]}>{(item) => <Text key={String(item)}>x</Text>}</Static>;
export const notAnArray = <Static items="abc">{(item) => <Text key={item}>x</Text>}</Static>; //! TS2322
export const wrongItem = <Static items={[1, 2]}>{(item: string) => <Text key={item}>x</Text>}</Static>; //! TS2322
export const noChildren = <Static items={[1]} />; //! TS2741
`, { ctx: ['Array', 'Function', 'children(item, index)'] });

const letters = ['a', 'bb'];
const firstFrame = (app) => withoutModes(app.bytes());
const inColumn = (style, columns = 20) =>
  open(h(Box, { flexDirection: 'column' }, h(Box, { flexDirection: 'column', alignSelf: 'flex-start', ...style }, ...letters.map((l) => h(Text, { key: l }, l))), h(Text, null, 'live 0')), columns);

s.fact(F, ['`style` | `object` | Applied to the container of rendered children — accepts every `<Box>` style property'], { kind: 'R' }, async (t, q) => {
  const prop = q.tok('style');
  const kind = q.tok('object');
  const Box_ = q.el(ink, '<Box>');
  const styles = [
    { padding: 1 },
    { paddingLeft: 2 },
    { marginLeft: 2 },
    { marginBottom: 1 },
    { gap: 1, flexDirection: 'row' },
    { borderStyle: 'round' },
    { width: 8, borderStyle: 'single', borderColor: 'green' },
    { backgroundColor: 'red' },
    { alignItems: 'flex-end', width: 6 },
    { justifyContent: 'center', width: 6, flexDirection: 'row' },
    { height: 4 },
  ];
  const bare = firstFrame(await open(h(Box_, { flexDirection: 'column' }, h(Static, { items: letters }, (l) => h(Text, { key: l }, l)), h(Text, null, 'live 0')), 20));
  for (const style of styles) {
    t.equal(typeof style, kind, 'style is a plain object');
    const viaStatic = await open(h(Box_, { flexDirection: 'column' }, h(Static, { items: letters, [prop]: style }, (l) => h(Text, { key: l }, l)), h(Text, null, 'live 0')), 20);
    const viaBox = await inColumn(style);
    t.equal(firstFrame(viaStatic), firstFrame(viaBox), `${JSON.stringify(style)} does to the container of the items what it does to a <Box>`);
    t.notEqual(firstFrame(viaStatic), bare, `${JSON.stringify(style)} makes a difference`);
  }
  // the container wraps the items rendered together: items added later get a container of their own
  const list = await staticList({ items: ['a'], style: { borderStyle: 'single' } });
  await list.show(['a', 'b', 'c'], 1);
  t.deepEqual(list.app.screen().split('\n').slice(0, -1), ['┌─┐', '│a│', '└─┘', '┌─┐', '│b│', '│c│', '└─┘'], 'one container per batch of newly rendered items');
});

s.types(F, ['`style` | `object` | Applied to the container of rendered children — accepts every `<Box>` style property'], tsx`
import React from 'react';
import {Box, Static, Text} from 'ink';

type StaticStyle = NonNullable<React.ComponentProps<typeof Static<number>>['style']>;
type BoxStyle = Exclude<keyof React.ComponentProps<typeof Box>, 'children' | 'ref' | 'key' | \`aria-\${string}\`>;
export const everyBoxStyleProperty: [Exclude<BoxStyle, keyof StaticStyle>] extends [never] ? true : false = true;

export const styled = (
	<Static items={[1]} style={{padding: 1, borderStyle: 'round', backgroundColor: 'red', flexDirection: 'row', gap: 1}}>
		{(item) => <Text key={item}>x</Text>}
	</Static>
);
export const unknown = <Static items={[1]} style={{padding: 'wide'}}>{(item) => <Text key={item}>x</Text>}</Static>; //! TS2322
export const notAnObject = <Static items={[1]} style="padding: 1">{(item) => <Text key={item}>x</Text>}</Static>; //! TS2559
`, { ctx: ['object', '<Box>'] });

s.fact(F, ['`children(item, index)` | `Function` | Called once per item in `items`.'], { kind: 'R' }, async (t, q) => {
  const [name, args] = q.tok('children(item, index)').match(/^(\w+)\((.*)\)$/).slice(1);
  const [itemName, indexName] = args.split(', ');
  const Fn = q.api(globalThis, 'Function');
  const itemsProp = q.tok('items');
  const received = [];
  const render = (...given) => {
    received.push(Object.fromEntries([itemName, indexName].map((n, i) => [n, given[i]])));
    return h(Text, { key: given[1] }, String(given[0]));
  };
  t.ok(render instanceof Fn, 'children is a function');
  const app = await open(h(Static, { [itemsProp]: ['x', 'y'], [name]: render }));
  await app.flush();
  t.deepEqual(received, [{ item: 'x', index: 0 }, { item: 'y', index: 1 }], 'it receives the item and its index in the array');
  await app.rerender(h(Static, { [itemsProp]: ['x', 'y', 'z'], [name]: render }));
  await app.rerender(h(Static, { [itemsProp]: ['x', 'y', 'z'], [name]: render }));
  t.deepEqual(received.slice(2), [{ item: 'z', index: 2 }], 'and is called once per item: re-rendering the same items calls it no more');
  t.equal(app.screen(), 'x\ny\nz');
});

s.fact(F, ['**Must assign a `key` to the root element it returns.**'], { kind: 'R' }, async (t, q) => {
  // the rule's own wording names the prop it is about; both mentions of it are read from the text
  const prop = q.tok('key');
  const [, named] = q.tok('Must assign a `key` to the root element it returns.').match(/^Must assign a `(\w+)` to the root element it returns\.$/) ?? [];
  t.equal(named, prop, 'the rule is about the key prop');
  const run = (name) => runIsolated({ probe: 'ink-static-output-key', args: [name], tty: { isTTY: true, columns: 40, rows: 10 } });
  const keyed = await run(prop);
  t.deepEqual(keyed.json.warnings, [], 'with a key on the root element React has nothing to say');
  t.equal(keyed.json.screen, 'a\nb');
  const unkeyed = await run(`${prop}Δ`);
  t.equal(unkeyed.json.warnings.length, 1, 'without it React warns');
  t.match(unkeyed.json.warnings[0], new RegExp(`unique "${prop}" prop`), 'that each child needs a unique key');
  t.match(unkeyed.json.warnings[0], /render method of `Static`/, 'in the render method of Static');
});

// ===================================================================== the one rule

s.fact(F, ['`<Static>` renders **only the items past the previous `items.length`** — it counts items, it does not diff them, so it never re-renders or erases an item it already rendered.'], { kind: 'R' }, async (t, q) => {
  const Component = q.el(ink, '<Static>');
  const [itemsProp, lengthProp] = q.tok('items.length').split('.');
  const rule = q.tok('only the items past the previous `items.length`');
  t.equal(rule, `only the items past the previous \`${itemsProp}.${lengthProp}\``, 'the rule is about the length of the previous items');
  const list = await staticList({ Static: Component, itemsProp });
  let previous = [];
  const steps = [
    ['a'],
    ['a', 'b', 'c'],
    ['a', 'b', 'c', 'd'],
    ['p', 'q', 'r', 's'], // different items, same length
    ['p', 'q'], // shorter
    ['p', 'q', 'u', 'v'],
    ['w', 'x', 'y', 'm', 'n'], // only the fifth is past the old length
    [],
    ['z'],
  ];
  const printed = [];
  for (const [tick, items] of steps.entries()) {
    list.newCalls();
    const after = await list.show(items, tick + 1);
    const start = previous[lengthProp];
    const expected = items.slice(start);
    t.deepEqual(list.newCalls(), expected.map((item, i) => [item, start + i]), `items ${JSON.stringify(items)}: only the items from index ${start} on are rendered`);
    printed.push(...expected);
    t.deepEqual(after, printed, 'and they are added to what was printed before');
    previous = items;
  }
  t.deepEqual(printed, ['a', 'b', 'c', 'd', 'u', 'v', 'n', 'z'], 'items swapped in below the previous length (p, q, r, s, w, x, y, m) were never printed');
});

s.fact(F, ['If you mutate an object already present in a previous `items` array, replace an earlier item, or shrink the array, nothing on screen changes; only append new items.'], { kind: 'R' }, async (t, q) => {
  const itemsProp = q.tok('items');
  const original = [{ text: 'first' }, { text: 'second' }];
  const list = await staticList({ itemsProp, items: original, label: (item) => item.text });
  const frame = () => withoutModes(list.app.bytes());
  const settled = list.printed();
  t.deepEqual(settled, ['first', 'second']);
  list.newCalls();
  const written = frame().length;
  original[0].text = 'mutated';
  await list.show([...original], 1);
  t.deepEqual(list.printed(), settled, 'mutating an object that is already in items changes nothing on screen');
  await list.show([{ text: 'replacement' }, original[1]], 2);
  t.deepEqual(list.printed(), settled, 'neither does replacing an earlier item');
  await list.show([original[0]], 3);
  t.deepEqual(list.printed(), settled, 'nor shrinking the array');
  t.deepEqual(list.calls, [], 'the render function was not called for any of it');
  t.ok(!frame().slice(written).includes('mutated') && !frame().includes('replacement'), 'none of the new text was ever written');
  await list.show([original[0], { text: 'appended' }], 4);
  t.deepEqual(list.printed(), [...settled, 'appended'], 'only an appended item appears');
});

s.fact(F, ['After a shrink, appended items are counted from the new, shorter length.'], { kind: 'R' }, async (t) => {
  const list = await staticList({ items: ['a', 'b', 'c'] });
  list.newCalls();
  await list.show(['a'], 1);
  t.deepEqual(list.printed(), ['a', 'b', 'c'], 'the shrink prints and erases nothing');
  await list.show(['a', 'x', 'y'], 2);
  t.deepEqual(list.newCalls(), [['x', 1], ['y', 2]], 'items appended afterwards are counted from the shorter length: x and y are new');
  t.deepEqual(list.printed(), ['a', 'b', 'c', 'x', 'y']);
  await list.show([], 3);
  await list.show(['n'], 4);
  t.deepEqual(list.newCalls(), [['n', 0]], 'after emptying the array the next item is the first again');
  t.deepEqual(list.printed(), ['a', 'b', 'c', 'x', 'y', 'n'], 'and it is printed below everything printed before');
});

s.fact(F, ["Each item's render function runs once, however many times the list grows, and the elements it returns are removed from the tree as soon as they have been written: a component inside an item is unmounted right away"], { kind: 'R' }, async (t) => {
  const list = await staticList({ items: ['a'] });
  t.deepEqual(list.calls, [['a', 0]]);
  t.deepEqual(list.events, ['mount a', 'unmount a'], 'the item mounts, is written, and unmounts at once');
  await list.show(['a', 'b'], 1);
  await list.show(['a', 'b'], 2);
  await list.show(['a', 'b', 'c', 'd'], 3);
  t.deepEqual(list.calls, [['a', 0], ['b', 1], ['c', 2], ['d', 3]], 'across four growing renders each item was rendered once');
  t.deepEqual(list.events, ['mount a', 'unmount a', 'mount b', 'unmount b', 'mount c', 'mount d', 'unmount c', 'unmount d'], 'and each item component was unmounted as soon as it was written');
  t.deepEqual(list.printed(), ['a', 'b', 'c', 'd']);
});

s.guidance(F, ['so keep items free of state, effects and timers.'], 'advice that follows from the unmount behaviour proven in the claim above: an item component is unmounted as soon as it is written');

// ===================================================================== when not to use it

s.fact(F, ["`<Static>` is for content that's genuinely done changing.", 'For a live-updating list where earlier entries can still change (e.g. a task list where a "pending" row later becomes "done" in place)', 'or plain `<Box>`/`<Text>` — not `<Static>`.'], { kind: 'R', ctx: ['pending', 'done'] }, async (t, q) => {
  const Component = q.el(ink, '<Static>');
  const Container = q.el(ink, '<Box>');
  const Label = q.el(ink, '<Text>');
  // the two row states are the sentence's illustration (ctx): any two different words would do
  const [pending, done] = ['pending', 'done'];
  const rows = (...states) => states.map((state, i) => ({ id: i, state }));
  // in <Static>: the row is printed once, as pending, and stays pending when its state becomes done
  const list = await staticList({ Static: Component, items: rows(pending), label: (row) => row.state });
  await list.show(rows(done), 1);
  t.deepEqual(list.printed(), [pending], 'in <Static> a pending row never becomes done');
  // in plain <Box>/<Text> driven by state, the same row changes in place
  const Tasks = ({ states }) => h(Container, { flexDirection: 'column' }, ...states.map((state, i) => h(Label, { key: i }, state)));
  const plain = await open(h(Tasks, { states: [pending, 'queued'] }));
  await plain.flush();
  t.equal(plain.screen(), `${pending}\nqueued`);
  await plain.rerender(h(Tasks, { states: [done, 'queued'] }));
  t.equal(plain.screen(), `${done}\nqueued`, 'with ordinary state the row changes in place');
});

s.fact(F, ["use ordinary state and `ink-task-runners`' `ink-task-list`,"], { kind: 'X' }, async (t, q) => {
  const [packageName, skillName] = [q.tok('ink-task-list'), q.tok('ink-task-runners')];
  const { packages } = await loadEcosystem();
  const entry = packages.find((p) => p.name === packageName);
  t.ok(entry, 'ink-task-list is a package in the ecosystem data');
  t.ok(entry.skills.includes(skillName), 'covered by the ink-task-runners skill');
  // the point of using it here: a row's state changes in place
  const { TaskList, Task } = await import(packageName);
  const states = (state) => h(TaskList, null, h(Task, { label: 'Build', state }));
  const app = await open(states('pending'));
  await app.flush();
  t.equal(app.screen(), '◼ Build');
  await app.rerender(states('success'));
  t.equal(app.screen(), '✔ Build', 'a task changes state in place, which is what <Static> cannot do');
});
