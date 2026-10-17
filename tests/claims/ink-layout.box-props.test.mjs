// Claims for skills/core/ink-layout/references/box-props.md — one claim per row/sentence.
// Each prop gets (a) a type fixture for the values its row lists and (b) a runtime scene
// proving the documented default and, where the row describes behaviour, that behaviour.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { skill, tsx, ink, h, stripAnsi, ROOT } from '../lib/index.mjs';
import { factTokens } from '../lib/units.mjs';
import { pick, propAndValue } from './ink-layout.helpers.mjs';

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
  const prop = q.tok('width');
  const types = q.tok('number | string').split(' | ');
  // what each type in the cell does to the width of a child of a 20-column parent
  const effects = { number: { value: 7, cols: 7 }, string: { value: percent, cols: 10 } };
  for (const type of types) {
    const { value, cols } = pick(effects, type);
    t.equal(extent(inParent({}, { [prop]: value })).cols, cols, `a ${type} width${type === 'string' ? ' of "50%" is half the 20-column parent' : ' is cells'}`);
  }
  t.deepEqual([...types].sort(), Object.keys(effects).sort(), 'and those are the only two types');
});

typed(dimRow('height', 'number | string', 'Rows, or `"50%"` of the resolved parent height.'), propFixture('height', '`number | string`'));
s.fact(F, [dimRow('height', 'number | string', 'Rows, or `"50%"` of the resolved parent height.')], { kind: 'R' }, async (t, q) => {
  const percent = q.tok('"50%"').replace(/"/g, '');
  const prop = q.tok('height');
  const types = q.tok('number | string').split(' | ');
  const effects = { number: { value: 5, rows: 5 }, string: { value: percent, rows: 4 } };
  for (const type of types) {
    const { value, rows } = pick(effects, type);
    t.equal(extent(inParent({}, { [prop]: value })).rows, rows, `a ${type} height${type === 'string' ? ' of "50%" is half the 8-row parent' : ' is rows'}`);
  }
  t.deepEqual([...types].sort(), Object.keys(effects).sort(), 'and those are the only two types');
});

for (const [name, dim] of [['minWidth', 'cols'], ['maxWidth', 'cols']]) {
  const row = dimRow(name, 'number', 'Number only (cells); percentage strings are a type error.');
  typed(row, tsx`
import {Box} from 'ink';
export const ok = <Box ${name}={10} />;
export const percent = <Box ${name}="50%" />; //! TS2322
`);
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    const prop = q.tok(name);
    const type = q.tok('number');
    // the number is the limit in cells: a minimum widens a 4-column child to it, a maximum narrows an 18-column child to it
    const limit = pick({ number: name === 'minWidth' ? 9 : 12 }, type);
    const out = inParent({}, { width: name === 'minWidth' ? 4 : 18, [prop]: limit });
    t.equal(extent(out)[dim], limit, `${name} is applied in cells`);
  });
}

for (const [name, dimension] of [['minHeight', 'rows'], ['maxHeight', 'rows']]) {
  const row = dimRow(name, 'number | string', 'Percentage supported.');
  typed(row, propFixture(name, '`number | string`'));
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    const prop = q.tok(name);
    const types = q.tok('number | string').split(' | ');
    // in an 8-row parent: a minimum lifts a content-high child to it, a maximum caps an 8-row child
    const base = name === 'minHeight' ? {} : { height: 8 };
    const effects = name === 'minHeight' ? { number: { value: 6, rows: 6 }, string: { value: '50%', rows: 4 } } : { number: { value: 3, rows: 3 }, string: { value: '50%', rows: 4 } };
    for (const type of types) {
      const { value, rows } = pick(effects, type);
      t.equal(extent(inParent({ alignItems: 'flex-start' }, { ...base, [prop]: value }))[dimension], rows, `${name} as a ${type}`);
    }
    t.deepEqual([...types].sort(), Object.keys(effects).sort(), 'a number or a percentage string, nothing else');
  });
}

typed('| `aspectRatio` | `number` |', tsx`
import {Box} from 'ink';
export const ok = <Box aspectRatio={2} />;
export const wrong = <Box aspectRatio="2:1" />; //! TS2322
`);
s.fact(F, ['| `aspectRatio` | `number` | width/height. Needs at least one size constraint so Ink can derive the other dimension. |'], { kind: 'R' }, async (t, q) => {
  const prop = q.tok('aspectRatio');
  const ratio = pick({ number: 3 }, q.tok('number'));
  const withWidth = extent(inParent({ alignItems: 'flex-start' }, { width: 12, [prop]: ratio }));
  t.equal(withWidth.cols / withWidth.rows, ratio, 'ratio is width / height once one dimension is known');
  const unconstrained = extent(inParent({ alignItems: 'flex-start' }, { [prop]: ratio }));
  t.notEqual(unconstrained.cols / unconstrained.rows, ratio, 'with no size constraint there is nothing to derive the other dimension from');
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
    const [top, bottom, left, right] = edges.map((e) => q.tok(`${kind}${e}`));
    const one = pick({ number: 1 }, q.tok('number'));
    const zero = Number(q.tok('0'));
    const probe = (props) => {
      const out = render(h(Box, { borderStyle: 'single', width: 9, height: 5 }, h(Box, props, h(Text, null, 'x'))));
      const rows = lines(stripAnsi(out));
      const row = rows.findIndex((l) => l.includes('x'));
      return { row, col: rows[row].indexOf('x') };
    };
    const base = probe({});
    t.deepEqual(probe({ [top]: zero, [left]: zero, [bottom]: zero, [right]: zero }), base, 'default 0 changes nothing');
    t.deepEqual(probe({ [top]: one }), { row: base.row + one, col: base.col }, `${kind}Top moves the text down`);
    t.deepEqual(probe({ [left]: 2 * one }), { row: base.row, col: base.col + 2 * one }, `${kind}Left moves it right`);
    // bottom/right: visible when the box has a size to push against
    const bottomSpace = render(h(Box, { flexDirection: 'column', width: 5 }, h(Box, { [bottom]: 2 * one }, h(Text, null, 'a')), h(Text, null, 'z')));
    t.equal(bottomSpace, 'a\n\n\nz', `${kind}Bottom adds rows below`);
    const rightSpace = render(h(Box, { width: 8 }, h(Box, { [right]: 3 * one }, h(Text, null, 'a')), h(Text, null, 'z')));
    t.equal(rightSpace, 'a   z', `${kind}Right adds columns to the right`);
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
    const [x, y, all] = (kind === 'padding' ? ['paddingX', 'paddingY', 'padding'] : ['marginX', 'marginY', 'margin']).map((name) => q.tok(name));
    const probe = (props) => {
      const out = render(h(Box, { borderStyle: 'single', width: 11, height: 7 }, h(Box, props, h(Text, null, 'x'))));
      const rows = lines(stripAnsi(out));
      const row = rows.findIndex((l) => l.includes('x'));
      return { row, col: rows[row].indexOf('x') };
    };
    const base = probe({});
    t.deepEqual(probe({ [x]: 2 }), probe({ [`${kind}Left`]: 2, [`${kind}Right`]: 2 }), `${kind}X is left + right`);
    t.notDeepEqual(probe({ [x]: 2 }), base, `and ${x} is a prop that does something`);
    t.deepEqual(probe({ [y]: 1 }), probe({ [`${kind}Top`]: 1, [`${kind}Bottom`]: 1 }), `${kind}Y is top + bottom`);
    t.notDeepEqual(probe({ [y]: 1 }), base);
    t.deepEqual(probe({ [all]: 1 }), probe({ [`${kind}Top`]: 1, [`${kind}Bottom`]: 1, [`${kind}Left`]: 1, [`${kind}Right`]: 1 }), `${kind} is all four`);
    t.notDeepEqual(probe({ [all]: 1 }), base);
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
    const prop = q.tok(name);
    const one = pick({ number: 1 }, q.tok('number'));
    const zero = Number(q.tok('0'));
    if (name === 'gap') {
      const [columnGap, rowGap] = [q.tok('columnGap'), q.tok('rowGap')];
      const wrap = (props) => render(h(Box, { width: 3, flexWrap: 'wrap', ...props }, ...['A', 'B', 'C'].map(txt)));
      t.equal(wrap({ [prop]: one }), wrap({ [columnGap]: one, [rowGap]: one }), 'gap is columnGap plus rowGap');
      t.notEqual(wrap({ [prop]: one }), wrap({}), 'and it spaces the children');
      t.equal(wrap({ [prop]: zero }), wrap({}), 'default 0');
    } else {
      const two = (props) => scene({ ...probe, ...props }, 'a', 'b');
      t.equal(two({}), two({ [prop]: zero }), 'default 0');
      t.notEqual(two({ [prop]: 2 * one }), two({}), `${name} changes the spacing between siblings`);
      const along = name === 'columnGap' ? two({ [prop]: 2 * one }) === 'a  b' : two({ [prop]: one }) === 'a\n\nb';
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
    const prop = q.tok('flexGrow');
    const one = pick({ number: 1 }, q.tok('number'));
    const zero = Number(q.tok('0'));
    const grow = (props) => extent(inParent({ width: 12, height: 3 }, props)).cols;
    t.equal(grow({}), grow({ [prop]: zero }), 'default 0: the box keeps its content width');
    t.equal(grow({ [prop]: one }), 12, 'flexGrow 1 fills the parent');
    const share = render(h(Box, { width: 12 }, h(Box, { [prop]: one, borderStyle: 'single' }), h(Box, { [prop]: 2 * one, borderStyle: 'single' })));
    const tops = lines(stripAnsi(share))[0];
    t.equal(tops.indexOf('┐') - tops.indexOf('┌') + 1 < tops.lastIndexOf('┐') - tops.lastIndexOf('┌') + 1, true, 'a larger grow factor takes a larger share');
  });
}
// flexShrink
{
  const row = flexRow('flexShrink', 'number', '`1`', CSS('flex-shrink'));
  typed(row, propFixture('flexShrink', '`number`'));
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    const prop = q.tok('flexShrink');
    const type = q.tok('number');
    const dflt = Number(q.tok('1'));
    const none = pick({ number: 0 }, type);
    const shrunk = (props) => {
      const out = lines(stripAnsi(render(h(Box, { width: 8 }, h(Box, { width: 6, borderStyle: 'single', ...props }), h(Box, { width: 6, borderStyle: 'single' })))))[0];
      return out.indexOf('┐') - out.indexOf('┌') + 1;
    };
    t.equal(shrunk({}), shrunk({ [prop]: dflt }), 'default 1');
    t.equal(shrunk({ [prop]: none }), 6, 'flexShrink 0 refuses to shrink');
    t.ok(shrunk({}) < 6, 'with the default the box shrinks when the row overflows');
  });
}
// flexBasis
{
  const row = flexRow('flexBasis', 'number | string', '—', CSS('flex-basis'));
  typed(row, propFixture('flexBasis', '`number | string`'));
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    const prop = q.tok('flexBasis');
    const types = q.tok('number | string').split(' | ');
    const basis = (props) => extent(inParent({ width: 14, height: 3 }, props)).cols;
    t.equal(basis({}), 3, 'with no flexBasis the box is as wide as its content');
    // the starting width: 8 cells, or "50%" of the 14-column parent
    const effects = { number: { value: 8, cols: 8 }, string: { value: '50%', cols: 7 } };
    for (const type of types) {
      const { value, cols } = pick(effects, type);
      t.equal(basis({ [prop]: value }), cols, `a ${type} flexBasis`);
    }
    t.deepEqual([...types].sort(), Object.keys(effects).sort(), 'a number or a percentage string, nothing else');
  });
}
// flexDirection
{
  const row = flexRow('flexDirection', "'row' | 'row-reverse' | 'column' | 'column-reverse'", "`'row'`", '**Default is row**, not column.');
  typed(row, propFixture('flexDirection', "`'row' | 'row-reverse' | 'column' | 'column-reverse'`"));
  s.fact(F, [row], { kind: 'R', ctx: ['Default is row'] }, async (t, q) => {
    const prop = q.tok('flexDirection');
    const list = members(q.tok("'row' | 'row-reverse' | 'column' | 'column-reverse'")).map(literal);
    const fallback = literal(q.tok("'row'"));
    const out = Object.fromEntries(list.map((d) => [d, scene({ [prop]: d }, 'a', 'b')]));
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
    const prop = q.tok('flexWrap');
    const list = members(q.tok("'nowrap' | 'wrap' | 'wrap-reverse'")).map(literal);
    const fallback = literal(q.tok("'nowrap'"));
    // children that refuse to shrink: otherwise nowrap squeezes (and so re-wraps) the text itself
    const rigid = (label) => h(Box, { key: label, flexShrink: 0 }, h(Text, null, label));
    const wrap = (value) => render(h(Box, { width: 4, ...(value ? { [prop]: value } : {}) }, ...['aa', 'bb', 'cc'].map(rigid)));
    // an unknown value is ignored, so each member is checked against what it must draw
    const drawn = { nowrap: 'aabbcc', wrap: 'aabb\ncc', 'wrap-reverse': 'cc\naabb' };
    t.equal(wrap(undefined), pick(drawn, fallback), 'the default is nowrap');
    for (const member of list) t.equal(wrap(member), pick(drawn, member), `${member}`);
    t.equal(lines(wrap('nowrap')).length, 1, 'nowrap keeps one line');
    t.equal(wrap('wrap'), 'aabb\ncc', 'wrap flows onto a second line');
    t.equal(wrap('wrap-reverse'), 'cc\naabb', 'wrap-reverse stacks the lines the other way');
    t.deepEqual([...list].sort(), Object.keys(drawn).sort());
  });
}
// alignItems
{
  const row = flexRow('alignItems', "'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'", "`'stretch'`", 'Cross-axis alignment of children.');
  typed(row, propFixture('alignItems', "`'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'`"));
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    const prop = q.tok('alignItems');
    const list = members(q.tok("'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'")).map(literal);
    const fallback = literal(q.tok("'stretch'"));
    const aligned = (value) => {
      const { top, rows } = extent(render(h(Box, { width: 9, height: 7, ...(value ? { [prop]: value } : {}) }, h(Box, { borderStyle: 'single', width: 5 }, h(Text, null, 'x')))));
      return { top, rows };
    };
    // where a 3-row box lands in a 7-row parent (stretch makes it 7 rows tall)
    const placed = { stretch: { top: 0, rows: 7 }, 'flex-start': { top: 0, rows: 3 }, center: { top: 2, rows: 3 }, 'flex-end': { top: 4, rows: 3 }, baseline: { top: 0, rows: 3 } };
    t.deepEqual(aligned(undefined), pick(placed, fallback), 'the default is stretch: the child fills the cross axis');
    for (const member of list) t.deepEqual(aligned(member), pick(placed, member), `${member}`);
    t.deepEqual([aligned('flex-start').top, aligned('center').top, aligned('flex-end').top], [0, 2, 4], 'flex-start / center / flex-end place a 3-row box at the top / middle / bottom of 7');
    t.deepEqual([...list].sort(), Object.keys(placed).sort());
  });
}
// alignSelf
{
  const row = flexRow('alignSelf', "'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'", "`'auto'`", "Overrides parent's `alignItems` for one child.");
  typed(row, propFixture('alignSelf', "`'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'`"));
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    const prop = q.tok('alignSelf');
    const list = members(q.tok("'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'")).map(literal);
    const fallback = literal(q.tok("'auto'"));
    const parentProp = q.tok('alignItems');
    const self = (value) => {
      const { top, rows } = extent(render(h(Box, { width: 9, height: 7, [parentProp]: 'flex-end' }, h(Box, { borderStyle: 'single', width: 5, ...(value ? { [prop]: value } : {}) }, h(Text, null, 'x')))));
      return { top, rows };
    };
    // the parent aligns its children to flex-end; each value says what the child does instead
    const placed = { auto: { top: 4, rows: 3 }, 'flex-start': { top: 0, rows: 3 }, center: { top: 2, rows: 3 }, 'flex-end': { top: 4, rows: 3 }, stretch: { top: 0, rows: 7 }, baseline: { top: 0, rows: 3 } };
    t.deepEqual(self(undefined), pick(placed, fallback), 'the default is auto: follow the parent');
    t.equal(self('auto').top, 4, 'auto follows the parent alignItems (flex-end)');
    for (const member of list) t.deepEqual(self(member), pick(placed, member), `${member}`);
    t.equal(self('flex-start').top, 0, "alignSelf overrides the parent's alignItems for this child");
    t.deepEqual([...list].sort(), Object.keys(placed).sort());
  });
}
// alignContent
{
  const row = flexRow('alignContent', "'flex-start' | 'flex-end' | 'center' | 'stretch' | 'space-between' | 'space-around' | 'space-evenly'", "`'flex-start'`", 'Only matters with `flexWrap` creating multiple lines. Ink defaults to `flex-start` (not `stretch`), so wrapped lines stay compact.');
  typed(row, propFixture('alignContent', "`'flex-start' | 'flex-end' | 'center' | 'stretch' | 'space-between' | 'space-around' | 'space-evenly'`"));
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    const prop = q.tok('alignContent');
    const list = members(q.tok("'flex-start' | 'flex-end' | 'center' | 'stretch' | 'space-between' | 'space-around' | 'space-evenly'")).map(literal);
    const fallback = literal(q.tok("'flex-start'"));
    const wrapProp = q.tok('flexWrap');
    const [start, stretch] = [q.tok('flex-start'), q.tok('stretch')];
    const wrapped = (value, wrap = 'wrap') => render(h(Box, { width: 3, height: 7, [wrapProp]: wrap, ...(value ? { [prop]: value } : {}) }, ...['aaa', 'bbb', 'ccc'].map(txt)));
    // the rows the three wrapped lines land on in a 7-row box
    const rowsOf = (value, wrap) => ['aaa', 'bbb', 'ccc'].map((word) => lines(wrapped(value, wrap)).indexOf(word));
    const landing = { 'flex-start': [0, 1, 2], 'flex-end': [4, 5, 6], center: [2, 3, 4], stretch: [0, 2, 4], 'space-between': [0, 3, 6], 'space-around': [0, 3, 5], 'space-evenly': [1, 3, 5] };
    t.deepEqual(rowsOf(undefined), pick(landing, fallback), 'the default is flex-start');
    for (const member of list) t.deepEqual(rowsOf(member), pick(landing, member), `${member}`);
    t.equal(wrapped(undefined).trimEnd(), 'aaa\nbbb\nccc', 'wrapped lines stay compact at the top');
    t.deepEqual(rowsOf(start), pick(landing, start), `${start} keeps them compact, which is what the default does`);
    t.equal(wrapped(start), wrapped(undefined), `${start} is what the default does`);
    t.notEqual(wrapped(stretch), wrapped(start), `${stretch} would spread them`);
    t.equal(wrapped('space-between', 'nowrap'), wrapped(undefined, 'nowrap'), 'without wrapping there are no multiple lines, so alignContent does nothing');
    t.deepEqual([...list].sort(), Object.keys(landing).sort());
  });
}
// justifyContent
{
  const row = flexRow('justifyContent', "'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly'", "`'flex-start'`", 'Main-axis alignment of children.');
  typed(row, propFixture('justifyContent', "`'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly'`"));
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    const prop = q.tok('justifyContent');
    const list = members(q.tok("'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly'")).map(literal);
    const fallback = literal(q.tok("'flex-start'"));
    const j = (value) => scene({ width: 8, ...(value ? { [prop]: value } : {}) }, 'a', 'b');
    // two one-cell children in an 8-cell row: where the 6 free cells go
    const drawn = { 'flex-start': 'ab', center: '   ab', 'flex-end': '      ab', 'space-between': 'a      b', 'space-around': ' a   b', 'space-evenly': '  a  b' };
    t.equal(j(undefined), pick(drawn, fallback), 'the default is flex-start');
    for (const member of list) t.equal(j(member), pick(drawn, member), `${member}`);
    t.deepEqual([...list].sort(), Object.keys(drawn).sort());
    // Yoga rounds the free space to whole cells, so check the distribution, not one rounded string
    const spread = (value) => {
      const out = render(h(Box, { width: 14, [prop]: value }, ...['a', 'b', 'c'].map(txt)));
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
    const prop = q.tok('position');
    const list = members(q.tok("'relative' | 'absolute' | 'static'")).map(literal);
    const fallback = literal(q.tok("'relative'"));
    const fixed = literal(q.tok("'static'"));
    const sides = ['top', 'right', 'bottom', 'left'].map((side) => q.tok(side));
    const [top] = sides;
    const placed = (props) => render(h(Box, { width: 6, height: 3 }, txt('A'), h(Box, props, txt('B'))));
    const withPosition = (value) => placed({ [top]: 1, ...(value ? { [prop]: value } : {}) });
    // B sits after A; an offset of 1 from the top moves it down a row, or (absolute) puts it at the parent's left edge on that row, or (static) is ignored
    const drawn = { relative: 'A\n B\n', absolute: 'A\nB\n', static: 'AB\n\n' };
    t.equal(withPosition(undefined), pick(drawn, fallback), 'the default is relative');
    for (const member of list) t.equal(withPosition(member), pick(drawn, member), `${member}`);
    t.notEqual(withPosition('absolute'), withPosition(undefined), 'absolute differs from relative');
    t.deepEqual([...list].sort(), Object.keys(drawn).sort());
    for (const side of sides) {
      t.equal(placed({ [side]: 2, [prop]: fixed }), placed({}), `'${fixed}' ignores ${side}`);
      t.notEqual(placed({ [side]: 2, [prop]: fallback }), placed({}), `while the default honours ${side}`);
    }
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
    const [top, right, bottom, left] = ['top', 'right', 'bottom', 'left'].map((side) => q.tok(side));
    const types = q.tok('number | string').split(' | ');
    const at = (props) => {
      const out = lines(stripAnsi(render(h(Box, { width: 12, height: 6 }, h(Box, { position: 'absolute', ...props }, h(Text, null, 'B'))))));
      const rowIndex = out.findIndex((l) => l.includes('B'));
      return { row: rowIndex, col: out[rowIndex].indexOf('B') };
    };
    // offsets from the corners of a 12x6 parent, as numbers (cells) and as percentages
    const effects = {
      number: [
        [{ [top]: 2, [left]: 3 }, { row: 2, col: 3 }, 'top and left are offsets from the parent corner'],
        [{ [bottom]: 1, [right]: 2 }, { row: 4, col: 9 }, 'bottom and right are offsets from the opposite corner'],
      ],
      string: [
        [{ [top]: '50%', [left]: '50%' }, { row: 3, col: 6 }, 'a percentage is of the parent size'],
        [{ [bottom]: '50%', [right]: '50%' }, { row: 2, col: 5 }, 'for the bottom and right offsets too'],
      ],
    };
    for (const type of types) for (const [props, expected, why] of pick(effects, type)) t.deepEqual(at(props), expected, why);
    t.deepEqual([...types].sort(), Object.keys(effects).sort(), 'a number or a percentage string, nothing else');
  });
}

// ============================================================ visibility & overflow

{
  const row = "| `display` | `'flex' | 'none'` | `'flex'` | `'none'` hides the element entirely. |";
  typed(row, propFixture('display', "`'flex' | 'none'`"));
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    const prop = q.tok('display');
    const list = members(q.tok("'flex' | 'none'")).map(literal);
    const fallback = literal(q.tok("'flex'"));
    const none = literal(q.tok("'none'"));
    const shown = (value) => render(h(Box, null, txt('x'), h(Box, value ? { [prop]: value } : {}, txt('HIDDEN')), txt('y')));
    const drawn = { flex: 'xHIDDENy', none: 'xy' };
    t.equal(shown(undefined), pick(drawn, fallback), 'the default is flex');
    for (const member of list) t.equal(shown(member), pick(drawn, member), `${member}`);
    t.equal(render(h(Box, { [prop]: none }, txt('HIDDEN'))), '', 'none renders nothing');
    t.equal(shown(none), 'xy', 'and takes no space: the siblings close up');
    t.deepEqual([...list].sort(), Object.keys(drawn).sort());
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
    const [overflowX, overflowY] = [q.tok('overflowX'), q.tok('overflowY')];
    const list = members(q.tok("'visible' | 'hidden'")).map(literal);
    const fallback = literal(q.tok("'visible'"));
    // a 4x2 box in a taller parent, holding an 8x4 block of text that refuses to shrink
    const text = ['abcdefgh', 'ijklmnop', 'qrstuvwx', 'yz012345'];
    const clipped = (props) => render(h(Box, { height: 6 }, h(Box, { width: 4, height: 2, flexDirection: 'column', ...props }, h(Box, { width: 8, height: 4, flexShrink: 0 }, h(Text, null, text.join('\n')))))).split('\n');
    // overflowX clips the columns (every row, also the rows below the box); overflowY clips the rows
    const columns = { visible: [...text, '', ''], hidden: [...text.map((line) => line.slice(0, 4)), '', ''] };
    const rowsOnly = { visible: [...text, '', ''], hidden: [text[0], text[1], '', '', '', ''] };
    t.deepEqual(clipped({}), pick(columns, fallback), 'the default is visible: the content runs past the box both ways');
    for (const member of list) {
      t.deepEqual(clipped({ [overflowX]: member }), pick(columns, member), `overflowX ${member}`);
      t.deepEqual(clipped({ [overflowY]: member }), pick(rowsOnly, member), `overflowY ${member}`);
    }
    t.deepEqual([...list].sort(), Object.keys(columns).sort());
  });
}
{
  const row = "| `overflow` | `'visible' | 'hidden'` | `'visible'` | Shorthand for both axes. Clips content that doesn't fit. Pair with `contentOffsetX`/`contentOffsetY` to scroll; see `scrollable-view.md`. |";
  typed(row, propFixture('overflow', "`'visible' | 'hidden'`", { extra: "export const offsets = <Box overflow=\"hidden\" contentOffsetX={1} contentOffsetY={1} />;\n" }));
  s.fact(F, [row], { kind: 'R' }, async (t, q) => {
    const prop = q.tok('overflow');
    const list = members(q.tok("'visible' | 'hidden'")).map(literal);
    const fallback = literal(q.tok("'visible'"));
    const [offX, offY] = [q.tok('contentOffsetX'), q.tok('contentOffsetY')];
    t.ok(existsSync(join(ROOT, 'skills', 'core', 'ink-layout', 'references', q.tok('scrollable-view.md'))), 'the referenced file exists');
    const clipped = (props) => render(h(Box, { width: 4, height: 1, ...props }, h(Box, { width: 8, flexShrink: 0 }, h(Text, null, 'abcdefgh'))));
    const drawn = { visible: 'abcdefgh', hidden: 'abcd' };
    t.equal(clipped({}), pick(drawn, fallback), 'the default is visible');
    for (const member of list) t.equal(clipped({ [prop]: member }), pick(drawn, member), `${member}`);
    t.equal(clipped({ [prop]: 'hidden' }), clipped({ overflowX: 'hidden', overflowY: 'hidden' }), 'overflow is the shorthand for both axes');
    t.equal(clipped({ [prop]: 'hidden', [offX]: 4 }), 'efgh', 'with contentOffsetX the clipped content scrolls left');
    const rowsView = (props) => render(h(Box, { width: 4, height: 1, flexDirection: 'column', ...props }, h(Box, { flexDirection: 'column', width: 8, flexShrink: 0 }, h(Text, null, 'abcdefgh'), h(Text, null, 'ijklmnop'))));
    t.equal(rowsView({ [prop]: 'hidden', [offY]: 1 }), 'ijkl', 'and with contentOffsetY it scrolls up');
    t.deepEqual([...list].sort(), Object.keys(drawn).sort());
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
    const offset = q.tok(prop);
    const two = pick({ number: 2 }, q.tok('number'));
    const zero = Number(q.tok('0'));
    const [overflowProp, hidden] = prop === 'contentOffsetX' ? propAndValue(q.tok('overflow="hidden"')) : ['overflow', 'hidden'];
    const view = (value) => {
      const props = value === undefined ? {} : { [offset]: value };
      return render(h(Box, { width: 4, height: 2, [overflowProp]: hidden, flexDirection: 'column', ...props }, h(Box, { flexDirection: 'column', flexShrink: 0, width: 8 }, h(Text, null, 'abcdefgh'), h(Text, null, 'ijklmnop'), h(Text, null, 'qrstuvwx'))));
    };
    t.equal(view(undefined), view(zero), 'the default is 0');
    if (dimension === 'X') {
      t.equal(view(two).split('\n')[0], 'cdef', 'shifts children left by N columns');
      t.equal(view(two + 0.9), view(two), 'a fractional offset truncates toward zero');
      t.equal(view(-1.9), view(-1), 'also for negatives');
      t.equal(view(Number.NaN), view(0), 'NaN becomes 0');
      t.equal(view(Infinity), view(0), 'and so does Infinity');
    } else {
      t.equal(view(two - 1).split('\n')[0], 'ijkl', 'shifts children up by N rows');
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
