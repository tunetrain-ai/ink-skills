// Claims for skills/core/ink-borders-and-backgrounds/SKILL.md.
import cliBoxes from 'cli-boxes';
import { skill, tsx, ink, h, mount, pkg, stripAnsi } from '../lib/index.mjs';
import { pick } from './ink-layout.helpers.mjs';
import { paint, textOf, sgrOf, render, box } from './ink-borders-and-backgrounds.helpers.mjs';

const { Box, Text } = ink;
const s = skill('ink-borders-and-backgrounds');
const F = 'SKILL.md';

const WIDTH = 7;
/** An element as wide as its content: inside a row, a <Box> is no wider than what it holds. */
const shrunk = (element) => h(Box, null, element);
/** Cells of a bordered `x` box that is WIDTH columns wide and three rows tall, by edge. Corners belong to the top and bottom rows. */
const edgesOf = (props, text = 'x') => {
  const rows = paint(box(props, text, WIDTH));
  const middle = rows.slice(1, -1);
  return { rows, top: rows[0], bottom: rows.at(-1), left: middle.map((row) => row[0]), right: middle.map((row) => row.at(-1)), inside: middle.flatMap((row) => row.slice(1, -1)) };
};
const EDGES = ['top', 'right', 'bottom', 'left'];
const border = (edges) => EDGES.flatMap((name) => edges[name]);
const unique = (cells, field) => [...new Set(cells.map((cell) => cell[field]))];
/** The edge a per-edge prop is about: `borderTopColor` → 'top'. */
const edgeOfProp = (prop) => prop.match(/^border(Top|Right|Bottom|Left)/)[1].toLowerCase();
/** What a rendered box looks like without its colours. */
const shape = (props, text, columns = WIDTH) => stripAnsi(box(props, text, columns));

// ===================================================================== frontmatter

s.fact(F, ["Add borders and background colors to Ink's <Box> — borderStyle presets (single, double, round, bold, classic), custom border glyphs, per-edge borderColor/borderDimColor/borderBackgroundColor, showing/hiding individual edges, and backgroundColor fill and inheritance."], { kind: 'R' }, async (t) => {
  for (const preset of ['single', 'double', 'round', 'bold', 'classic']) t.equal(shape({ borderStyle: preset }, 'x', 3).split('\n')[0], `${cliBoxes[preset].topLeft}${cliBoxes[preset].top}${cliBoxes[preset].topRight}`, `${preset} is a preset`);
  t.equal(shape({ borderStyle: { ...cliBoxes.single, topLeft: '1' } }, 'x', 3).split('\n')[0], '1─┐', 'custom border glyphs');
  const colored = edgesOf({ borderStyle: 'single', borderTopColor: 'red', borderBottomDimColor: true, borderLeftBackgroundColor: 'blue', borderRight: false });
  t.deepEqual(unique(colored.top, 'fg'), [sgrOf('red')], 'per-edge colour');
  t.deepEqual(unique(colored.bottom, 'dim'), [true], 'per-edge dimming');
  t.deepEqual(unique(colored.left, 'bg'), [sgrOf('blue', 'bg')], 'per-edge border background');
  t.ok(!textOf(colored.top).endsWith(cliBoxes.single.topRight), 'hiding an edge');
  const filled = paint(box({ backgroundColor: 'green', width: 4 }, 'x', 10));
  t.deepEqual(unique(filled[0], 'bg'), [sgrOf('green', 'bg')], 'backgroundColor fill');
  t.deepEqual(unique(paint(render(h(Box, { backgroundColor: 'green' }, h(Text, null, 'x'))))[0], 'bg'), [sgrOf('green', 'bg')], 'inherited by the text');
});

s.guidance(F, ['Use when the user wants a bordered panel, box background, or custom box-drawing characters.'], 'a routing hint saying when to load the skill; it asserts nothing about Ink');

// ===================================================================== border style

s.fact(F, ['`borderStyle` adds a border; unset (the default) means no border.'], { kind: 'D' }, async (t, q) => {
  const prop = q.tok('borderStyle');
  t.equal(box({}), 'x', 'with nothing set there is no border');
  t.equal(box({ [prop]: undefined }), 'x', 'unset is the same');
  t.equal(shape({ [prop]: 'single' }, 'x', 3), '┌─┐\n│x│\n└─┘', 'setting it adds one');
  t.equal(shape({ [prop]: 'single' }, 'x', 3).split('\n').length - box({}).split('\n').length, 2, 'two rows taller');
});

s.fact(F, ['Presets come from [`cli-boxes`](https://github.com/sindresorhus/cli-boxes): `single`, `double`, `round`, `bold`, `singleDouble`, `doubleSingle`, `classic`, `arrow`.'], { kind: 'D' }, async (t, q) => {
  const library = q.tok('cli-boxes');
  const names = ['single', 'double', 'round', 'bold', 'singleDouble', 'doubleSingle', 'classic', 'arrow'].map((name) => q.tok(name));
  t.ok(pkg('ink').dependencies[library], 'Ink depends on cli-boxes');
  t.match('https://github.com/sindresorhus/cli-boxes', new RegExp(`${pkg(library).repository}$`), 'the link is to its repository');
  t.deepEqual([...names].sort(), Object.keys(cliBoxes).sort(), 'the presets are exactly the ones it defines');
  const looks = new Set();
  for (const name of names) {
    const glyphs = cliBoxes[name];
    const expected = [`${glyphs.topLeft}${glyphs.top.repeat(4)}${glyphs.topRight}`, `${glyphs.left}x${' '.repeat(3)}${glyphs.right}`, `${glyphs.bottomLeft}${glyphs.bottom.repeat(4)}${glyphs.bottomRight}`].join('\n');
    t.equal(shape({ borderStyle: name }, 'x', 6), expected, `${name} draws the glyphs cli-boxes defines for it`);
    looks.add(expected);
  }
  t.equal(looks.size, names.length, 'and each looks different');
});

s.types(F, ['Presets come from [`cli-boxes`](https://github.com/sindresorhus/cli-boxes): `single`, `double`, `round`, `bold`, `singleDouble`, `doubleSingle`, `classic`, `arrow`.'], tsx`
import React from 'react';
import {Box} from 'ink';

export const single = <Box borderStyle="single" />;
export const double = <Box borderStyle="double" />;
export const round = <Box borderStyle="round" />;
export const bold = <Box borderStyle="bold" />;
export const singleDouble = <Box borderStyle="singleDouble" />;
export const doubleSingle = <Box borderStyle="doubleSingle" />;
export const classic = <Box borderStyle="classic" />;
export const arrow = <Box borderStyle="arrow" />;
export const unknown = <Box borderStyle="dotted" />; //! TS2322
`, { ctx: ['cli-boxes'] });

s.fence(F, 0, {
  run: async (t) => {
    const { mod } = await s.runFence(F, 0);
    t.equal(stripAnsi(render(shrunk(h(mod.Example)), 20)), '╭─────╮\n│round│\n╰─────╯', 'a round border around the text');
    t.equal(stripAnsi(render(h(Box, { alignItems: 'center' }, h(mod.Example), h(Text, null, '|')), 20)).split('\n')[1], '│round│  |', 'with 2 columns of margin to its right');
  },
});

s.fact(F, ['Or supply a custom glyph set for every edge/corner (all eight glyphs are required):'], { kind: 'R' }, async (t) => {
  const code = s.fenceOf(F, 1).code;
  const glyphs = Object.fromEntries([...code.matchAll(/^\s*(\w+): '(.)',?$/gm)].map((m) => [m[1], m[2]]));
  t.deepEqual(Object.keys(glyphs).sort(), Object.keys(cliBoxes.single).sort(), 'the fence names every edge and corner a preset has');
  t.equal(Object.keys(glyphs).length, 8, 'eight of them');
  t.equal(shape({ borderStyle: glyphs }, 'x', 4), `${glyphs.topLeft}${glyphs.top.repeat(2)}${glyphs.topRight}\n${glyphs.left}x ${glyphs.right}\n${glyphs.bottomLeft}${glyphs.bottom.repeat(2)}${glyphs.bottomRight}`, 'each glyph is used where its name says');
  for (const name of Object.keys(glyphs)) {
    const { [name]: _omitted, ...rest } = glyphs;
    let widths;
    try {
      widths = shape({ borderStyle: rest }, 'x', 4).split('\n').map((line) => line.length);
    } catch {
      widths = 'throws';
    }
    t.ok(widths === 'throws' || widths.some((width) => width !== 4), `without ${name} the border breaks: ${widths === 'throws' ? 'rendering throws' : 'the string "undefined" is drawn in its place'}`);
  }
});

s.types(F, ['Or supply a custom glyph set for every edge/corner (all eight glyphs are required):'], tsx`
import React from 'react';
import {Box} from 'ink';

export const all = <Box borderStyle={{topLeft: '1', top: '2', topRight: '3', left: '4', bottomLeft: '5', bottom: '6', bottomRight: '7', right: '8'}} />;
export const noTop = <Box borderStyle={{topLeft: '1', topRight: '3', left: '4', bottomLeft: '5', bottom: '6', bottomRight: '7', right: '8'}} />; //! TS2322
export const noRight = <Box borderStyle={{topLeft: '1', top: '2', topRight: '3', left: '4', bottomLeft: '5', bottom: '6', bottomRight: '7'}} />; //! TS2322
`);

s.fence(F, 1, {
  run: async (t) => {
    const { mod } = await s.runFence(F, 1);
    t.equal(render(shrunk(h(mod.Example)), 20), '↘↓↓↓↓↓↓↙\n→Custom←\n↗↑↑↑↑↑↑↖', "the box is drawn with the fence's own glyphs");
  },
});

// ===================================================================== border colour

s.fact(F, ["`borderColor` sets all four edges at once — same value space as `<Text>`'s `color` (named colors, hex, `rgb(...)`)."], { kind: 'R' }, async (t, q) => {
  const borderColor = q.tok('borderColor');
  const Label = q.el(ink, '<Text>');
  const colorProp = q.tok('color');
  const rgb = q.tok('rgb(...)').replace('(...)', '');
  const values = ['green', '#00ff00', `${rgb}(0, 255, 0)`];
  for (const value of values) {
    const expected = sgrOf(value);
    const edges = edgesOf({ borderStyle: 'round', [borderColor]: value });
    for (const name of EDGES) t.deepEqual(unique(edges[name], 'fg'), [expected], `${value}: the ${name} edge`);
    t.deepEqual(unique(edges.inside, 'fg'), [null], `${value}: and nothing inside the border`);
    t.equal(paint(render(h(Label, { [colorProp]: value }, 'x')))[0][0].fg, expected, `${value}: <Text color> writes the same colour`);
  }
  const ignored = edgesOf({ borderStyle: 'round', [borderColor]: 'not-a-colour' });
  t.deepEqual(unique(border(ignored), 'fg'), [null], 'a value outside that space is ignored');
  t.equal(paint(render(h(Label, { [colorProp]: 'not-a-colour' }, 'x')))[0][0].fg, null, 'by <Text> too');
});

s.fence(F, 2, {
  run: async (t) => {
    const { mod } = await s.runFence(F, 2);
    const rows = paint(render(shrunk(h(mod.Example)), 40));
    t.deepEqual(rows.map(textOf), ['╭─────────────────╮', '│Green Rounded Box│', '╰─────────────────╯']);
    t.deepEqual(unique([...rows[0], ...rows[2], rows[1][0], rows[1].at(-1)], 'fg'), [sgrOf('green')], 'a green border');
    t.deepEqual(unique(rows[1].slice(1, -1), 'fg'), [null], 'around plain text');
  },
});

s.fact(F, ['Per-edge overrides: `borderTopColor`, `borderRightColor`, `borderBottomColor`, `borderLeftColor`.'], { kind: 'R' }, async (t, q) => {
  const props = ['borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'].map((name) => q.tok(name));
  const [other, own] = ['green', 'red'];
  for (const prop of props) {
    const edge = edgeOfProp(prop);
    const alone = edgesOf({ borderStyle: 'round', [prop]: own });
    for (const name of EDGES) t.deepEqual(unique(alone[name], 'fg'), [name === edge ? sgrOf(own) : null], `${prop}: the ${name} edge ${name === edge ? 'is' : 'is not'} coloured`);
    const over = edgesOf({ borderStyle: 'round', borderColor: other, [prop]: own });
    for (const name of EDGES) t.deepEqual(unique(over[name], 'fg'), [name === edge ? sgrOf(own) : sgrOf(other)], `${prop} over borderColor: the ${name} edge`);
  }
});

// ===================================================================== dimming and visibility

s.fact(F, ['`borderDimColor` (boolean, default `false`) dims all edges; per-edge variants: `borderTopDimColor`, `borderBottomDimColor`, `borderLeftDimColor`, `borderRightDimColor`.'], { kind: 'D' }, async (t, q) => {
  const general = q.tok('borderDimColor');
  const dflt = JSON.parse(q.tok('false'));
  const variants = ['borderTopDimColor', 'borderBottomDimColor', 'borderLeftDimColor', 'borderRightDimColor'].map((name) => q.tok(name));
  t.equal(typeof dflt, 'boolean', 'a boolean');
  const none = edgesOf({ borderStyle: 'single' });
  t.deepEqual(unique(border(none), 'dim'), [false], 'edges are not dimmed by default');
  t.equal(box({ borderStyle: 'single', [general]: dflt }), box({ borderStyle: 'single' }), 'false is the same as leaving it out');
  const all = edgesOf({ borderStyle: 'single', [general]: true });
  t.deepEqual(unique(border(all), 'dim'), [true], 'true dims all four edges');
  t.deepEqual(unique(all.inside, 'dim'), [false], 'and nothing inside');
  for (const variant of variants) {
    const edge = edgeOfProp(variant);
    const one = edgesOf({ borderStyle: 'single', [variant]: true });
    for (const name of EDGES) t.deepEqual(unique(one[name], 'dim'), [name === edge], `${variant}: the ${name} edge ${name === edge ? 'is' : 'is not'} dimmed`);
    const except = edgesOf({ borderStyle: 'single', [general]: true, [variant]: false });
    for (const name of EDGES) t.deepEqual(unique(except[name], 'dim'), [name !== edge], `${variant}: false takes ${edge} out of borderDimColor`);
  }
});

s.fact(F, ['Each edge can be hidden independently — `borderTop`, `borderRight`, `borderBottom`, `borderLeft` are booleans, default `true`.'], { kind: 'D' }, async (t, q) => {
  const props = ['borderTop', 'borderRight', 'borderBottom', 'borderLeft'].map((name) => q.tok(name));
  const on = JSON.parse(q.tok('true'));
  const whole = shape({ borderStyle: 'single' }, 'x', 4);
  t.equal(whole, '┌──┐\n│x │\n└──┘');
  for (const prop of props) t.equal(shape({ borderStyle: 'single', [prop]: on }, 'x', 4), whole, `${prop}: true is the same as leaving it out`);
  const hidden = (prop) => shape({ borderStyle: 'single', [prop]: false }, 'x', 4);
  const [top, right, bottom, left] = props.map(hidden);
  t.equal(top, '│x │\n└──┘', `${props[0]}: false removes the top row, corners included`);
  t.equal(right, '┌───\n│x\n└───', `${props[1]}: the right column, and the corners that were in it`);
  t.equal(bottom, '┌──┐\n│x │', `${props[2]}: the bottom row`);
  t.equal(left, '───┐\nx  │\n───┘', `${props[3]}: the left column`);
  t.equal(shape({ borderStyle: 'single', [props[0]]: false, [props[1]]: false, [props[2]]: false, [props[3]]: false }, 'x', 4), 'x', 'all four: no border at all');
});

s.fact(F, ["Useful for a divider that only has a bottom rule, or a panel that's visually continuous with an adjacent one."], { kind: 'R' }, async (t) => {
  const divider = (width) => render(h(Box, { borderStyle: 'single', borderTop: false, borderLeft: false, borderRight: false, width }), 12);
  t.equal(divider(8), '────────', 'a box with only its bottom edge is a rule');
  t.equal(divider(11), '─'.repeat(11), 'as wide as the box');
  const stacked = (upper, lower) => render(h(Box, { flexDirection: 'column', width: 7 }, h(Box, { borderStyle: 'round', ...upper }, h(Text, null, 'top')), h(Box, { borderStyle: 'round', ...lower }, h(Text, null, 'low'))));
  const single = render(h(Box, { borderStyle: 'round', flexDirection: 'column', width: 7 }, h(Text, null, 'top'), h(Text, null, 'low')));
  t.equal(single, '╭─────╮\n│top  │\n│low  │\n╰─────╯');
  t.equal(stacked({ borderBottom: false }, { borderTop: false }), single, 'two panels with the shared edges hidden look like one panel');
  t.notEqual(stacked({}, {}), single, 'positive control: with every edge there is a rule between them');
});

// ===================================================================== border background

s.fact(F, ["`borderBackgroundColor` fills the border glyphs themselves (not the box interior — that's plain `backgroundColor`, below)."], { kind: 'R' }, async (t, q) => {
  const borderBg = q.tok('borderBackgroundColor');
  const bg = q.tok('backgroundColor');
  const onBorder = edgesOf({ borderStyle: 'round', [borderBg]: 'green' });
  t.deepEqual(unique(border(onBorder), 'bg'), [sgrOf('green', 'bg')], 'every border glyph gets the background');
  t.deepEqual(unique(onBorder.inside, 'bg'), [null], 'and the interior does not');
  const onBox = edgesOf({ borderStyle: 'round', [bg]: 'green' });
  t.deepEqual(unique(onBox.inside, 'bg'), [sgrOf('green', 'bg')], 'backgroundColor is what fills the interior');
  t.deepEqual(unique(border(onBox), 'bg'), [null], 'and it leaves the border glyphs alone');
});

s.fact(F, ['Per-edge overrides (`borderTopBackgroundColor`, `borderBottomBackgroundColor`, `borderRightBackgroundColor`, `borderLeftBackgroundColor`) fall back to `borderBackgroundColor` when not set.'], { kind: 'R' }, async (t, q) => {
  const props = ['borderTopBackgroundColor', 'borderBottomBackgroundColor', 'borderRightBackgroundColor', 'borderLeftBackgroundColor'].map((name) => q.tok(name));
  const general = q.tok('borderBackgroundColor');
  const [fallback, own] = ['green', 'red'];
  for (const prop of props) {
    const edge = edgeOfProp(prop);
    const alone = edgesOf({ borderStyle: 'round', [prop]: own });
    for (const name of EDGES) t.deepEqual(unique(alone[name], 'bg'), [name === edge ? sgrOf(own, 'bg') : null], `${prop} alone: the ${name} edge ${name === edge ? 'has' : 'has no'} background`);
    const over = edgesOf({ borderStyle: 'round', [general]: fallback, [prop]: own });
    for (const name of EDGES) t.deepEqual(unique(over[name], 'bg'), [name === edge ? sgrOf(own, 'bg') : sgrOf(fallback, 'bg')], `${prop} over borderBackgroundColor: the ${name} edge ${name === edge ? 'is overridden' : 'falls back'}`);
  }
});

s.fence(F, 3, {
  run: async (t) => {
    const { mod } = await s.runFence(F, 3);
    const rows = paint(render(shrunk(h(mod.Example)), 40));
    t.deepEqual(rows.map(textOf), ['╭───────────╮', '│Hello world│', '╰───────────╯']);
    const glyphs = [...rows[0], ...rows[2], rows[1][0], rows[1].at(-1)];
    t.deepEqual(unique(glyphs, 'fg'), [sgrOf('white')], 'a white border');
    t.deepEqual(unique(glyphs, 'bg'), [sgrOf('green', 'bg')], 'on a green background');
    t.deepEqual(unique(rows[1].slice(1, -1), 'bg'), [null], 'around text that has none');
  },
});

// ===================================================================== background

s.fact(F, ['`backgroundColor` fills the whole `<Box>`, inside any border, and is **inherited by child `<Text>` components** unless a child sets its own `backgroundColor`:'], { kind: 'R' }, async (t, q) => {
  const prop = q.tok('backgroundColor');
  const Container = q.el(ink, '<Box>');
  const [, inheriting] = q.tok('inherited by child `<Text>` components').match(/^inherited by child `(<Text>)` components$/);
  const Label = q.el(ink, inheriting);
  const [parent, own] = ['blue', 'yellow'];
  // fills the whole box: more cells than its text
  const sized = paint(render(h(Container, { [prop]: parent, width: 6, height: 2 }, h(Label, null, 'x')), 20));
  t.deepEqual(sized.map((row) => row.length), [6, 6], 'a 6 × 2 box has 12 cells');
  t.deepEqual(unique(sized.flat(), 'bg'), [sgrOf(parent, 'bg')], 'every one of them has the background');
  // inside any border
  const bordered = edgesOf({ borderStyle: 'single', [prop]: parent });
  t.deepEqual(unique(bordered.inside, 'bg'), [sgrOf(parent, 'bg')], 'inside a border it fills the interior');
  t.deepEqual(unique(border(bordered), 'bg'), [null], 'and not the border');
  // inherited by Text, at any depth, unless a child sets its own
  const cells = paint(render(h(Container, { [prop]: parent, alignSelf: 'flex-start' }, h(Label, null, 'ab'), h(Label, { [prop]: own }, 'cd'), h(Container, null, h(Label, null, 'ef'))), 20))[0];
  const bgOf = (text) => unique(cells.filter((cell, i) => textOf(cells).indexOf(text) <= i && i < textOf(cells).indexOf(text) + text.length), 'bg');
  t.deepEqual(bgOf('ab'), [sgrOf(parent, 'bg')], 'a child <Text> has the box background');
  t.deepEqual(bgOf('cd'), [sgrOf(own, 'bg')], 'unless it sets its own');
  t.deepEqual(bgOf('ef'), [sgrOf(parent, 'bg')], 'and so does one in a nested <Box>, after the one that overrode it');
});

s.fence(F, 4, {
  run: async (t) => {
    const { mod } = await s.runFence(F, 4);
    const cells = paint(render(h(mod.Example), 60))[0];
    const part = (text) => {
      const at = textOf(cells).indexOf(text);
      return unique(cells.slice(at, at + text.length), 'bg');
    };
    t.equal(textOf(cells), 'Blue inherited Yellow override Blue inherited again');
    t.deepEqual(part('Blue inherited '), [sgrOf('blue', 'bg')], 'the first text has the box background');
    t.deepEqual(part('Yellow override '), [sgrOf('yellow', 'bg')], 'the second its own');
    t.deepEqual(part('Blue inherited again'), [sgrOf('blue', 'bg')], 'the third the box background again');
  },
});

s.fact(F, ['Backgrounds compose with borders and padding — the fill applies to the padded interior, inside the border:'], { kind: 'R' }, async (t) => {
  const { mod } = await s.runFence(F, 5);
  const rows = paint(render(h(mod.Example), 60));
  const text = 'Background with border and padding';
  t.deepEqual(rows.map(textOf), [`╭${'─'.repeat(text.length + 2)}╮`, `│${' '.repeat(text.length + 2)}│`, `│ ${text} │`, `│${' '.repeat(text.length + 2)}│`, `╰${'─'.repeat(text.length + 2)}╯`], 'a border, one row and one column of padding, the text');
  const interior = rows.slice(1, -1).flatMap((row) => row.slice(1, -1));
  t.deepEqual(unique(interior, 'bg'), [sgrOf('cyan', 'bg')], 'the whole padded interior has the background');
  t.deepEqual(unique([...rows[0], ...rows.at(-1), ...rows.slice(1, -1).flatMap((row) => [row[0], row.at(-1)])], 'bg'), [null], 'the border does not');
});

s.fence(F, 5, {
  run: async (t) => {
    const { mod } = await s.runFence(F, 5);
    t.equal(typeof mod.Example, 'function');
    const out = stripAnsi(render(h(mod.Example), 60));
    t.equal(out.split('\n').length, 5, 'text, padding and border');
  },
});
