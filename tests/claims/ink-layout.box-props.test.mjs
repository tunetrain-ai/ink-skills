// Claims for skills/core/ink-layout/references/box-props.md — one claim per row/sentence.
// Each prop gets (a) a type fixture for the values its row lists and (b) a runtime scene
// proving the documented default and, where the row describes behaviour, that behaviour.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { skill, tsx, ink, h, stripAnsi, ROOT } from '../lib/index.mjs';
import { factTokens } from '../lib/units.mjs';

const { Box, Text, renderToString } = ink;
const s = skill('ink-layout');
const F = 'references/box-props.md';
/** A type claim for a table row: the fixture proves the types; the row's default/note tokens are proven by its runtime claim. */
const typed = (quote, fixture) => s.types(F, [quote], fixture, { ctx: factTokens(quote).filter((tk) => !fixture.includes(tk)) });

const render = (element, columns = 40) => renderToString(element, { columns });
const lines = (out) => out.split('\n');
const txt = (label) => h(Text, { key: label }, label);
/** Render a Box with `props` around plain-text children. */
const scene = (props, ...kids) => render(h(Box, props, ...kids.map(txt)));
/** Rows × columns a single-border box occupies. */
const extent = (out) => {
  const ls = lines(stripAnsi(out));
  const top = ls.findIndex((l) => l.includes('┌'));
  const bottom = ls.findIndex((l) => l.includes('└'));
  return { rows: bottom - top + 1, cols: ls[top].indexOf('┐') - ls[top].indexOf('┌') + 1, top, left: ls[top].indexOf('┌') };
};
/** A bordered child inside a fixed parent — lets a size or position be read off as characters. */
const inParent = (parentProps, childProps, text = 'x') =>
  render(h(Box, { width: 20, height: 8, ...parentProps }, h(Box, { borderStyle: 'single', ...childProps }, h(Text, null, text))));

// --- reading a table row: cells are split on '|' outside backticks
const cells = (row) => {
  const out = [];
  let cur = '';
  let tick = false;
  for (const ch of row) {
    if (ch === '`') tick = !tick;
    if (ch === '|' && !tick) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out.filter((c, i, a) => !((i === 0 || i === a.length - 1) && c === ''));
};
const codes = (cell) => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
const members = (cellOrUnion) => (cellOrUnion.includes('`') ? codes(cellOrUnion)[0] : cellOrUnion).split(' | ');
const literal = (member) => member.replace(/^'|'$/g, '');

/** A type fixture accepting every listed member of `prop` and rejecting one that is not listed. */
function propFixture(prop, typeCell, { wrongValue, extra = '' } = {}) {
  const list = members(typeCell);
  const valid = list.map((m) => (m === 'number' ? '3' : m === 'string' ? '"50%"' : m));
  const lines = [`import {Box} from 'ink';`, `// ${prop}: ${list.join(' | ')}`, ...valid.map((v, i) => `export const ok${i} = <Box ${prop}={${v.startsWith("'") ? v : v.startsWith('"') ? v : v}} />;`)];
  const bad = wrongValue ?? (list.every((m) => m.startsWith("'")) ? "'diagonal'" : 'true');
  lines.push(`export const wrong = <Box ${prop}={${bad}} />; //! TS2322`);
  return `${lines.join('\n')}\n${extra}`;
}

// ============================================================ intro

s.guidance(F, ['All props are optional.'], 'a statement about the optionality of every prop is proven by the per-prop type fixtures below (none of them passes a required prop)');

// ============================================================ dimensions

const dimRow = (name, type, note) => `| \`${name}\` | \`${type}\` | ${note} |`;

typed(dimRow('width', 'number | string', 'Cells, or `"50%"` of the resolved parent width.'), propFixture('width', '`number | string`'));
s.fact(F, [dimRow('width', 'number | string', 'Cells, or `"50%"` of the resolved parent width.')], { kind: 'R' }, async (t, q) => {
  const percent = q.tok('"50%"').replace(/"/g, '');
  q.tok('width');
  q.tok('number | string');
  t.equal(extent(inParent({}, { width: 7 })).cols, 7, 'a number is cells');
  t.equal(extent(inParent({}, { width: percent })).cols, 10, '"50%" is half the 20-column parent');
});

typed(dimRow('height', 'number | string', 'Rows, or `"50%"` of the resolved parent height.'), propFixture('height', '`number | string`'));
s.fact(F, [dimRow('height', 'number | string', 'Rows, or `"50%"` of the resolved parent height.')], { kind: 'R' }, async (t, q) => {
  const percent = q.tok('"50%"').replace(/"/g, '');
  q.tok('height');
  q.tok('number | string');
  t.equal(extent(inParent({}, { height: 5 })).rows, 5, 'a number is rows');
  t.equal(extent(inParent({}, { height: percent })).rows, 4, '"50%" is half the 8-row parent');
});

for (const [name, dim] of [['minWidth', 'cols'], ['maxWidth', 'cols']]) {
  const row = dimRow(name, 'number', 'Number only (cells); percentage strings are a type error.');
  typed(row, tsx`
import {Box} from 'ink';
export const ok = <Box ${name}={10} />;
export const percent = <Box ${name}="50%" />; //! TS2322
`);
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    q.tok(name);
    q.tok('number');
    const out = name === 'minWidth' ? inParent({}, { width: 4, minWidth: 9 }) : inParent({}, { width: 18, maxWidth: 12 });
    t.equal(extent(out)[dim], name === 'minWidth' ? 9 : 12, `${name} is applied in cells`);
  });
}

for (const [name, dimension] of [['minHeight', 'rows'], ['maxHeight', 'rows']]) {
  const row = dimRow(name, 'number | string', 'Percentage supported.');
  typed(row, propFixture(name, '`number | string`'));
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    q.tok(name);
    q.tok('number | string');
    const sized = name === 'minHeight' ? { minHeight: '50%' } : { height: 8, maxHeight: '50%' };
    t.equal(extent(inParent({ alignItems: 'flex-start' }, sized))[dimension], 4, `${name} "50%" resolves against the 8-row parent`);
  });
}

typed('| `aspectRatio` | `number` |', tsx`
import {Box} from 'ink';
export const ok = <Box aspectRatio={2} />;
export const wrong = <Box aspectRatio="2:1" />; //! TS2322
`);
s.fact(F, ['| `aspectRatio` | `number` | width/height. Needs at least one size constraint so Ink can derive the other dimension. |'], { kind: 'R' }, async (t, q) => {
  q.tok('aspectRatio');
  q.tok('number');
  const withWidth = extent(inParent({ alignItems: 'flex-start' }, { width: 12, aspectRatio: 3 }));
  t.equal(withWidth.cols / withWidth.rows, 3, 'ratio is width / height once one dimension is known');
  const unconstrained = extent(inParent({ alignItems: 'flex-start' }, { aspectRatio: 3 }));
  t.notEqual(unconstrained.cols / unconstrained.rows, 3, 'with no size constraint there is nothing to derive the other dimension from');
});

// ---- the fence with an exact rendering
s.fence(F, 0);
s.fact(F, ['// ┌────┐ // │X   │ // └────┘'], { kind: 'R' }, async (t) => {
  const out = render(h(Box, { width: 6, borderStyle: 'single' }, h(Text, null, 'X')));
  t.equal(out, '┌────┐\n│X   │\n└────┘');
});

// ============================================================ padding & margin

for (const kind of ['padding', 'margin']) {
  const Cap = kind[0].toUpperCase() + kind.slice(1);
  const edges = ['Top', 'Bottom', 'Left', 'Right'];
  const sentence = `\`${kind}Top\` / \`${kind}Bottom\` / \`${kind}Left\` / \`${kind}Right\` — each \`number\`, default \`0\`.`;
  const typeFixture = tsx`
import {Box} from 'ink';
${edges.map((e) => `export const ${e.toLowerCase()} = <Box ${kind}${e}={1} />;`).join('\n')}
export const wrong = <Box ${kind}Top="1" />; //! TS2322
`;
  typed(sentence, typeFixture);
  s.fact(F, [sentence], { kind: 'R' }, async (t, q) => {
    for (const e of edges) q.tok(`${kind}${e}`);
    q.tok('number');
    q.tok('0');
    const probe = (props) => {
      const out = render(h(Box, { borderStyle: 'single', width: 9, height: 5 }, h(Box, props, h(Text, null, 'x'))));
      const rows = lines(stripAnsi(out));
      const row = rows.findIndex((l) => l.includes('x'));
      return { row, col: rows[row].indexOf('x') };
    };
    const base = probe({});
    t.deepEqual(probe({ [`${kind}Top`]: 0, [`${kind}Left`]: 0 }), base, 'default 0 changes nothing');
    t.deepEqual(probe({ [`${kind}Top`]: 1 }), { row: base.row + 1, col: base.col }, `${kind}Top moves the text down`);
    t.deepEqual(probe({ [`${kind}Left`]: 2 }), { row: base.row, col: base.col + 2 }, `${kind}Left moves it right`);
    // bottom/right: visible when the box has a size to push against
    const bottom = render(h(Box, { flexDirection: 'column', width: 5 }, h(Box, { [`${kind}Bottom`]: 2 }, h(Text, null, 'a')), h(Text, null, 'z')));
    t.equal(bottom, kind === 'padding' ? 'a\n\n\nz' : 'a\n\n\nz', `${kind}Bottom adds rows below`);
    const right = render(h(Box, { width: 8 }, h(Box, { [`${kind}Right`]: 3 }, h(Text, null, 'a')), h(Text, null, 'z')));
    t.equal(right, 'a   z', `${kind}Right adds columns to the right`);
  });

  const shorthands = kind === 'padding'
    ? 'Shorthands: `paddingX` (left+right), `paddingY` (top+bottom), `padding` (all four).'
    : 'Shorthands: `marginX`, `marginY`, `margin`.';
  typed(shorthands, tsx`
import {Box} from 'ink';
export const x = <Box ${kind}X={1} />;
export const y = <Box ${kind}Y={1} />;
export const all = <Box ${kind}={2} />;
export const bare = <Box ${kind} />; //! TS2322
`);
  s.fact(F, [shorthands], { kind: 'R', ctx: kind === 'padding' ? ['left+right', 'top+bottom', 'all four'] : [] }, async (t, q) => {
    for (const name of kind === 'padding' ? ['paddingX', 'paddingY', 'padding'] : ['marginX', 'marginY', 'margin']) q.tok(name);
    const probe = (props) => {
      const out = render(h(Box, { borderStyle: 'single', width: 11, height: 7 }, h(Box, props, h(Text, null, 'x'))));
      const rows = lines(stripAnsi(out));
      const row = rows.findIndex((l) => l.includes('x'));
      return { row, col: rows[row].indexOf('x') };
    };
    const base = probe({});
    t.deepEqual(probe({ [`${kind}X`]: 2 }), probe({ [`${kind}Left`]: 2, [`${kind}Right`]: 2 }), `${kind}X is left + right`);
    t.deepEqual(probe({ [`${kind}Y`]: 1 }), probe({ [`${kind}Top`]: 1, [`${kind}Bottom`]: 1 }), `${kind}Y is top + bottom`);
    t.deepEqual(probe({ [kind]: 1 }), probe({ [`${kind}Top`]: 1, [`${kind}Bottom`]: 1, [`${kind}Left`]: 1, [`${kind}Right`]: 1 }), `${kind} is all four`);
    t.notDeepEqual(probe({ [kind]: 1 }), base);
  });
}

// ============================================================ gap

const gapRow = (name, note) => `| \`${name}\` | \`number\` | \`0\` | ${note} |`;
for (const [name, note, probe] of [
  ['gap', 'Shorthand for `columnGap` + `rowGap`.', null],
  ['columnGap', 'Space between columns.', { flexDirection: 'row' }],
  ['rowGap', 'Space between rows.', { flexDirection: 'column' }],
]) {
  const row = gapRow(name, note);
  typed(row, tsx`
import {Box} from 'ink';
export const ok = <Box ${name}={1} />;
export const wrong = <Box ${name}="1" />; //! TS2322
`);
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    q.tok(name);
    q.tok('number');
    q.tok('0');
    if (name === 'gap') {
      q.tok('columnGap');
      q.tok('rowGap');
      const wrap = (props) => render(h(Box, { width: 3, flexWrap: 'wrap', ...props }, ...['A', 'B', 'C'].map(txt)));
      t.equal(wrap({ gap: 1 }), wrap({ columnGap: 1, rowGap: 1 }), 'gap is columnGap plus rowGap');
      t.equal(wrap({ gap: 0 }), wrap({}), 'default 0');
    } else {
      const two = (props) => scene({ ...probe, ...props }, 'a', 'b');
      t.equal(two({}), two({ [name]: 0 }), 'default 0');
      t.notEqual(two({ [name]: 2 }), two({}), `${name} changes the spacing between siblings`);
      const along = name === 'columnGap' ? two({ [name]: 2 }) === 'a  b' : two({ [name]: 1 }) === 'a\n\nb';
      t.ok(along, name === 'columnGap' ? 'columns are separated horizontally' : 'rows are separated vertically');
    }
  });
}

s.fence(F, 1);
s.fact(F, ['// A B // // C'], { kind: 'R' }, async (t) => {
  const out = render(h(Box, { gap: 1, width: 3, flexWrap: 'wrap' }, ...['A', 'B', 'C'].map(txt)));
  t.equal(out, 'A B\n\nC', 'A and B on the first line, a blank row of gap, then C');
});

// ============================================================ flex

const flexRow = (name, type, def, note) => `| \`${name}\` | \`${type}\` | ${def} | ${note} |`;
const CSS = (prop) => `[${prop}](https://css-tricks.com/almanac/properties/f/${prop}/)`;

// flexGrow
{
  const row = flexRow('flexGrow', 'number', '`0`', CSS('flex-grow'));
  typed(row, propFixture('flexGrow', '`number`'));
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    q.tok('flexGrow'); q.tok('number'); q.tok('0');
    const grow = (props) => extent(inParent({ width: 12, height: 3 }, props)).cols;
    t.equal(grow({}), grow({ flexGrow: 0 }), 'default 0: the box keeps its content width');
    t.equal(grow({ flexGrow: 1 }), 12, 'flexGrow 1 fills the parent');
    const share = render(h(Box, { width: 12 }, h(Box, { flexGrow: 1, borderStyle: 'single' }), h(Box, { flexGrow: 2, borderStyle: 'single' })));
    const tops = lines(stripAnsi(share))[0];
    t.equal(tops.indexOf('┐') - tops.indexOf('┌') + 1 < tops.lastIndexOf('┐') - tops.lastIndexOf('┌') + 1, true, 'a larger grow factor takes a larger share');
  });
}
// flexShrink
{
  const row = flexRow('flexShrink', 'number', '`1`', CSS('flex-shrink'));
  typed(row, propFixture('flexShrink', '`number`'));
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    q.tok('flexShrink'); q.tok('number'); q.tok('1');
    const shrunk = (props) => {
      const out = lines(stripAnsi(render(h(Box, { width: 8 }, h(Box, { width: 6, borderStyle: 'single', ...props }), h(Box, { width: 6, borderStyle: 'single' })))))[0];
      return out.indexOf('┐') - out.indexOf('┌') + 1;
    };
    t.equal(shrunk({}), shrunk({ flexShrink: 1 }), 'default 1');
    t.equal(shrunk({ flexShrink: 0 }), 6, 'flexShrink 0 refuses to shrink');
    t.ok(shrunk({}) < 6, 'with the default the box shrinks when the row overflows');
  });
}
// flexBasis
{
  const row = flexRow('flexBasis', 'number | string', '—', CSS('flex-basis'));
  typed(row, propFixture('flexBasis', '`number | string`'));
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    q.tok('flexBasis'); q.tok('number | string');
    const basis = (props) => extent(inParent({ width: 14, height: 3 }, props)).cols;
    t.equal(basis({}), 3, 'with no flexBasis the box is as wide as its content');
    t.equal(basis({ flexBasis: 8 }), 8, 'a number sets the starting width in cells');
    t.equal(basis({ flexBasis: '50%' }), 7, 'a percentage is of the parent');
  });
}
// flexDirection
{
  const row = flexRow('flexDirection', "'row' | 'row-reverse' | 'column' | 'column-reverse'", "`'row'`", '**Default is row**, not column.');
  typed(row, propFixture('flexDirection', "`'row' | 'row-reverse' | 'column' | 'column-reverse'`"));
  s.fact(F, [row], { kind: 'R', ctx: ['Default is row'] }, async (t, q) => {
    q.tok('flexDirection');
    const list = members(q.tok("'row' | 'row-reverse' | 'column' | 'column-reverse'")).map(literal);
    const fallback = literal(q.tok("'row'"));
    const out = Object.fromEntries(list.map((d) => [d, scene({ flexDirection: d }, 'a', 'b')]));
    t.equal(scene({}, 'a', 'b'), out[fallback], 'the default is row');
    t.equal(out.row, 'ab');
    t.equal(out['row-reverse'].trimStart(), 'ba', 'row-reverse lists the last child first');
    t.equal(out['row-reverse'].length, 40, 'and packs the children against the right edge of the 40-column terminal');
    t.equal(out.column, 'a\nb');
    t.equal(out['column-reverse'], 'b\na');
  });
}
// flexWrap
{
  const row = flexRow('flexWrap', "'nowrap' | 'wrap' | 'wrap-reverse'", "`'nowrap'`", '');
  typed(row, propFixture('flexWrap', "`'nowrap' | 'wrap' | 'wrap-reverse'`"));
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    q.tok('flexWrap');
    const list = members(q.tok("'nowrap' | 'wrap' | 'wrap-reverse'")).map(literal);
    const fallback = literal(q.tok("'nowrap'"));
    // children that refuse to shrink: otherwise nowrap squeezes (and so re-wraps) the text itself
    const rigid = (label) => h(Box, { key: label, flexShrink: 0 }, h(Text, null, label));
    const wrap = (value) => render(h(Box, { width: 4, ...(value ? { flexWrap: value } : {}) }, ...['aa', 'bb', 'cc'].map(rigid)));
    t.equal(wrap(undefined), wrap(fallback), 'the default is nowrap');
    t.equal(lines(wrap('nowrap')).length, 1, 'nowrap keeps one line');
    t.equal(wrap('wrap'), 'aabb\ncc', 'wrap flows onto a second line');
    t.equal(wrap('wrap-reverse'), 'cc\naabb', 'wrap-reverse stacks the lines the other way');
    t.deepEqual(list, ['nowrap', 'wrap', 'wrap-reverse']);
  });
}
// alignItems
{
  const row = flexRow('alignItems', "'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'", "`'stretch'`", 'Cross-axis alignment of children.');
  typed(row, propFixture('alignItems', "`'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'`"));
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    q.tok('alignItems');
    const list = members(q.tok("'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'")).map(literal);
    const fallback = literal(q.tok("'stretch'"));
    const aligned = (value) => extent(render(h(Box, { width: 9, height: 7, ...(value ? { alignItems: value } : {}) }, h(Box, { borderStyle: 'single', width: 5 }, h(Text, null, 'x')))));
    t.deepEqual(aligned(undefined), aligned(fallback), 'the default is stretch');
    t.equal(aligned('stretch').rows, 7, 'stretch fills the cross axis');
    t.deepEqual([aligned('flex-start').top, aligned('center').top, aligned('flex-end').top], [0, 2, 4], 'flex-start / center / flex-end place a 3-row box at the top / middle / bottom of 7');
    t.equal(aligned('baseline').top, 0, 'baseline aligns by text baseline');
    t.deepEqual(list.sort(), ['baseline', 'center', 'flex-end', 'flex-start', 'stretch']);
  });
}
// alignSelf
{
  const row = flexRow('alignSelf', "'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'", "`'auto'`", "Overrides parent's `alignItems` for one child.");
  typed(row, propFixture('alignSelf', "`'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'`"));
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    q.tok('alignSelf');
    q.tok("'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'");
    const fallback = literal(q.tok("'auto'"));
    q.tok('alignItems');
    const self = (value) => extent(render(h(Box, { width: 9, height: 7, alignItems: 'flex-end' }, h(Box, { borderStyle: 'single', width: 5, ...(value ? { alignSelf: value } : {}) }, h(Text, null, 'x'))))).top;
    t.equal(self(undefined), self(fallback), 'the default is auto: follow the parent');
    t.equal(self('auto'), 4, 'auto follows the parent alignItems (flex-end)');
    t.equal(self('flex-start'), 0, "alignSelf overrides the parent's alignItems for this child");
  });
}
// alignContent
{
  const row = flexRow('alignContent', "'flex-start' | 'flex-end' | 'center' | 'stretch' | 'space-between' | 'space-around' | 'space-evenly'", "`'flex-start'`", 'Only matters with `flexWrap` creating multiple lines. Ink defaults to `flex-start` (not `stretch`), so wrapped lines stay compact.');
  typed(row, propFixture('alignContent', "`'flex-start' | 'flex-end' | 'center' | 'stretch' | 'space-between' | 'space-around' | 'space-evenly'`"));
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    q.tok('alignContent');
    q.tok("'flex-start' | 'flex-end' | 'center' | 'stretch' | 'space-between' | 'space-around' | 'space-evenly'");
    const fallback = literal(q.tok("'flex-start'"));
    q.tok('flexWrap');
    q.tok('flex-start');
    q.tok('stretch');
    const wrapped = (value, wrap = 'wrap') => render(h(Box, { width: 3, height: 7, flexWrap: wrap, ...(value ? { alignContent: value } : {}) }, ...['aaa', 'bbb', 'ccc'].map(txt)));
    t.equal(wrapped(undefined), wrapped(fallback), 'the default is flex-start');
    t.equal(wrapped(undefined).trimEnd(), 'aaa\nbbb\nccc', 'wrapped lines stay compact at the top');
    t.notEqual(wrapped('stretch'), wrapped('flex-start'), 'stretch would spread them');
    t.equal(wrapped('space-between', 'nowrap'), wrapped(undefined, 'nowrap'), 'without wrapping there are no multiple lines, so alignContent does nothing');
  });
}
// justifyContent
{
  const row = flexRow('justifyContent', "'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly'", "`'flex-start'`", 'Main-axis alignment of children.');
  typed(row, propFixture('justifyContent', "`'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly'`"));
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    q.tok('justifyContent');
    q.tok("'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly'");
    const fallback = literal(q.tok("'flex-start'"));
    const j = (value) => scene({ width: 8, ...(value ? { justifyContent: value } : {}) }, 'a', 'b');
    t.equal(j(undefined), j(fallback), 'the default is flex-start');
    t.equal(j('flex-start'), 'ab');
    t.equal(j('flex-end'), '      ab');
    t.equal(j('center'), '   ab');
    t.equal(j('space-between'), 'a      b');
    // Yoga rounds the free space to whole cells, so check the distribution, not one rounded string
    const spread = (value) => {
      const out = render(h(Box, { width: 14, justifyContent: value }, ...['a', 'b', 'c'].map(txt)));
      const at = [...out].map((c, i) => (c === ' ' ? -1 : i)).filter((i) => i >= 0);
      return { lead: at[0], gaps: [at[1] - at[0] - 1, at[2] - at[1] - 1], trail: 14 - at[2] - 1 };
    };
    const around = spread('space-around');
    t.ok(Math.abs(around.gaps[0] - (around.lead + around.trail)) <= 1, 'space-around: each item owns a slice of space split on both sides, so a gap between items is about the two end gaps added together');
    const evenly = spread('space-evenly');
    t.ok(Math.max(evenly.lead, ...evenly.gaps, evenly.trail) - Math.min(evenly.lead, ...evenly.gaps, evenly.trail) <= 1, 'space-evenly: every gap, ends included, is equal to within a cell');
  });
}

s.fence(F, 2);
s.fact(F, ['// X Y'], { kind: 'R' }, async (t) => {
  t.equal(render(h(Box, { justifyContent: 'space-between', width: 8 }, txt('X'), txt('Y'))), 'X      Y');
});

// ============================================================ position

{
  const row = '| `position` | `\'relative\' | \'absolute\' | \'static\'` | `\'relative\'` | When `\'static\'`, `top`/`right`/`bottom`/`left` are ignored. |';
  typed(row, propFixture('position', "`'relative' | 'absolute' | 'static'`"));
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    q.tok('position');
    q.tok("'relative' | 'absolute' | 'static'");
    const fallback = literal(q.tok("'relative'"));
    q.tok("'static'");
    for (const side of ['top', 'right', 'bottom', 'left']) q.tok(side);
    const placed = (props) => render(h(Box, { width: 6, height: 3 }, txt('A'), h(Box, props, txt('B'))));
    t.equal(placed({ top: 1 }), placed({ top: 1, position: fallback }), 'the default is relative');
    t.notEqual(placed({ top: 1, position: 'absolute' }), placed({ top: 1 }), 'absolute differs from relative');
    t.equal(placed({ top: 1, position: 'static' }), placed({}), "'static' ignores the offset");
    t.equal(placed({ left: 2, top: 2, position: 'static' }), placed({}), 'for every side');
  });
}
{
  const row = '| `top` / `right` / `bottom` / `left` | `number | string` | — | Offset for positioned elements; percentage of parent size supported. |';
  typed(row, tsx`
import {Box} from 'ink';
export const numbers = <Box position="absolute" top={1} right={1} bottom={1} left={1} />;
export const percents = <Box position="absolute" top="50%" right="50%" bottom="50%" left="50%" />;
export const wrong = <Box top={true} />; //! TS2322
`);
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    for (const side of ['top', 'right', 'bottom', 'left']) q.tok(side);
    q.tok('number | string');
    const at = (props) => {
      const out = lines(stripAnsi(render(h(Box, { width: 12, height: 6 }, h(Box, { position: 'absolute', ...props }, h(Text, null, 'B'))))));
      const rowIndex = out.findIndex((l) => l.includes('B'));
      return { row: rowIndex, col: out[rowIndex].indexOf('B') };
    };
    t.deepEqual(at({ top: 2, left: 3 }), { row: 2, col: 3 }, 'top and left are offsets from the parent corner');
    t.deepEqual(at({ bottom: 1, right: 2 }), { row: 4, col: 9 }, 'bottom and right are offsets from the opposite corner');
    t.deepEqual(at({ top: '50%', left: '50%' }), { row: 3, col: 6 }, 'a percentage is of the parent size');
  });
}

// ============================================================ visibility & overflow

{
  const row = "| `display` | `'flex' | 'none'` | `'flex'` | `'none'` hides the element entirely. |";
  typed(row, propFixture('display', "`'flex' | 'none'`"));
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    q.tok('display');
    q.tok("'flex' | 'none'");
    const fallback = literal(q.tok("'flex'"));
    q.tok("'none'");
    const shown = (value) => scene({}, 'a') + '|' + render(h(Box, null, txt('x'), h(Box, value ? { display: value } : {}, txt('HIDDEN')), txt('y')));
    t.equal(shown(undefined), shown(fallback), 'the default is flex');
    t.equal(render(h(Box, { display: 'none' }, txt('HIDDEN'))), '', 'none renders nothing');
    t.equal(render(h(Box, null, txt('x'), h(Box, { display: 'none' }, txt('HIDDEN')), txt('y'))), 'xy', 'and takes no space: the siblings close up');
  });
}
{
  const row = "| `overflowX` / `overflowY` | `'visible' | 'hidden'` | `'visible'` | |";
  typed(row, tsx`
import {Box} from 'ink';
export const x = <Box overflowX="hidden" overflowY="visible" />;
export const y = <Box overflowX="visible" overflowY="hidden" />;
export const wrong = <Box overflowX="scroll" />; //! TS2322
`);
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    q.tok('overflowX'); q.tok('overflowY');
    q.tok("'visible' | 'hidden'");
    const fallback = literal(q.tok("'visible'"));
    const clipped = (props) => render(h(Box, { width: 4, height: 2, flexDirection: 'column', ...props }, h(Box, { width: 8, height: 4, flexShrink: 0 }, h(Text, null, 'abcdefgh\nijklmnop\nqrstuvwx\nyz012345'))));
    t.equal(clipped({}), clipped({ overflowX: fallback, overflowY: fallback }), 'the default is visible');
    t.ok(clipped({}).includes('abcdefgh'), 'visible content runs past the box');
    t.equal(clipped({ overflowX: 'hidden', overflowY: 'visible' }).split('\n')[0], 'abcd', 'overflowX hidden clips columns only');
    t.ok(clipped({ overflowX: 'visible', overflowY: 'hidden' }).split('\n').length <= 2, 'overflowY hidden clips rows only');
  });
}
{
  const row = "| `overflow` | `'visible' | 'hidden'` | `'visible'` | Shorthand for both axes. Clips content that doesn't fit. Pair with `contentOffsetX`/`contentOffsetY` to scroll; see `scrollable-view.md`. |";
  typed(row, propFixture('overflow', "`'visible' | 'hidden'`", { extra: "export const offsets = <Box overflow=\"hidden\" contentOffsetX={1} contentOffsetY={1} />;\n" }));
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    q.tok('overflow');
    q.tok("'visible' | 'hidden'");
    const fallback = literal(q.tok("'visible'"));
    q.tok('contentOffsetX'); q.tok('contentOffsetY');
    t.ok(existsSync(join(ROOT, 'skills', 'core', 'ink-layout', 'references', q.tok('scrollable-view.md'))), 'the referenced file exists');
    const clipped = (props) => render(h(Box, { width: 4, height: 1, ...props }, h(Box, { width: 8, flexShrink: 0 }, h(Text, null, 'abcdefgh'))));
    t.equal(clipped({}), clipped({ overflow: fallback }), 'the default is visible');
    t.equal(clipped({ overflow: 'hidden' }), 'abcd', 'hidden clips what does not fit');
    t.equal(clipped({ overflow: 'hidden' }), clipped({ overflowX: 'hidden', overflowY: 'hidden' }), 'overflow is the shorthand for both axes');
    t.equal(clipped({ overflow: 'hidden', contentOffsetX: 4 }), 'efgh', 'with contentOffset the clipped content scrolls');
  });
}
for (const [axis, prop, dimension] of [['columns', 'contentOffsetX', 'X'], ['rows', 'contentOffsetY', 'Y']]) {
  const row = prop === 'contentOffsetX'
    ? '| `contentOffsetX` | `number` | `0` | Shifts children left by N columns. Combine with `overflow="hidden"` to scroll. Fractional values truncate toward zero; non-finite → `0`. |'
    : '| `contentOffsetY` | `number` | `0` | Shifts children up by N rows. Same rules. |';
  typed(row, tsx`
import {Box} from 'ink';
export const ok = <Box overflow="hidden" ${prop}={1} />;
export const wrong = <Box ${prop}="1" />; //! TS2322
`);
  s.fact(F, [row], { kind: 'R', ctx: prop === 'contentOffsetY' ? [] : ['N'] }, async (t, q) => {
    q.tok(prop);
    q.tok('number');
    const zero = Number(q.tok('0'));
    if (prop === 'contentOffsetX') {
      q.tok('overflow="hidden"');
    }
    const view = (offset) => {
      const props = offset === undefined ? {} : { [prop]: offset };
      return render(h(Box, { width: 4, height: 2, overflow: 'hidden', flexDirection: 'column', ...props }, h(Box, { flexDirection: 'column', flexShrink: 0, width: 8 }, h(Text, null, 'abcdefgh'), h(Text, null, 'ijklmnop'), h(Text, null, 'qrstuvwx'))));
    };
    t.equal(view(undefined), view(zero), 'the default is 0');
    if (dimension === 'X') {
      t.equal(view(2).split('\n')[0], 'cdef', 'shifts children left by N columns');
      t.equal(view(2.9), view(2), 'a fractional offset truncates toward zero');
      t.equal(view(-1.9), view(-1), 'also for negatives');
      t.equal(view(Number.NaN), view(0), 'NaN becomes 0');
      t.equal(view(Infinity), view(0), 'and so does Infinity');
    } else {
      t.equal(view(1).split('\n')[0], 'ijkl', 'shifts children up by N rows');
      t.equal(view(1.9), view(1), 'same rules: fractions truncate toward zero');
      t.equal(view(Number.NaN), view(0), 'NaN becomes 0');
      t.equal(view(Infinity), view(0), 'and so does Infinity');
    }
  });
}

// ============================================================ borders

typed('See `ink-borders-and-backgrounds` for `borderStyle`/`borderColor`/per-edge variants and `backgroundColor`.', tsx`
import {Box} from 'ink';
export const ok = (
	<Box borderStyle="single" borderColor="red" borderTop={false} borderTopColor="blue" backgroundColor="green" />
);
`);
s.fact(F, ['See `ink-borders-and-backgrounds` for `borderStyle`/`borderColor`/per-edge variants and `backgroundColor`.'], { kind: 'R', ctx: ['ink-borders-and-backgrounds'] }, async (t, q) => {
  const [style, color, background] = [q.tok('borderStyle'), q.tok('borderColor'), q.tok('backgroundColor')];
  const out = render(h(Box, { [style]: 'single', [color]: 'red', [background]: 'blue', width: 4, height: 3 }, txt('x')));
  t.match(out, /\x1b\[31m/, 'borderColor colours the border');
  t.match(out, /\x1b\[44m/, 'backgroundColor fills the box');
  t.equal(stripAnsi(render(h(Box, { [style]: 'single', borderTop: false, width: 4, height: 2 }))).split('\n')[0].includes('┌'), false, 'a per-edge prop turns one side off');
});
