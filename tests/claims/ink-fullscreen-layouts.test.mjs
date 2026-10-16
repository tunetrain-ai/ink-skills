// Claims for skills/patterns/ink-fullscreen-layouts/SKILL.md.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import semver from 'semver';
import { skill, ink, h, React, mount, fakeStdout, fakeStdin, runFence, runIsolated, pkg, tick } from '../lib/index.mjs';
import { pick, propAndExpression, resolvePath, scrollView, press } from './ink-layout.helpers.mjs';
import { allSkillFiles } from '../lib/claims.mjs';
import { runFenceWithRenderOptions, escapeOf, withoutModes, screenNow } from './ink-fullscreen-layouts.helpers.mjs';

const { Box, Text } = ink;
const s = skill('ink-fullscreen-layouts');
const F = 'SKILL.md';

const lines = (app) => screenNow(app).split('\n');
const skillDir = (name) => allSkillFiles().find((entry) => entry.skill === name)?.dir;
/** `name: value` → ['name', value], the value parsed as JSON (`interactive: false`). */
const optionOf = (token) => {
  const [name, value] = token.split(': ');
  return [name, JSON.parse(value)];
};
/** Everything an app wrote, split at the alternate-screen switches: [before, inside, after]. */
const aroundAlternateScreen = (bytes, enter, exit) => {
  const start = bytes.indexOf(enter);
  const end = bytes.lastIndexOf(exit);
  return [bytes.slice(0, start), bytes.slice(start + enter.length, end), bytes.slice(end + exit.length)];
};
/** Render `element` with ink.render on a fake terminal; resolves { instance, stdout, stderr }. */
const renderOn = (render, element, options = {}) => {
  const stdout = options.stdout ?? fakeStdout({ columns: 40, rows: 10 });
  const stderr = fakeStdout({ columns: 40, rows: 10 });
  const instance = render(element, { stdout, stderr, stdin: fakeStdin(), debug: false, exitOnCtrlC: false, patchConsole: false, ...options });
  return { instance, stdout, stderr };
};

// ===================================================================== frontmatter

s.fact(F, ['Build full-screen, responsive Ink layouts — the alternateScreen render option, sizing to the terminal with useWindowSize, and split-pane layouts using flexGrow.'], { kind: 'R' }, async (t) => {
  const App = () => {
    const { columns, rows } = ink.useWindowSize();
    return h(Box, { height: rows, width: columns }, h(Box, { width: 6, borderStyle: 'single' }), h(Box, { flexGrow: 1, borderStyle: 'single' }));
  };
  const app = mount(h(App), { columns: 30, rows: 5, render: { alternateScreen: true } });
  await app.flush();
  t.ok(app.bytes().startsWith('\x1b[?1049h'), 'the alternateScreen option switches to the alternate screen');
  t.deepEqual(lines(app).map((line) => line.length), [30, 30, 30, 30, 30], 'useWindowSize gives the size the layout fills');
    await app.resize(24, 4);
  t.deepEqual(lines(app).map((line) => line.length), [24, 24, 24, 24], 'and the layout follows a resize');
  const edge = (cells) => `┌${'─'.repeat(cells - 2)}┐`;
  t.equal(lines(app)[0], edge(6) + edge(24 - 6), 'a fixed-width pane next to one that grows into the rest');
});

s.guidance(F, ['Use when the user wants a full-screen TUI, a resizable/responsive layout, or a multi-pane app.'], 'a routing hint saying when to load the skill; it asserts nothing about Ink');

// ===================================================================== the alternate screen buffer

s.fact(F, ["`render(<App />, {alternateScreen: true})` renders on the terminal's alternate screen: Ink switches to it (`\\x1b[?1049h`) before drawing anything and back (`\\x1b[?1049l`) when the app exits. Everything the app draws lies between the two, so none of it reaches the normal screen or its scrollback."], { kind: 'R' }, async (t, q) => {
  const render = q.api(ink, 'render(<App />, {alternateScreen: true})');
  const [option, value] = optionOf(q.tok('render(<App />, {alternateScreen: true})').match(/\{(.*)\}/)[1]);
  const enter = escapeOf(q.tok('\\x1b[?1049h'));
  const exit = escapeOf(q.tok('\\x1b[?1049l'));
  const App = () => h(Text, null, 'Full-screen app');

  const { instance, stdout } = renderOn(render, h(App), { [option]: value });
  await instance.waitUntilRenderFlush();
  t.ok(stdout.bytes().startsWith(enter), 'the switch to the alternate screen is the first thing written');
  t.ok(stdout.bytes().indexOf('Full-screen app') > enter.length, 'before anything is drawn');
  instance.unmount();
  await tick();
  const [before, inside, after] = aroundAlternateScreen(stdout.bytes(), enter, exit);
  t.equal(before, '', 'nothing was written before it');
  t.ok(inside.includes('Full-screen app'), 'the app drew between the two');
  t.equal(stdout.bytes().split(exit).length - 1, 1, 'the way back is written once');
  t.equal(after, '\x1b[?25h', 'and all that follows it is making the cursor visible again');
  // positive control: without the option nothing switches screen
  const plain = renderOn(render, h(App));
  await plain.instance.waitUntilRenderFlush();
  plain.instance.unmount();
  t.ok(!plain.stdout.bytes().includes(enter) && !plain.stdout.bytes().includes(exit), 'without the option there is no switch');
});

s.fence(F, 0, {
  run: async (t) => {
    const { apps } = await runFenceWithRenderOptions(s, F, 0, { mountOptions: { columns: 30, rows: 6 } });
    const app = apps[0];
    await app.flush();
    t.ok(app.bytes().startsWith('\x1b[?1049h'), "the fence's render options reach Ink: it starts on the alternate screen");
    t.equal(app.screen(), 'Full-screen app');
    await app.unmount();
    t.ok(app.bytes().includes('\x1b[?1049l'), 'and leaves it when unmounted');
  },
});

s.fact(F, ["Constraints (see `ink-rendering-and-lifecycle`'s option table):"], { kind: 'D' }, async (t, q) => {
  const dir = skillDir(q.tok('ink-rendering-and-lifecycle'));
  t.ok(dir, 'the skill it points to exists');
  t.match(readFileSync(join(dir, 'SKILL.md'), 'utf8'), /^\| `alternateScreen` \|/m, 'and its option table has an alternateScreen row');
});

s.fact(F, ['it only works in interactive mode — ignored under `interactive: false` or in a non-interactive environment like CI or piped stdout;'], { kind: 'R' }, async (t, q) => {
  const [option, value] = optionOf(q.tok('interactive: false'));
  const enter = '\x1b[?1049h';
  const bytesOf = async (mountOptions) => {
    const app = mount(h(Text, null, 'x'), { columns: 20, rows: 5, ...mountOptions });
    await app.flush();
    return app.bytes();
  };
  t.ok((await bytesOf({ render: { alternateScreen: true } })).includes(enter), 'control: in interactive mode it switches');
  t.ok(!(await bytesOf({ render: { alternateScreen: true, [option]: value } })).includes(enter), 'with interactive: false it is ignored');
  t.ok(!(await bytesOf({ isTTY: false, render: { alternateScreen: true } })).includes(enter), 'so it is when stdout is not a terminal (piped)');
  const probe = (env) => runIsolated({ probe: 'ink-fullscreen-layouts-alt', env, tty: { isTTY: true, columns: 40, rows: 10 } });
  const calm = await probe({});
  t.ok(calm.json.bytes.includes(enter), 'control: a process with a terminal and no CI variable switches');
  const ci = await probe({ CI: 'true' });
  t.ok(!ci.json.bytes.includes(enter), 'the same process under CI does not, though its stdout is a terminal');
  t.equal(ci.json.bytes, 'full-screen\n', 'it just writes the frame');
});

s.fact(F, ["calling `render()` again with the same `stdout` before unmounting reuses the first instance, ignores the second call's options and warns on stderr;"], { kind: 'R' }, async (t, q) => {
  const render = q.api(ink, 'render()');
  const streamOption = q.tok('stdout');
  const warnings = [];
  const write = process.stderr.write;
  process.stderr.write = (chunk) => {
    warnings.push(String(chunk));
    return true;
  };
  try {
    const stdout = fakeStdout({ columns: 40, rows: 10 });
    const first = renderOn(render, h(Text, null, 'first'), { [streamOption]: stdout });
    await first.instance.waitUntilRenderFlush();
    t.deepEqual(warnings, [], 'the first call is fine');
    const second = renderOn(render, h(Text, null, 'second'), { [streamOption]: stdout, alternateScreen: true });
    await second.instance.waitUntilRenderFlush();
    t.equal(warnings.length, 1, 'the second call warns');
    t.match(warnings[0], /render\(\) was called again for the same stdout before the previous Ink instance was unmounted/, 'about reuse of the same stdout');
    t.equal(first.instance.rerender, second.instance.rerender, 'and got the first instance back');
    t.ok(withoutModes(stdout.bytes()).includes('second'), 'the second tree was drawn by that instance');
    t.ok(!stdout.bytes().includes('\x1b[?1049h'), 'with its own options ignored: no alternate screen');
    // positive control: after unmounting, the same stream can be used again, without a warning
    first.instance.unmount();
    await tick();
    warnings.length = 0;
    const again = renderOn(render, h(Text, null, 'again'), { [streamOption]: stdout, alternateScreen: true });
    await again.instance.waitUntilRenderFlush();
    t.deepEqual(warnings, [], 'once unmounted, render() on the same stdout is fine');
    t.ok(stdout.bytes().includes('\x1b[?1049h'), 'and its options apply');
    again.instance.unmount();
  } finally {
    process.stderr.write = write;
  }
});

s.fact(F, ['text a component writes with `useStdout().write` while the app unmounts is dropped, not replayed onto the normal screen.'], { kind: 'R' }, async (t, q) => {
  const text = q.tok('useStdout().write');
  const useStdout = pick(ink, text.slice(0, text.indexOf('(')));
  const member = text.slice(text.lastIndexOf('.') + 1);
  const exit = '\x1b[?1049l';
  const Farewell = () => {
    const out = useStdout();
    React.useEffect(() => {
      out[member]('written while mounted\n');
      return () => out[member]('written while unmounting\n');
    }, []);
    return h(Text, null, 'app');
  };
  const app = mount(h(Farewell), { columns: 30, rows: 5, render: { alternateScreen: true } });
  await app.flush();
  t.ok(app.bytes().includes('written while mounted'), 'control: text written while the app is running is written');
  await app.unmount();
  t.ok(!app.bytes().includes('written while unmounting'), 'text written while it unmounts is not');
  t.equal(app.bytes().slice(app.bytes().lastIndexOf(exit) + exit.length), '\x1b[?25h', 'and nothing is replayed after the way back to the normal screen');
});

s.fact(F, ['**Ink writes nothing to the normal screen** while the alternate screen is active or after it exits, so nothing the app drew is left behind.'], { kind: 'R' }, async (t, q) => {
  const [, none] = q.tok('Ink writes nothing to the normal screen').match(/^Ink writes (nothing) to the normal screen$/);
  const expected = pick({ nothing: '' }, none);
  const [enter, exit] = ['\x1b[?1049h', '\x1b[?1049l'];
  const Log = ({ n }) =>
    h(Box, { flexDirection: 'column' }, h(ink.Static, { items: Array.from({ length: n }, (_, i) => `static ${i}`) }, (item) => h(Text, { key: item }, item)), h(Text, null, `live ${n}`));
  const app = mount(h(Log, { n: 1 }), { columns: 30, rows: 5, render: { alternateScreen: true } });
  await app.flush();
  await app.rerender(h(Log, { n: 3 }));
  await app.resize(20, 4);
  await app.unmount();
  const [before, inside, after] = aroundAlternateScreen(app.bytes(), enter, exit);
  t.equal(withoutModes(before), expected, 'nothing before the switch');
  t.equal(withoutModes(after), expected, 'nothing after the way back');
  t.ok(['static 0', 'static 2', 'live 3'].every((text) => inside.includes(text)), 'while everything the app drew, static output and every frame, is between the two');
});

s.guidance(F, ['If your app needs a persistent log the user can review after exit, write it to a file, not just the terminal.'], 'a recommendation; the fact it rests on (nothing the app drew is left on the normal screen) is proven by the claim above');

// ===================================================================== sizing to the terminal

s.fact(F, ['`useWindowSize()` (see `ink-terminal-io`) returns `{columns, rows}` and re-renders on resize — the building block for anything that should fill the terminal or react to its size:'], { kind: 'R' }, async (t, q) => {
  const useWindowSize = q.api(ink, 'useWindowSize()');
  t.ok(skillDir(q.tok('ink-terminal-io')), 'the skill it points to exists');
  const names = q.tok('{columns, rows}').slice(1, -1).split(', ');
  let seen;
  let renders = 0;
  const Size = () => {
    seen = useWindowSize();
    renders++;
    return h(Text, null, names.map((name) => `${name}=${seen[name]}`).join(' '));
  };
  const app = mount(h(Size), { columns: 40, rows: 10 });
  await app.flush();
  t.deepEqual(Object.keys(seen), names, 'it returns exactly columns and rows');
  t.equal(app.screen(), 'columns=40 rows=10', 'the size of the terminal');
  const before = renders;
  await app.resize(33, 12);
  t.equal(app.screen(), 'columns=33 rows=12', 'a resize re-renders the component with the new size');
  t.ok(renders > before);
  await app.resize(50, 12);
  t.equal(app.screen(), 'columns=50 rows=12', 'every time');
});

s.fence(F, 1, {
  run: async (t) => {
    const { mod } = await s.runFence(F, 1);
    const app = mount(h(mod.FullScreenApp), { columns: 30, rows: 8 });
    await app.flush();
    t.equal(lines(app).length, 8, 'the layout is as tall as the terminal');
    t.equal(lines(app)[0], 'Header', 'the header is on the first row');
    t.equal(lines(app)[1], 'Content fills remaining height', 'the content starts right under it');
    t.equal(lines(app).at(-1), 'Footer', 'the footer is on the last row');
    await app.resize(30, 12);
    t.equal(lines(app).length, 12, 'after a resize it is as tall as the new terminal');
    t.equal(lines(app).at(-1), 'Footer', 'and the footer is still on the last row');
    await app.resize(30, 5);
    t.deepEqual([lines(app).length, lines(app).at(-1)], [5, 'Footer'], 'also when the terminal gets smaller');
  },
});

s.fact(F, ["Setting a `<Box>`'s `height` to `rows` is what makes a layout genuinely full-screen rather than just as tall as its content — `<Box>` doesn't implicitly fill the terminal's height on its own (a root `<Box>` already spans its `columns`)."], { kind: 'R' }, async (t, q) => {
  const [Container, Spanning] = [q.el(ink, '<Box>'), q.el(ink, '<Box>')];
  const [heightProp, rowsName, columnsName] = [q.tok('height'), q.tok('rows'), q.tok('columns')];
  const Layout = ({ fill }) => {
    const size = ink.useWindowSize();
    return h(Container, { borderStyle: 'single', ...(fill ? { [heightProp]: size[rowsName] } : {}) }, h(Text, null, 'content'));
  };
  const natural = mount(h(Layout, { fill: false }), { columns: 30, rows: 9 });
  await natural.flush();
  t.equal(lines(natural).length, 3, 'without it the layout is as tall as its content');
  const filled = mount(h(Layout, { fill: true }), { columns: 30, rows: 9 });
  await filled.flush();
  t.equal(lines(filled).length, 9, 'with height set to rows it is as tall as the terminal');
  t.ok(lines(filled).at(-1).startsWith('└'), 'down to its bottom border');
  await filled.resize(30, 6);
  t.equal(lines(filled).length, 6, 'and follows the terminal');
  // width: a root box already spans the terminal's columns, with nothing set
  const Root = () => {
    const size = ink.useWindowSize();
    return h(Spanning, { borderStyle: 'single' }, h(Text, null, String(size[columnsName])));
  };
  for (const width of [20, 37]) {
    const app = mount(h(Root), { columns: width, rows: 5 });
    await app.flush();
    t.deepEqual(lines(app).map((line) => line.length), [width, width, width], `a bordered root <Box> is as wide as the terminal`);
    t.equal(Number(lines(app)[1].match(/\d+/)[0]), width, 'whose columns is that width');
  }
});

// ---- scrolling pane

const rowsOf = (view) => view.visible().split('\n');

s.fact(F, ['For a scrollable pane, give a fixed-height `<Box overflow="hidden">` a `contentOffsetY` (Ink 8)'], { kind: 'R' }, async (t, q) => {
  const [, componentName, overflowProp, overflowValue] = q.tok('<Box overflow="hidden">').match(/^<(\w+) (\w+)="(\w+)">$/);
  const Pane = pick(ink, componentName);
  const offsetProp = q.tok('contentOffsetY');
  t.equal(Pane, Box);
  t.equal(semver.major(pkg('ink').version), Number(q.tok('8')), 'the Ink in use is 8');
  const viewport = { [overflowProp]: overflowValue, flexDirection: 'column' };
  const plain = await scrollView({ rows: 6, height: 3, viewport, offsetProp, footer: 'end' });
  t.deepEqual(rowsOf(plain), ['Row 1', 'Row 2', 'Row 3', 'end'], 'a fixed-height hidden box shows only its first rows');
  const scrolled = await scrollView({ rows: 6, height: 3, viewport, offsetProp, viewportProps: { [offsetProp]: 2 }, footer: 'end' });
  t.deepEqual(rowsOf(scrolled), ['Row 3', 'Row 4', 'Row 5', 'end'], 'contentOffsetY shifts the content up by that many rows');
  const open = await scrollView({ rows: 6, height: 3, viewport: { flexDirection: 'column' }, offsetProp, footer: 'end' });
  t.notDeepEqual(rowsOf(open), rowsOf(plain), 'positive control: without overflow the content is not clipped to the box');
});

s.fact(F, ['and clamp it to `content.height - viewport.clientHeight`, reading both from `useBoxMetrics()` / `measureElement()`'], { kind: 'R' }, async (t, q) => {
  const formula = q.tok('content.height - viewport.clientHeight');
  const useBoxMetrics = q.api(ink, 'useBoxMetrics()');
  const measure = q.api(ink, 'measureElement()');
  const view = await scrollView({ rows: 8, height: 3, useBoxMetrics, footer: 'end' });
  const [left, right] = formula.split(' - ');
  const max = resolvePath(view.seen, left) - resolvePath(view.seen, right);
  t.equal(max, 5, 'eight rows in a three-row viewport leave five rows to scroll');
  t.equal(view.seen.maxScrollTop, max, 'the clamp is that difference');
  await press(view, 'down', 9);
  t.equal(view.seen.scrollTop, max, 'scrolling stops at it');
  t.deepEqual(rowsOf(view), ['Row 6', 'Row 7', 'Row 8', 'end'], 'with the last row at the bottom of the viewport');
  const beyond = await scrollView({ rows: 8, height: 3, viewportProps: { contentOffsetY: max + 1 }, footer: 'end' });
  t.deepEqual(rowsOf(beyond), ['Row 7', 'Row 8', '', 'end'], 'one more and the viewport shows an empty row');
  // measureElement reports the same numbers as the hook
  const refs = {};
  const Probe = () => {
    refs.viewport = React.useRef(null);
    refs.content = React.useRef(null);
    const viewport = useBoxMetrics(refs.viewport);
    const content = useBoxMetrics(refs.content);
    refs.hook = { viewport, content };
    return h(Box, { ref: refs.viewport, height: 3, overflow: 'hidden', flexDirection: 'column' }, h(Box, { ref: refs.content, flexDirection: 'column', flexShrink: 0 }, ...Array.from({ length: 8 }, (_, i) => h(Text, { key: i }, `Row ${i + 1}`))));
  };
  const app = mount(h(Probe), { columns: 20, rows: 12 });
  await app.flush();
  t.equal(measure(refs.content.current).height, refs.hook.content.height, 'measureElement gives the content height the hook does');
  t.equal(measure(refs.viewport.current).clientHeight, refs.hook.viewport.clientHeight, 'and the viewport clientHeight');
});

s.fact(F, ['— `clientHeight` from the viewport, `height` from an inner content wrapper.'], { kind: 'R' }, async (t, q) => {
  const [clientHeight, height] = [q.tok('clientHeight'), q.tok('height')];
  const view = await scrollView({ rows: 8, height: 3, footer: 'end' });
  t.equal(view.seen.viewport[clientHeight], 3, 'the viewport reports the height of the window that shows the content');
  t.equal(view.seen.content[height], 8, 'the content wrapper reports the height of all the content');
  t.notEqual(view.seen.viewport[height], view.seen.content[height], "so the viewport's own height cannot stand in for the content's");
});

s.fact(F, ['`clientHeight` excludes borders but not padding, so put padding on the wrapper, not the viewport.'], { kind: 'R' }, async (t, q) => {
  const clientHeight = q.tok('clientHeight');
  const bordered = await scrollView({ rows: 8, height: 5, viewportProps: { borderStyle: 'single' }, footer: 'end' });
  t.equal(bordered.seen.viewport[clientHeight], 3, 'two border rows are not part of it');
  const padded = await scrollView({ rows: 8, height: 5, viewportProps: { padding: 1 }, footer: 'end' });
  t.equal(padded.seen.viewport[clientHeight], 5, 'two padding rows are');
  await press(padded, 'down', 12);
  t.ok(!padded.visible().includes('Row 8'), 'so with padding on the viewport the last row can never be scrolled into view');
  const wrapped = await scrollView({ rows: 8, height: 5, contentProps: { padding: 1 }, footer: 'end' });
  await press(wrapped, 'down', 12);
  t.ok(wrapped.visible().includes('Row 8'), 'with the padding on the wrapper the clamp is right and the last row is reached');
  t.equal(wrapped.seen.content.height, 10, 'because the wrapper counts its padding in the content height');
});

s.fact(F, ["See `ink-layout`'s scrollable-view reference."], { kind: 'D' }, async (t, q) => {
  const dir = skillDir(q.tok('ink-layout'));
  t.ok(dir, 'the skill it points to exists');
  const reference = join(dir, 'references', 'scrollable-view.md');
  t.ok(existsSync(reference), 'ink-layout has a scrollable-view reference');
  t.match(readFileSync(reference, 'utf8'), /^# Scrolling a view/, 'about scrolling a view');
});

// ===================================================================== split panes

s.fact(F, ['A row (or column) of boxes with `flexGrow`/fixed `width` on each pane is the whole pattern — no special "pane" component exists:'], { kind: 'R' }, async (t, q) => {
  const [grow, width] = [q.tok('flexGrow'), q.tok('width')];
  const word = q.tok('pane');
  const row = mount(h(Box, { height: 3 }, h(Box, { [width]: 8, borderStyle: 'single' }), h(Box, { [grow]: 1, borderStyle: 'single' }), h(Box, { [width]: 6, borderStyle: 'single' })), { columns: 30, rows: 3 });
  await row.flush();
  const edge = (cells) => `┌${'─'.repeat(cells - 2)}┐`;
  t.equal(lines(row)[0], edge(8) + edge(30 - 8 - 6) + edge(6), 'a row of panes: the fixed ones keep their width, the one with flexGrow takes the rest');
  const column = mount(h(Box, { flexDirection: 'column', height: 9 }, h(Box, { height: 3, borderStyle: 'single' }), h(Box, { [grow]: 1, borderStyle: 'single' })), { columns: 10, rows: 9 });
  await column.flush();
  t.deepEqual(lines(column).map((line) => line[0]), ['┌', '│', '└', '┌', '│', '│', '│', '│', '└'], 'and a column of panes works the same way: a fixed-height pane and one that grows into the remaining 6 rows');
  const { mod } = await s.runFence(F, 2);
  const matching = (names) => names.filter((name) => name.toLowerCase().includes(word));
  t.deepEqual(matching(Object.keys(mod)), ['SplitPane'], 'positive control: the search finds the example below, which is made of boxes');
  t.deepEqual(matching(Object.keys(ink)), [], 'but Ink has no export with pane in its name');
});

s.fence(F, 2, {
  run: async (t) => {
    const { mod } = await s.runFence(F, 2);
    const app = mount(h(mod.SplitPane), { columns: 60, rows: 6 });
    await app.flush();
    t.equal(lines(app).length, 6, 'the panes are as tall as the terminal');
    t.equal(lines(app)[0], `┌${'─'.repeat(18)}┐┌${'─'.repeat(38)}┐`, 'a sidebar 20 columns wide and a main pane that takes the other 40');
    t.match(lines(app)[1], /^│Sidebar +││Main content +│$/);
    await app.resize(60, 9);
    t.equal(lines(app).length, 9, 'and follow a resize');
  },
});

s.fact(F, ["`flexShrink={0}` on the fixed-width sidebar keeps it at its width when the terminal is narrower than the sidebar plus the main pane's content — without it both panes shrink and the sidebar is squeezed."], { kind: 'R' }, async (t, q) => {
  const token = q.tok('flexShrink={0}');
  const [prop, expression] = propAndExpression(token);
  const shrinkingAllowed = s.fenceOf(F, 2).code.replace(` ${token}`, '');
  t.notEqual(shrinkingAllowed, s.fenceOf(F, 2).code, 'the sidebar of the fence has the prop');
  t.ok(!shrinkingAllowed.includes(prop), 'and without it, the same fence has no flexShrink at all');
  const sidebarWidth = async (code, columns) => {
    const { mod } = await runFence({ code });
    const app = mount(h(mod.SplitPane), { columns, rows: 5 });
    await app.flush();
    const top = lines(app)[0];
    await app.unmount();
    return top.indexOf('┐') + 1;
  };
  const sidebar = 20;
  const mainContent = 'Main content'.length + 2; // its text and its border
  const exact = sidebar + mainContent;
  t.equal(Number(expression), 0, 'the fence sets it to 0');
  for (const columns of [exact + 10, exact]) {
    t.equal(await sidebarWidth(s.fenceOf(F, 2).code, columns), sidebar, `${columns} columns, with flexShrink 0: the sidebar keeps its ${sidebar}`);
    t.equal(await sidebarWidth(shrinkingAllowed, columns), sidebar, `${columns} columns, without it: the sidebar is not squeezed while both fit`);
  }
  for (const columns of [exact - 1, exact - 9]) {
    t.equal(await sidebarWidth(s.fenceOf(F, 2).code, columns), sidebar, `${columns} columns, with flexShrink 0: the sidebar still has ${sidebar}`);
    t.ok((await sidebarWidth(shrinkingAllowed, columns)) < sidebar, `${columns} columns, without it: the sidebar is squeezed`);
  }
});

s.fact(F, ["See the Flex section of `ink-layout`'s `references/box-props.md` for the full grow/shrink/basis model."], { kind: 'D' }, async (t, q) => {
  const dir = skillDir(q.tok('ink-layout'));
  t.ok(dir, 'the skill it points to exists');
  const file = join(dir, q.tok('references/box-props.md'));
  t.ok(existsSync(file), 'the reference exists');
  const text = readFileSync(file, 'utf8');
  const flex = text.slice(text.indexOf('\n## Flex'), text.indexOf('\n## Position'));
  t.ok(flex.length > 0, 'it has a Flex section');
  for (const prop of ['flexGrow', 'flexShrink', 'flexBasis']) t.ok(flex.includes(prop), `which covers ${prop}`);
});
