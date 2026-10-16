// Claims for skills/core/ink-text-styling/SKILL.md.
import { pathToFileURL } from 'node:url';
import { skill, tsx, h, ink, pkg, packageDir, readPackageFile, resolveEntry, ROOT } from '../lib/index.mjs';

const { Box, Text, renderToString } = ink;
const s = skill('ink-text-styling');
const F = 'SKILL.md';

const render = (element, columns = 40) => renderToString(element, { columns });
/** `<Text …props>x</Text>` as the terminal receives it (the suite runs with colour level 3). */
const text = (props, children = 'x') => render(h(Text, props, children));
/** `Hello World` truncated or wrapped into a 7-column box. */
const narrow = (wrap, content = 'Hello World', width = 7) => render(h(Box, { width }, h(Text, { wrap }, content)));
const inkChalk = async () => (await import(pathToFileURL(resolveEntry('chalk', packageDir('ink'))).href)).default;
// node:test hands its test files FORCE_COLOR=1, which Ink's own chalk takes literally (the suite's colour
// level 3 only reaches the older chalk): pin the level on the chalk instance Ink renders with.
(await inkChalk()).level = 3;
const importFromRoot = async (name) => import(pathToFileURL(resolveEntry(name, ROOT)).href);

// ===================================================================== description

const DESCRIPTION =
  'Style and control text output in Ink — <Text> color/backgroundColor/bold/italic/underline/strikethrough/inverse/dimColor/wrap, <Newline>, <Spacer>, and <Transform> for post-processing rendered output (uppercase, hanging indent, gradients).';

s.fact(F, [DESCRIPTION], { kind: 'R' }, async (t) => {
  const props = DESCRIPTION.match(/<Text> ([\w/]+),/)[1].split('/');
  const values = { color: 'green', backgroundColor: 'green', bold: true, italic: true, underline: true, strikethrough: true, inverse: true, dimColor: true };
  t.deepEqual(props, ['color', 'backgroundColor', 'bold', 'italic', 'underline', 'strikethrough', 'inverse', 'dimColor', 'wrap'], 'the props the description lists');
  for (const prop of props.filter((name) => name !== 'wrap')) {
    t.notEqual(text({ [prop]: values[prop] }), text({}), `${prop} changes how the text is written`);
  }
  t.notEqual(narrow('truncate'), narrow('wrap'), 'wrap changes how text that does not fit is written');
  for (const [, name] of DESCRIPTION.matchAll(/<(\w+)>/g)) t.equal(typeof ink[name], 'function', `<${name}> is exported by ink`);

  const Transform = ink.Transform;
  t.equal(render(h(Transform, { transform: (line) => line.toUpperCase() }, h(Text, null, 'Hello World'))), 'HELLO WORLD', 'uppercase');
  const indent = (line, index) => (index === 0 ? line : `    ${line}`);
  t.equal(render(h(Transform, { transform: indent }, h(Text, null, 'one\ntwo'))), 'one\n    two', 'hanging indent');
  const { default: Gradient } = await import('ink-gradient');
  const colours = new Set([...render(h(Gradient, { name: 'rainbow' }, 'hello')).matchAll(/\x1b\[38;2;(\d+;\d+;\d+)m/g)].map((m) => m[1]));
  t.ok(colours.size > 1, 'gradients: ink-gradient colours each character differently');
});

s.guidance(F, ['Use for anything about how text looks or wraps.'], 'a pointer to when the skill applies; it asserts nothing about behaviour');

// ===================================================================== <Text>

s.fact(F, ['The component that renders text — a string placed directly inside a `<Box>` throws.'], { kind: 'R' }, async (t, q) => {
  const B = q.el(ink, '<Box>');
  t.equal(render(h(B, null, h(Text, null, 'x'))), 'x', 'inside <Text> a string renders');
  t.throws(() => render(h(B, null, 'x')), /Text string "x" must be rendered inside <Text> component/);
});

s.fact(F, ['`<Text>` allows only text nodes and text components (nested `<Text>`, `<Newline>`, `<Transform>`) as children — `<Box>` cannot be nested inside `<Text>`.'], { kind: 'R' }, async (t, q) => {
  const T = q.el(ink, '<Text>');
  const N = q.el(ink, '<Newline>');
  const Tr = q.el(ink, '<Transform>');
  const B = q.el(ink, '<Box>');
  t.equal(render(h(T, null, 'a', h(T, null, 'b'), h(N), h(Tr, { transform: (line) => line.toUpperCase() }, 'c'))), 'ab\nC', 'text, a nested <Text>, <Newline> and <Transform> all render');
  t.throws(() => render(h(T, null, h(B, null, h(T, null, 'x')))), /<Box> can.t be nested inside <Text> component/);
  t.throws(() => render(h(T, null, h(ink.Spacer))), /<Box> can.t be nested inside <Text> component/, '<Spacer> is a <Box>');
});

s.fence(F, 0, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const { apps } = await runFence(fence);
    await apps[0].flush();
    t.equal(apps[0].screen(), 'I am green\nI am black on white\nI am bold\nI am italic\nI am underline\nI am strikethrough\nI am inversed');
    const bytes = apps[0].bytes();
    for (const sequence of ['\x1b[32mI am green', '\x1b[47m\x1b[30mI am black on white', '\x1b[1mI am bold', '\x1b[3mI am italic', '\x1b[4mI am underline', '\x1b[9mI am strikethrough', '\x1b[7mI am inversed']) {
      t.ok(bytes.includes(sequence), JSON.stringify(sequence));
    }
  },
});

// ===================================================================== the props table

s.fact(
  F,
  ['`color` | `string` | — | Powered by [chalk](https://github.com/chalk/chalk) — chalk\'s named colors (`green`, `redBright`), hex (`"#005cc5"`), `rgb(...)`, `ansi256(...)`. Any other string is ignored.'],
  { kind: 'D' },
  async (t, q) => {
    const prop = q.tok('color');
    const chalk = await inkChalk();
    const paint = (value) => text({ [prop]: value });
    t.equal(paint(undefined), 'x', 'no colour by default');
    t.equal(typeof 'green', q.tok('string'), 'a colour is a string');
    for (const name of [q.tok('green'), q.tok('redBright')]) t.equal(paint(name), chalk[name]('x'), `${name} is chalk's named colour`);
    t.equal(paint(q.tok('green')), '\x1b[32mx\x1b[39m');

    const hex = JSON.parse(q.tok('"#005cc5"'));
    const [red, green, blue] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
    const expected = `\x1b[38;2;${red};${green};${blue}mx\x1b[39m`;
    t.equal(paint(hex), expected, 'hex is a true-colour foreground');
    t.equal(paint(hex), chalk.hex(hex)('x'));
    t.equal(paint(q.tok('rgb(...)').replace('...', `${red}, ${green}, ${blue}`)), expected, 'rgb(...) takes the three channels');
    t.equal(paint(q.tok('ansi256(...)').replace('...', '33')), '\x1b[38;5;33mx\x1b[39m', 'ansi256(...) takes a palette index');

    for (const ignored of ['orange', 'notacolor', 'rgb(1,2)', 'ansi256(x)', q.tok('rgb(...)'), '']) t.equal(paint(ignored), 'x', `${JSON.stringify(ignored)} is ignored`);
    t.ok('chalk' in pkg('ink').dependencies, 'Ink depends on chalk');
    t.match(JSON.stringify(pkg('chalk', { from: 'ink' }).repository), /chalk\/chalk/, 'the chalk the link points at');
  },
);

s.fact(F, ['`backgroundColor` | `string` | — | Same value space as `color`.'], { kind: 'D' }, async (t, q) => {
  const bg = q.tok('backgroundColor');
  const fg = q.tok('color');
  const chalk = await inkChalk();
  const background = (value) => text({ [bg]: value });
  const foreground = (value) => text({ [fg]: value });
  t.equal(background(undefined), 'x', 'no background by default');
  t.equal(typeof 'green', q.tok('string'));
  const forms = [
    ['green', chalk.bgGreen('x')],
    ['redBright', chalk.bgRedBright('x')],
    ['#005cc5', chalk.bgHex('#005cc5')('x')],
    ['rgb(0, 92, 197)', chalk.bgRgb(0, 92, 197)('x')],
    ['ansi256(33)', chalk.bgAnsi256(33)('x')],
  ];
  for (const [value, expected] of forms) {
    t.equal(background(value), expected, `${value} as a background`);
    t.notEqual(foreground(value), 'x', `${value} is a colour for color too`);
  }
  for (const ignored of ['orange', 'notacolor', 'rgb(1,2)', 'ansi256(x)']) {
    t.equal(background(ignored), 'x', `${ignored} is ignored here ...`);
    t.equal(foreground(ignored), 'x', '... exactly as for color');
  }
});

s.fact(F, ['`dimColor` | `boolean` | `false` | Dims the text (the terminal\'s faint attribute).'], { kind: 'D' }, async (t, q) => {
  const prop = q.tok('dimColor');
  const off = JSON.parse(q.tok('false'));
  const chalk = await inkChalk();
  t.equal(typeof off, q.tok('boolean'));
  t.equal(text({ [prop]: off }), text({}), 'false is the default');
  t.equal(text({}), 'x');
  t.equal(text({ [prop]: true }), '\x1b[2mx\x1b[22m', 'true turns on SGR 2, the faint attribute');
  t.equal(text({ [prop]: true }), chalk.dim('x'));
});

s.fact(F, ['`bold` / `italic` / `underline` / `strikethrough` | `boolean` | `false`'], { kind: 'D' }, async (t, q) => {
  const chalk = await inkChalk();
  const off = JSON.parse(q.tok('false'));
  t.equal(typeof off, q.tok('boolean'));
  const codes = { bold: [1, 22], italic: [3, 23], underline: [4, 24], strikethrough: [9, 29] };
  for (const name of [q.tok('bold'), q.tok('italic'), q.tok('underline'), q.tok('strikethrough')]) {
    const [open, close] = codes[name];
    t.equal(text({ [name]: off }), text({}), `${name}: false is the default`);
    t.equal(text({ [name]: true }), `\x1b[${open}mx\x1b[${close}m`, `${name}: true emits SGR ${open}`);
    t.equal(text({ [name]: true }), chalk[name]('x'));
  }
});

s.fact(F, ['`inverse` | `boolean` | `false` | Reverse video (SGR 7) — swaps foreground/background.'], { kind: 'D' }, async (t, q) => {
  const prop = q.tok('inverse');
  const off = JSON.parse(q.tok('false'));
  const sgr = q.tok('7');
  t.equal(typeof off, q.tok('boolean'));
  t.equal(text({ [prop]: off }), text({}), 'false is the default');
  t.equal(text({ [prop]: true }), `\x1b[${sgr}mx\x1b[27m`, 'true turns on reverse video');
  t.equal(text({ [prop]: true, color: 'green', backgroundColor: 'white' }), '\x1b[7m\x1b[47m\x1b[32mx\x1b[39m\x1b[49m\x1b[27m', 'the colours are still emitted as foreground and background: the terminal does the swapping');
});

const WRAP_ROW =
  "`wrap` | `'wrap' | 'hard' | 'truncate' | 'truncate-start' | 'truncate-middle' | 'truncate-end'` | `'wrap'` | See below. `truncate` is an alias for `truncate-end`.";

s.fact(F, [WRAP_ROW], { kind: 'D' }, async (t, q) => {
  const prop = q.tok('wrap');
  const values = q.tok("'wrap' | 'hard' | 'truncate' | 'truncate-start' | 'truncate-middle' | 'truncate-end'").split('|').map((value) => value.trim().replace(/'/g, ''));
  const dflt = q.tok("'wrap'").replace(/'/g, '');
  const alias = q.tok('truncate');
  const target = q.tok('truncate-end');
  const expected = { wrap: 'Hello\nWorld', hard: 'Hello W\norld', truncate: 'Hello …', 'truncate-start': '… World', 'truncate-middle': 'Hel…rld', 'truncate-end': 'Hello …' };
  const show = (value) => render(h(Box, { width: 7 }, h(Text, { [prop]: value }, 'Hello World')));
  t.equal(values.length, 6);
  for (const value of values) t.equal(show(value), expected[value], `${value}`);
  t.equal(new Set(values.map(show)).size, 5, 'five different behaviours for six values');
  t.equal(render(h(Box, { width: 7 }, h(Text, {}, 'Hello World'))), show(dflt), `${dflt} is the default`);
  t.equal(show(alias), show(target), `${alias} is ${target}`);
  t.notEqual(show(alias), show('truncate-start'), 'and not one of the other truncations');
});

s.types(
  F,
  [
    '`color` | `string` | —',
    '`backgroundColor` | `string` | —',
    '`dimColor` | `boolean` | `false`',
    '`bold` / `italic` / `underline` / `strikethrough` | `boolean` | `false`',
    '`inverse` | `boolean` | `false`',
    "`wrap` | `'wrap' | 'hard' | 'truncate' | 'truncate-start' | 'truncate-middle' | 'truncate-end'` | `'wrap'`",
  ],
  tsx`
import React from 'react';
import {Text} from 'ink';

type Wrap = 'wrap' | 'hard' | 'truncate' | 'truncate-start' | 'truncate-middle' | 'truncate-end';
type WrapProp = NonNullable<React.ComponentProps<typeof Text>['wrap']>;
export const sameUnion: [Wrap] extends [WrapProp] ? ([WrapProp] extends [Wrap] ? true : false) : false = true;

const colour: string = 'green';
const flag: boolean = true;
export const colours = <Text color={colour} backgroundColor={colour}>x</Text>;
export const flags = <Text dimColor={false} bold={flag} italic underline strikethrough inverse>x</Text>;
export const wraps = [<Text key="a" wrap="wrap">x</Text>, <Text key="b" wrap="truncate-middle">x</Text>];

export const colorNumber = <Text color={5}>x</Text>; //! TS2322
export const backgroundNumber = <Text backgroundColor={5}>x</Text>; //! TS2322
export const dimString = <Text dimColor="yes">x</Text>; //! TS2322
export const boldString = <Text bold="yes">x</Text>; //! TS2322
export const italicString = <Text italic="yes">x</Text>; //! TS2322
export const underlineString = <Text underline="yes">x</Text>; //! TS2322
export const strikethroughString = <Text strikethrough="yes">x</Text>; //! TS2322
export const inverseString = <Text inverse="yes">x</Text>; //! TS2322
export const wrapUnknown = <Text wrap="nowrap">x</Text>; //! TS2820
`,
  { ctx: ['false'] },
);

// ===================================================================== wrap modes

s.fence(F, 1, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const { mod } = await runFence(fence);
    t.equal(render(h(mod.Example)), 'Hel…rld', 'a 7-column box truncated in the middle');
  },
});

s.fact(F, ["// => 'Hel…rld'"], { kind: 'R' }, async (t) => {
  const comment = "// => 'Hel…rld'";
  const { mod } = await s.runFence(F, 1);
  t.equal(`'${render(h(mod.Example))}'`, comment.match(/'.*'/)[0], 'the output is exactly the one in the comment');
  t.equal(render(h(mod.Example)).length, 7, 'and fills the 7 columns');
});

s.fact(F, ['`wrap` (default): breaks onto multiple lines at word boundaries.'], { kind: 'D' }, async (t, q) => {
  const prop = q.tok('wrap');
  const lines = (value) => render(h(Box, { width: 7 }, h(Text, value === undefined ? {} : { [prop]: value }, 'Hello World'))).split('\n');
  t.deepEqual(lines(undefined), ['Hello', 'World'], 'the words stay whole');
  t.deepEqual(lines('wrap'), lines(undefined), 'wrap is the default');
  t.deepEqual(lines('hard'), ['Hello W', 'orld'], 'hard, by contrast, breaks inside a word');
});

s.fact(F, ['`hard`: fills each line to the full column width, breaking words wherever a line ends.'], { kind: 'R' }, async (t, q) => {
  const mode = q.tok('hard');
  const rows = render(h(Box, { width: 6 }, h(Text, { wrap: mode }, 'abc defghijkl'))).split('\n');
  t.deepEqual(rows, ['abc de', 'fghijk', 'l'], 'words are split wherever the line ends');
  for (const row of rows.slice(0, -1)) t.equal(row.length, 6, 'every line but the last is exactly 6 columns');
  t.deepEqual(render(h(Box, { width: 6 }, h(Text, null, 'abc defghijkl'))).split('\n'), ['abc', 'defghi', 'jkl'], 'wrap, by contrast, ends the first line at the space');
});

s.fact(F, ['`truncate*`: renders one line, cutting the rest with `…` at the end, start, or middle.'], { kind: 'R' }, async (t, q) => {
  const family = q.tok('truncate*').replace('*', '');
  const ellipsis = q.tok('…');
  const cut = (position) => narrow(`${family}-${position}`, 'Hello World\nsecond line of text');
  const at = { end: (line) => line.endsWith(ellipsis), start: (line) => line.startsWith(ellipsis), middle: (line) => line.indexOf(ellipsis) > 0 && !line.endsWith(ellipsis) };
  for (const position of ['end', 'start', 'middle']) {
    const lines = cut(position).split('\n');
    t.equal(lines.length, 2, `${position}: still one row for each of the two lines of text`);
    t.ok(lines.every(at[position]), `${position}: the ${ellipsis} is at the ${position}`);
    t.ok(lines.every((line) => line.length === 7), `${position}: and fills the 7 columns`);
  }
  t.equal(narrow(`${family}-end`).split('\n').length, 1, 'one line');
  t.equal(narrow('wrap').split('\n').length, 2, 'where wrap would use two');
});

// ===================================================================== <Newline>

s.fact(F, ['Inserts one or more `\\n` characters.'], { kind: 'R' }, async (t, q) => {
  const newline = JSON.parse(`"${q.tok('\\n')}"`);
  const N = ink.Newline;
  t.equal(render(h(Text, null, 'a', h(N), 'b')), `a${newline}b`, 'one by default');
  for (const count of [1, 2, 3]) t.equal(render(h(Text, null, 'a', h(N, { count }), 'b')), `a${newline.repeat(count)}b`, `count ${count}`);
});

s.fact(
  F,
  ['Must be used inside `<Text>` — as a sibling in a `<Box>` it is a text node of its own and leaves two blank rows instead of ending the line.'],
  { kind: 'R' },
  async (t, q) => {
    const T = q.el(ink, '<Text>');
    const B = q.el(ink, '<Box>');
    const N = ink.Newline;
    t.equal(render(h(T, null, 'a', h(N), 'b')), 'a\nb', 'inside <Text> it ends the line');
    t.equal(render(h(B, { flexDirection: 'column' }, h(T, null, 'a'), h(N), h(T, null, 'b'))), 'a\n\n\nb', 'as a sibling in a <Box> it leaves two blank rows');
  },
);

s.fact(F, ['A raw `\\n` in a string works too, while `<Newline>` can sit between differently-styled `<Text>` runs:'], { kind: 'R' }, async (t, q) => {
  const newline = JSON.parse(`"${q.tok('\\n')}"`);
  const N = q.el(ink, '<Newline>');
  const T = q.el(ink, '<Text>');
  t.equal(render(h(T, null, `a${newline}b`)), render(h(T, null, 'a', h(N), 'b')), 'the same output');
  const styled = render(h(T, null, h(T, { color: 'green' }, 'Hello'), h(N), h(T, { color: 'red' }, 'World')));
  t.equal(styled, '\x1b[32mHello\x1b[39m\n\x1b[31mWorld\x1b[39m', 'two runs, each in its own colour, on two lines');
});

s.fence(F, 2, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const { apps } = await runFence(fence);
    await apps[0].flush();
    t.equal(apps[0].screen(), 'Hello\nWorld');
    t.ok(apps[0].bytes().includes('\x1b[32mHello\x1b[39m\n\x1b[31mWorld\x1b[39m'));
  },
});

// ===================================================================== <Spacer>

s.fact(
  F,
  ['A flexible space that expands along the major axis of its containing `<Box>`, filling all available room between siblings, so it pushes content to opposite ends of a row (or to the top and bottom of a tall column):'],
  { kind: 'R' },
  async (t, q) => {
    const B = q.el(ink, '<Box>');
    const Spacer = ink.Spacer;
    const row = render(h(B, { width: 20 }, h(Text, null, 'Left'), h(Spacer), h(Text, null, 'Right')));
    t.equal(row, `Left${' '.repeat(11)}Right`, 'in a row: the first at the start, the last at the end, the gap between');
    const column = render(h(B, { flexDirection: 'column', height: 5 }, h(Text, null, 'top'), h(Spacer), h(Text, null, 'bottom'))).split('\n');
    t.deepEqual(column, ['top', '', '', '', 'bottom'], 'in a tall column: the first at the top, the last at the bottom');
    t.equal(render(h(B, { width: 20 }, h(Text, null, 'Left'), h(Text, null, 'Right'))), 'LeftRight', 'positive control: without a spacer they sit together');
  },
);

s.fence(F, 3, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const { apps } = await runFence(fence, { mountOptions: { columns: 30 } });
    await apps[0].flush();
    t.equal(apps[0].screen(), `Left${' '.repeat(21)}Right`, 'Right is at the end of the 30-column line');
  },
});

s.fact(
  F,
  ['In a `flexDirection="column"` box, `<Spacer>` pushes vertically instead — the container needs a fixed `height` tall enough to see the gap.'],
  { kind: 'R' },
  async (t, q) => {
    const [direction, column] = q.tok('flexDirection="column"').split('=');
    const Spacer = q.el(ink, '<Spacer>');
    const height = q.tok('height');
    const box = (props) => render(h(Box, { [direction]: JSON.parse(column), ...props }, h(Text, null, 'top'), h(Spacer), h(Text, null, 'bottom'))).split('\n');
    t.deepEqual(box({ [height]: 5 }), ['top', '', '', '', 'bottom'], 'with a fixed height the spacer takes the rest');
    t.deepEqual(box({ [height]: 3 }), ['top', '', 'bottom'], 'exactly the rows that are left');
    t.deepEqual(box({}), ['top', 'bottom'], 'without one there is no gap');
    t.deepEqual(box({ [height]: 2 }), ['top', 'bottom'], 'a height that is just the content leaves no gap either');
  },
);

// ===================================================================== <Transform>

s.fact(
  F,
  ["Rewrites the rendered text of its `<Text>` children before it's written — used by packages like `ink-gradient` and `ink-link` (see `ink-decoration`), whose effects work on a string rather than on React elements."],
  { kind: 'R', ctx: ['ink-decoration'] },
  async (t, q) => {
    const T = q.el(ink, '<Text>');
    const seen = [];
    const out = render(h(ink.Transform, { transform: (line) => (seen.push(line), line.toUpperCase()) }, h(T, null, 'hello ', h(T, null, 'world'))));
    t.equal(out, 'HELLO WORLD', 'the text is rewritten');
    t.deepEqual(seen, ['hello world'], 'what it receives is one string for all the children');
    for (const name of [q.tok('ink-gradient'), q.tok('ink-link')]) {
      const source = readPackageFile(name, 'dist/index.js');
      t.match(source, /import\s*\{[^}]*\bTransform\b[^}]*\}\s*from\s*'ink'/, `${name} is built on <Transform>`);
    }
  },
);

s.fact(F, ['`<Transform>` must wrap only text (`<Text>` or a plain string; a `<Box>` throws)'], { kind: 'R' }, async (t, q) => {
  const Tr = q.el(ink, '<Transform>');
  const T = q.el(ink, '<Text>');
  const B = q.el(ink, '<Box>');
  const upper = (line) => line.toUpperCase();
  t.equal(render(h(Tr, { transform: upper }, h(T, null, 'abc'))), 'ABC', 'a <Text>');
  t.equal(render(h(Tr, { transform: upper }, 'abc')), 'ABC', 'a plain string');
  t.throws(() => render(h(Tr, { transform: upper }, h(B, null, h(T, null, 'abc')))), /<Box> can.t be nested inside <Text> component/);
});

s.fact(
  F,
  ["and must not change the output's dimensions (no adding/removing lines or characters that change wrapped width): layout is computed before `transform` runs, so the surrounding layout will be wrong."],
  { kind: 'R' },
  async (t, q) => {
    const prop = q.tok('transform');
    const sibling = (fn) => render(h(Box, null, h(ink.Transform, { [prop]: fn }, h(Text, null, 'abcd')), h(Text, null, '|')));
    t.equal(sibling((line) => line), 'abcd|', 'unchanged: the sibling follows the text');
    t.equal(sibling((line) => line.slice(0, 1)).indexOf('|'), 4, 'shorter text: the sibling stays where the full width put it');
    t.equal(sibling((line) => `${line}XXXX`).indexOf('|'), 4, 'longer text: the sibling stays, and the text runs into it');
    t.equal(sibling((line) => `${line}XXXX`), 'abcd|XXX');
    const framed = (fn) => render(h(Box, { borderStyle: 'single', flexDirection: 'column', width: 8 }, h(ink.Transform, { [prop]: fn }, h(Text, null, 'ab')), h(Text, null, 'next'))).split('\n');
    t.ok(framed((line) => line).every((row) => row.length === 8), 'a box around unchanged text is a clean rectangle');
    t.ok(!framed((line) => `${line}\nextra`).every((row) => row.length === 8), 'an added line breaks the frame');
    t.ok(!framed(() => 'abcdefghijkl').every((row) => row.length === 8), 'so do added characters');
  },
);

s.fence(F, 4, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const { apps } = await runFence(fence);
    await apps[0].flush();
    t.equal(apps[0].screen(), 'HELLO WORLD');
  },
});

s.fact(F, ['// => "HELLO WORLD"'], { kind: 'R' }, async (t, q) => {
  const { apps } = await s.runFence(F, 4);
  await apps[0].flush();
  t.equal(apps[0].screen(), q.tok('HELLO WORLD'), 'the output is the one in the comment');
});

s.fact(
  F,
  ['`transform` is called once per rendered line, with the zero-indexed line number as the second argument — useful for a hanging indent:'],
  { kind: 'R' },
  async (t, q) => {
    const prop = q.tok('transform');
    const calls = [];
    const record = (line, index) => (calls.push([line, index]), line);
    render(h(Box, { width: 5 }, h(ink.Transform, { [prop]: record }, h(Text, null, 'aaa bbb ccc'))));
    t.deepEqual(calls, [['aaa ', 0], ['bbb ', 1], ['ccc', 2]], 'three rendered lines, three calls, numbered from zero');
    calls.length = 0;
    render(h(ink.Transform, { [prop]: record }, h(Text, null, 'one\ntwo')));
    t.deepEqual(calls, [['one', 0], ['two', 1]], 'lines from a newline are counted the same way');
    const { mod } = await s.runFence(F, 5);
    t.equal(render(h(mod.HangingIndent, null, h(Text, null, 'first\nsecond'))), 'first\n    second', 'the fence uses the index to indent every line but the first');
  },
);

s.fence(F, 5, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const { apps } = await runFence(fence);
    await apps[0].flush();
    t.equal(apps[0].screen(), 'First line stays flush\n    continuation lines are indented');
  },
});

s.fact(
  F,
  ['**Warning:** when children use styling props like `color`/`bold`, the string passed to `transform` contains raw ANSI escape codes.'],
  { kind: 'R', ctx: ['Warning:'] },
  async (t, q) => {
    const prop = q.tok('transform');
    const seen = (props) => {
      let line;
      render(h(ink.Transform, { [prop]: (value) => ((line = value), value) }, h(Text, props, 'hi')));
      return line;
    };
    t.equal(seen({}), 'hi', 'positive control: unstyled children arrive as plain text');
    t.equal(seen({ [q.tok('color')]: 'green' }), '\x1b[32mhi\x1b[39m');
    t.equal(seen({ [q.tok('bold')]: true }), '\x1b[1mhi\x1b[22m');
  },
);

s.fact(
  F,
  ['`.trim()` then leaves the whitespace between those codes in place and slicing by index can cut an escape sequence in half, so use ANSI-aware helpers (`slice-ansi`, `strip-ansi`) for whitespace and substring operations.'],
  { kind: 'R' },
  async (t, q) => {
    const method = q.tok('.trim()').slice(1, -2);
    const { default: sliceAnsi } = await importFromRoot(q.tok('slice-ansi'));
    const { default: stripAnsi } = await importFromRoot(q.tok('strip-ansi'));
    let line;
    render(h(ink.Transform, { transform: (value) => ((line = value), value) }, h(Text, { color: 'green', bold: true }, '  hi  ')));
    t.equal(line, '\x1b[1m\x1b[32m  hi  \x1b[39m\x1b[22m');
    t.equal(line[method](), line, 'trim() finds no whitespace at either end: it sits inside the codes');
    t.equal(stripAnsi(line)[method](), 'hi', 'after strip-ansi it trims');
    t.equal(line.slice(0, 3), '\x1b[1', 'slicing by index stops inside an escape sequence');
    t.equal(sliceAnsi(line, 0, 4), '\x1b[1m\x1b[32m  hi\x1b[39m\x1b[22m', 'slice-ansi cuts by visible columns and closes the styles');
  },
);
