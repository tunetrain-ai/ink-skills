// Claims for skills/ecosystem/data-display/ink-tables/SKILL.md.
import semver from 'semver';
import * as alcalzone from '@alcalzone/ink-table';
import { skill, tsx, h, ink, React, stripAnsi, extPkg, extReadFile, runExternal, pkg } from '../lib/index.mjs';
import { npmInstall } from './ink-navigation.helpers.mjs';

const { Box, Text, renderToString } = ink;
const { Table } = alcalzone;
const s = skill('ink-tables');
const F = 'SKILL.md';

const draw = (element, columns = 100) => stripAnsi(renderToString(element, { columns })).split('\n');
const base = { ink: pkg('ink').version, react: pkg('react').version };
const prop = (token) => token.match(/^([A-Za-z]+)/)[1];

const DESCRIPTION = 'Render tabular data in an Ink terminal UI — using @alcalzone/ink-table (data/columns/padding/header/cell/skeleton props, per-column alignment) or a hand-rolled <Box>/<Text> grid when you need full control.';

// ===================================================================== description

s.fact(F, [DESCRIPTION], { kind: 'R' }, async (t) => {
  const names = DESCRIPTION.match(/\(([^)]*) props,/)[1].split('/');
  t.deepEqual(names, ['data', 'columns', 'padding', 'header', 'cell', 'skeleton']);
  const rows = [{ a: 1, b: 'x' }];
  const plain = draw(h(Table, { data: rows }));
  t.ok(plain.length > 1, 'positive control: the table draws');
  t.notDeepEqual(draw(h(Table, { data: [{ a: 2, b: 'y' }] })), plain, 'data is the rows');
  t.notDeepEqual(draw(h(Table, { data: rows, columns: ['b'] })), plain, 'columns picks the columns');
  t.notDeepEqual(draw(h(Table, { data: rows, padding: 2 })), plain, 'padding spaces the cells');
  const called = new Set();
  const spy = (name) => (props) => (called.add(name), h(Text, null, props.children));
  draw(h(Table, { data: rows, header: spy('header'), cell: spy('cell'), skeleton: spy('skeleton') }));
  t.deepEqual([...called].sort(), ['cell', 'header', 'skeleton'], 'header, cell and skeleton are renderers the table calls');
  const numbers = [{ n: 17 }, { n: 3 }];
  t.notDeepEqual(draw(h(Table, { data: numbers, columns: [{ key: 'n', align: 'right' }] })), draw(h(Table, { data: numbers, columns: ['n'] })), 'per-column alignment');
  t.equal(typeof (await s.runFence(F, 2)).mod.SimpleTable, 'function', 'and the grid of <Box> and <Text> is a component you write');
});

s.guidance(F, ['Use when the user wants to display rows of data in columns.'], 'tells an agent when to load the skill; it asserts nothing about behaviour');

// ===================================================================== the original ink-table

s.fact(
  F,
  ['The original `ink-table` is a CommonJS package that `require()`s Ink, so it throws `ERR_REQUIRE_ASYNC_MODULE` on Ink 8 and cannot be used (see `ink-ecosystem-overview`).'],
  { kind: 'P', ctx: ['ink-ecosystem-overview'] },
  async (t, q) => {
    const name = q.tok('ink-table');
    const meta = extPkg(name);
    t.notEqual(meta.type, 'module', 'a CommonJS package');
    const source = extReadFile(name, meta.main);
    t.ok(source.includes(q.tok('require()').replace('()', '("ink")')), 'that require()s Ink');
    t.equal(semver.major(extPkg('ink').version), Number(q.tok('8')), 'the Ink in use');
    const run = await runExternal({ code: `try { await import('${name}'); console.log(JSON.stringify({loaded: true})); } catch (e) { console.log(JSON.stringify({loaded: false, code: e.code})); }` });
    if (semver.gte(process.versions.node, '22.12.0')) t.equal(run.json?.code, q.tok('ERR_REQUIRE_ASYNC_MODULE'), 'so importing it throws');
    else t.equal(run.json?.loaded, false);
  },
);

s.fact(
  F,
  ['`@alcalzone/ink-table` is an ESM package with the same props (its `columns` also accepts `{key, align}` objects) and a **named** `Table` export.'],
  { kind: 'R', ctx: ['named', '{key, align}'] },
  async (t, q) => {
    const name = q.tok('@alcalzone/ink-table');
    const meta = pkg(name);
    t.equal(meta.type, 'module', 'ESM');
    t.deepEqual(Object.keys(meta.exports).filter((condition) => condition !== 'types'), ['import'], 'with an import entry only');
    t.ok(typeof alcalzone[q.tok('Table')] === 'function', 'Table is a named export');
    t.equal(alcalzone.default, undefined, 'and there is no default export');
    const columns = q.tok('columns');
    const data = [{ name: 'Sosa Saunders', age: 17 }];
    const aligned = draw(h(Table, { data, [columns]: ['name', { key: 'age', align: 'right' }] }));
    const plain = draw(h(Table, { data, [columns]: ['name', 'age'] }));
    t.notDeepEqual(aligned, plain, 'columns takes {key, align} objects next to plain keys');
    t.equal(aligned[3], '│ Sosa Saunders │  17 │', 'align: right pushes the value to the right edge of the cell');
    t.equal(plain[3], '│ Sosa Saunders │ 17  │', 'while a plain key is left-aligned');
  },
);

// The two packages live in different projects (ink-table next to Ink 8 only under tests/external,
// @alcalzone/ink-table in the root), so the fixture compares them in one program by importing the
// root copy by path.
s.types(
  F,
  ['`@alcalzone/ink-table` is an ESM package with the same props (its `columns` also accepts `{key, align}` objects) and a **named** `Table` export.'],
  tsx`
import React from 'react';
import Original from 'ink-table';
import {Table as Alcalzone} from '../../../../node_modules/@alcalzone/ink-table/dist/index.js';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Row = {name: string; age: number};
type OriginalProps = React.ComponentProps<typeof Original<Row>>;
type AlcalzoneProps = React.ComponentProps<typeof Alcalzone<Row>>;

// the same prop names ...
export const sameKeys: Same<keyof OriginalProps, keyof AlcalzoneProps> = true;
export const sixOfThem: Same<keyof AlcalzoneProps, 'data' | 'columns' | 'padding' | 'header' | 'cell' | 'skeleton'> = true;
// ... with the same types, except that columns takes {key, align} objects too
export const sameData: Same<OriginalProps['data'], AlcalzoneProps['data']> = true;
export const samePadding: Same<OriginalProps['padding'], AlcalzoneProps['padding']> = true;
export const sameHeader: Same<OriginalProps['header'], AlcalzoneProps['header']> = true;
export const sameCell: Same<OriginalProps['cell'], AlcalzoneProps['cell']> = true;
export const sameSkeleton: Same<OriginalProps['skeleton'], AlcalzoneProps['skeleton']> = true;
export const sameColumns: Same<OriginalProps['columns'], AlcalzoneProps['columns']> = true; //! TS2322
export const columnsWiden: [OriginalProps['columns']] extends [AlcalzoneProps['columns']] ? true : false = true;

export const original = <Original data={[{name: 'a', age: 1}]} columns={['name']} />;
export const alignedOriginal = <Original data={[{name: 'a', age: 1}]} columns={[{key: 'age', align: 'right'}]} />; //! TS2769
export const aligned = <Alcalzone data={[{name: 'a', age: 1}]} columns={[{key: 'age', align: 'right'}]} />;
`,
  { project: 'external', ctx: ['named', '{key, align}', 'columns', '@alcalzone/ink-table'] },
);

s.fact(F, ['It renders on Ink 8 and installs with strict peer dependencies.'], { kind: 'P' }, async (t, q) => {
  t.equal(semver.major(pkg('ink').version), Number(q.tok('8')), 'the Ink in use');
  t.deepEqual(draw(h(Table, { data: [{ a: 1 }] })), ['┌───┐', '│ a │', '├───┤', '│ 1 │', '└───┘'], 'it draws a table');
  const fence = s.fenceOf(F, 0);
  const [, , ...packages] = fence.code.trim().split(/\s+/);
  const run = await npmInstall({ dependencies: base, install: packages });
  t.equal(run.status, 0, `resolves next to Ink ${base.ink} without --legacy-peer-deps`);
  t.ok(run.lock.packages['node_modules/@alcalzone/ink-table']);
});

s.fence(F, 0, {
  run: async (t, fence) => {
    const [command, subcommand, ...packages] = fence.code.trim().split(/\s+/);
    t.deepEqual([command, subcommand, packages], ['npm', 'install', ['@alcalzone/ink-table']]);
  },
});

// ===================================================================== the example

s.fence(F, 1, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const { apps } = await runFence(fence, { mountOptions: { columns: 80 } });
    await apps[0].flush();
    t.equal(
      apps[0].screen(),
      [
        '┌───────────────┬─────┐',
        '│ name          │ age │',
        '├───────────────┼─────┤',
        '│ Sosa Saunders │  17 │',
        '├───────────────┼─────┤',
        '│ Angelina Kirk │   3 │',
        '└───────────────┴─────┘',
      ].join('\n'),
      'two columns, the second one right-aligned; email is not a column',
    );
  },
});

// ===================================================================== the props table

const DATA_ROW = '| `data` | `T[]` | Rows — array of plain objects whose values are `string | number | boolean | null | undefined`. **Required.** |';
const COLUMNS_ROW = "| `columns` | `(keyof T | {key: keyof T; align?: 'left' | 'right' | 'center'})[]` | Which keys to show, in order. Defaults to the union of the keys of **all** rows. |";
const PADDING_ROW = '| `padding` | `number` | Spaces of padding on each side of a cell; the default is `1` and `0` counts as `1`. |';
const HEADER_ROW = '| `header` | `(props) => JSX.Element` | Custom renderer for each header cell. |';
const CELL_ROW = '| `cell` | `(props: {column: number; children}) => JSX.Element` | Custom cell renderer. |';
const SKELETON_ROW = '| `skeleton` | `(props) => JSX.Element` | Custom border/divider renderer. |';

s.types(
  F,
  [DATA_ROW],
  tsx`
import React from 'react';
import {Table} from '@alcalzone/ink-table';

type Scalar = string | number | boolean | null | undefined;
type Props<T> = React.ComponentProps<typeof Table<T extends {[key: string]: Scalar} ? T : never>>;
type Row = {a: string; b: number; c: boolean; d: null; e: undefined};
type Data = Props<Row>['data'];
type Rows<T> = {data: T[]}['data'];
export const isAnArrayOfRows: [Data] extends [Rows<Row>] ? ([Rows<Row>] extends [Data] ? true : false) : false = true;

export const scalars = <Table data={[{a: 'x', b: 1, c: true, d: null, e: undefined}]} />;
export const required = <Table />; //! TS2769
export const notAnArray = <Table data={{a: 1}} />; //! TS2769
export const objectValue = <Table data={[{a: {x: 1}}]} />; //! TS2769
export const arrayValue = <Table data={[{a: [1, 2]}]} />; //! TS2769
export const functionValue = <Table data={[{a: () => 1}]} />; //! TS2769
export const symbolValue = <Table data={[{a: Symbol('x')}]} />; //! TS2769
export const bigintValue = <Table data={[{a: 1n}]} />; //! TS2769
`,
  { ctx: ['Required.'] },
);

s.fact(F, [DATA_ROW], { kind: 'R', ctx: ['string | number | boolean | null | undefined', 'Required.'] }, async (t, q) => {
  const data = prop(q.tok('data'));
  t.equal(q.tok('T[]'), 'T[]');
  const rows = [{ a: 'x', b: 1, c: true, d: null, e: undefined }];
  t.deepEqual(draw(h(Table, { [data]: rows })), ['┌───┬───┬──────┬───┬───┐', '│ a │ b │ c    │ d │ e │', '├───┼───┼──────┼───┼───┤', '│ x │ 1 │ true │   │   │', '└───┴───┴──────┴───┴───┘'], 'each scalar is shown as text; null and undefined are empty cells');
  t.equal(draw(h(Table, { [data]: [{ a: 1 }, { a: 2 }, { a: 3 }] })).filter((line) => /^│ \d │$/.test(line)).length, 3, 'one row per element');
  t.throws(() => renderToString(h(Table, {})), 'without data there is nothing to draw: it throws');
});

s.types(
  F,
  [COLUMNS_ROW],
  tsx`
import React from 'react';
import {Table} from '@alcalzone/ink-table';
import type {TableProps} from '@alcalzone/ink-table';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Row = {name: string; age: number};
type T = Row;
type Columns = (keyof T | {key: keyof T; align?: 'left' | 'right' | 'center'})[];

export const exact: Same<TableProps<Row>['columns'], Columns> = true;
export const keys = <Table data={[{name: 'a', age: 1}]} columns={['age', 'name']} />;
export const aligned = <Table data={[{name: 'a', age: 1}]} columns={[{key: 'age', align: 'right'}, {key: 'name', align: 'center'}, {key: 'name'}, 'age']} />;
export const unknownKey = <Table data={[{name: 'a', age: 1}]} columns={['nope']} />; //! TS2769
export const badAlign = <Table data={[{name: 'a', age: 1}]} columns={[{key: 'age', align: 'justify'}]} />; //! TS2769
`,
  { ctx: ['all'] },
);

s.fact(F, [COLUMNS_ROW], { kind: 'R', ctx: ["(keyof T | {key: keyof T; align?: 'left' | 'right' | 'center'})[]", 'all'] }, async (t, q) => {
  const columns = prop(q.tok('columns'));
  const data = [{ a: 1 }, { b: 2, a: 3 }, { c: 4 }];
  const header = (props) => draw(h(Table, { data, ...props }))[1];
  t.equal(header({ [columns]: ['b', 'a'] }), '│ b │ a │', 'it shows the keys you list, in the order you list them');
  t.equal(header({ [columns]: ['c'] }), '│ c │', 'and only those');
  t.equal(header({}), '│ a │ b │ c │', `without it: the keys of all the rows, in order of first appearance`);
  t.equal(header({ [columns]: ['a'] }), '│ a │', 'positive control: the later rows would add columns b and c');
  const aligned = (align) => draw(h(Table, { data: [{ name: 'Sosa Saunders' }, { name: 'Al' }], [columns]: [{ key: 'name', align }] }));
  t.deepEqual(aligned('left').slice(3).filter((l) => l.startsWith('│')), ['│ Sosa Saunders │', '│ Al            │']);
  t.deepEqual(aligned('right').slice(3).filter((l) => l.startsWith('│')), ['│ Sosa Saunders │', '│            Al │']);
  t.deepEqual(aligned('center').slice(3).filter((l) => l.startsWith('│')), ['│ Sosa Saunders │', '│      Al       │']);
});

s.types(
  F,
  [PADDING_ROW],
  tsx`
import React from 'react';
import {Table} from '@alcalzone/ink-table';
import type {TableProps} from '@alcalzone/ink-table';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const number: Same<TableProps<{a: number}>['padding'], number> = true;
export const ok = <Table data={[{a: 1}]} padding={2} />;
export const notANumber = <Table data={[{a: 1}]} padding="2" />; //! TS2769
`,
  { ctx: ['padding', '1', '0'] },
);

s.fact(F, [PADDING_ROW], { kind: 'D', ctx: ['number'] }, async (t, q) => {
  const padding = prop(q.tok('padding'));
  const [fallback, zero] = [Number(q.tok('1')), Number(q.tok('0'))];
  const cell = (props) => draw(h(Table, { data: [{ a: 'x' }], ...props }))[3];
  t.equal(cell({}), '│ x │', 'one space on each side by default');
  t.equal(cell({ [padding]: 3 }), `│${' '.repeat(3)}x${' '.repeat(3)}│`, 'padding is the number of spaces on each side of a cell');
  t.equal(cell({ [padding]: fallback }), cell({}), `${fallback} is the default`);
  t.ok(zero < fallback, 'zero is below the default');
  t.equal(cell({ [padding]: zero }), cell({}), `${zero} counts as ${fallback}: it cannot remove the padding`);
});

s.types(
  F,
  [HEADER_ROW, CELL_ROW, SKELETON_ROW],
  tsx`
import React from 'react';
import {Text} from 'ink';
import {Table} from '@alcalzone/ink-table';
import type {TableProps} from '@alcalzone/ink-table';

type Props = TableProps<{a: number}>;
export const header = <Table data={[{a: 1}]} header={(props) => <Text color="blue">{props.children}</Text>} />;
export const cell = <Table data={[{a: 1}]} cell={(props: {column: number; children?: React.ReactNode}) => <Text>{props.column}{props.children}</Text>} />;
export const skeleton = <Table data={[{a: 1}]} skeleton={(props) => <Text dimColor>{props.children}</Text>} />;
export const cellColumn: Props['cell'] extends (props: {column: number; children?: React.ReactNode}) => unknown ? true : false = true;
export const cellProps = <Table data={[{a: 1}]} cell={(props) => <Text>{props.nope}</Text>} />; //! TS2339
export const notAFunction = <Table data={[{a: 1}]} header="x" />; //! TS2769
`,
  { ctx: ['header', 'cell', 'skeleton', '(props) => JSX.Element', '(props: {column: number; children}) => JSX.Element'] },
);

s.fact(F, [HEADER_ROW, CELL_ROW, SKELETON_ROW], { kind: 'R', ctx: ['(props) => JSX.Element', '(props: {column: number; children}) => JSX.Element'] }, async (t, q) => {
  const [header, cell, skeleton] = [prop(q.tok('header')), prop(q.tok('cell')), prop(q.tok('skeleton'))];
  const calls = { header: [], cell: [], skeleton: [] };
  const spy = (kind) => (props) => (calls[kind].push(props), h(Text, null, `${kind[0].toUpperCase()}<${props.children}>`));
  const lines = draw(h(Table, { data: [{ a: 1, b: 2 }, { a: 3, b: 4 }], [header]: spy('header'), [cell]: spy('cell'), [skeleton]: spy('skeleton') }));
  t.deepEqual(calls.header.map((props) => props.children), [' a ', ' b '], 'header is called once for each header cell');
  t.deepEqual(calls.cell.map((props) => props.children), [' 1 ', ' 2 ', ' 3 ', ' 4 '], 'cell once for each data cell');
  t.deepEqual(calls.cell.map((props) => props.column), [0, 1, 0, 1], 'with the index of its column');
  t.deepEqual(Object.keys(calls.cell[0]).sort(), ['children', 'column'], 'and nothing else');
  t.equal(lines.join('\n').replace(/[HCS]<[^>]*>/g, '').trim(), '', 'everything on screen came out of the three renderers');
  t.ok(lines[0].startsWith('S<┌>S<───>S<┬>S<───>S<┐>'), 'skeleton draws the borders ...');
  t.ok(lines[2].startsWith('S<├>S<───>S<┼>S<───>S<┤>'), '... and the dividers between rows');
  t.ok(lines[1].startsWith('S<│>H< a >S<│>H< b >S<│>'), 'including the vertical bars around the cells');
  t.ok(calls.skeleton.length > 20 && calls.skeleton.every((props) => /^[─│┌┬┐├┼┤└┴┘]+$/.test(props.children)), 'it is only ever given border characters');
});

// ===================================================================== class component, types

s.types(
  F,
  ['`Table` is a class component and `T` must be an object type with scalar values: declare row types with a `type` alias (an `interface` has no index signature and is rejected) or let TypeScript infer them from the array, as above.'],
  tsx`
import React from 'react';
import {Table} from '@alcalzone/ink-table';

type Row = {name: string; age: number};
interface Person {
	name: string;
	age: number;
}

const rows: Row[] = [{name: 'Sosa', age: 17}];
const people: Person[] = [{name: 'Sosa', age: 17}];

export const aTypeAlias = <Table data={rows} />;
export const inferred = <Table data={[{name: 'Sosa', age: 17}]} columns={['name']} />;
export const anInterface = <Table data={people} />; //! TS2769
export const isAClass: typeof Table extends new (props: never) => React.Component ? true : false = true;
`,
  { ctx: ['Table', 'T', 'type', 'interface'] },
);

s.fact(
  F,
  ['`Table` is a class component and `T` must be an object type with scalar values: declare row types with a `type` alias (an `interface` has no index signature and is rejected) or let TypeScript infer them from the array, as above.'],
  { kind: 'T', ctx: ['T', 'type', 'interface'] },
  async (t, q) => {
    const component = q.api(alcalzone, 'Table');
    t.ok(component.prototype instanceof React.Component, 'a class component');
    t.equal(typeof component.prototype.render, 'function');
  },
);

s.fact(F, ['Nested objects and arrays are not supported as cell values — format them to strings first.'], { kind: 'R' }, async (t) => {
  t.deepEqual(draw(h(Table, { data: [{ a: { x: 1 }, b: [1, 2] }] })).slice(2, 4), ['├─────────────────┼─────┤', '│ [object Object] │ 1,2 │'], 'they are drawn as String(value): [object Object] and the joined array');
  t.deepEqual(draw(h(Table, { data: [{ a: JSON.stringify({ x: 1 }), b: [1, 2].join(', ') }] })).slice(3, 4), ['│ {"x":1} │ 1, 2 │'], 'formatting them first is what works');
});

// ===================================================================== the hand-rolled table

s.fact(
  F,
  ['When the column/cell model doesn\'t fit (mixed cell content, per-cell coloring you don\'t want to route through a custom `cell` renderer, or avoiding a dependency for a small, fixed table), a table is just a `<Box flexDirection="column">` of row `<Box>`es with fixed-width cells:'],
  { kind: 'R', ctx: ['cell', '<Box>'] },
  async (t, q) => {
    const direction = q.tok('<Box flexDirection="column">').match(/flexDirection="(\w+)"/)[1];
    const { mod } = await s.runFence(F, 2);
    const out = draw(h(mod.SimpleTable, { rows: [{ name: 'Sosa Saunders', age: 17 }, { name: 'Al', age: 3 }] }));
    t.deepEqual(out, [`${'Name'.padEnd(20)}Age`, `${'Sosa Saunders'.padEnd(20)}17`, `${'Al'.padEnd(20)}3`], 'the header and one row per entry, each cell in its own fixed-width box');
    const stack = (flexDirection) => draw(h(Box, { flexDirection }, h(Box, null, h(Text, null, 'row 1')), h(Box, null, h(Text, null, 'row 2'))));
    t.deepEqual(stack(direction), ['row 1', 'row 2'], 'rows are stacked by a column <Box>');
    t.deepEqual(stack('row'), ['row 1row 2'], 'positive control: a row <Box> would put them side by side');
    t.ok(s.fenceOf(F, 2).code.includes(`flexDirection="${direction}"`), 'which is what the example uses');
    // mixed cell content: any element can be a cell
    const mixed = renderToString(h(Box, { flexDirection: 'column' }, h(Box, null, h(Box, { width: 6 }, h(Text, { color: 'green' }, 'ok')), h(Box, { width: 6 }, h(Text, null, 'plain')))));
    t.equal(stripAnsi(mixed), 'ok    plain', 'a cell can hold any element, coloured text included');
  },
);

s.guidance(F, ["When the column/cell model doesn't fit (mixed cell content, per-cell coloring you don't want to route through a custom `cell` renderer, or avoiding a dependency for a small, fixed table)"], 'says when to hand-roll a table instead of using the package; the construction itself is proven by the fact claim on the same sentence', { exempt: ['cell'] });

s.fence(F, 2, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const { mod } = await runFence(fence);
    t.deepEqual(draw(h(mod.SimpleTable, { rows: [{ name: 'Sosa Saunders', age: 17 }] })), [`${'Name'.padEnd(20)}Age`, `${'Sosa Saunders'.padEnd(20)}17`]);
  },
});

s.fact(
  F,
  ['Fixed `width` on each column `<Box>` is what keeps columns aligned — text that overflows a column wraps by default (see `ink-text-styling`\'s `wrap` prop to truncate instead).'],
  { kind: 'R', ctx: ['<Box>', 'ink-text-styling'] },
  async (t, q) => {
    const width = q.tok('width');
    const wrap = q.tok('wrap');
    const rows = [['Sosa Saunders', '17'], ['Al', '3']];
    const grid = (cellProps) => draw(h(Box, { flexDirection: 'column' }, ...rows.map((row, i) => h(Box, { key: i }, ...row.map((text, c) => h(Box, { key: c, ...cellProps(c) }, h(Text, null, text)))))));
    t.deepEqual(grid((c) => ({ [width]: [16, 4][c] })), [`${'Sosa Saunders'.padEnd(16)}17`, `${'Al'.padEnd(16)}3`], 'with a fixed width per column the second column starts at the same place in every row');
    t.deepEqual(grid(() => ({})), ['Sosa Saunders17', 'Al3'], 'positive control: without widths the cells run together');
    const narrow = draw(h(Box, { width: 10 }, h(Text, null, 'Sosa Saunders')));
    t.deepEqual(narrow, ['Sosa', 'Saunders'], 'text that overflows a column wraps by default');
    const truncated = draw(h(Box, { width: 10 }, h(Text, { [wrap]: 'truncate' }, 'Sosa Saunders')));
    t.deepEqual(truncated, ['Sosa Saun…'], 'wrap="truncate" cuts it to the column instead');
    t.ok(skill('ink-text-styling'), 'ink-text-styling is a skill of this catalogue');
  },
);

s.fact(
  F,
  ['For column widths that should adapt to content (e.g. the widest cell in each column), compute the max string length per column before rendering — there\'s no automatic "auto" column sizing in plain `<Box>` layout.'],
  { kind: 'R', ctx: ['<Box>', 'auto'] },
  async (t, q) => {
    const auto = 'auto';
    const rows = [['Sosa Saunders', '17'], ['Al', '3']];
    const grid = (widthOf) => draw(h(Box, { flexDirection: 'column' }, ...rows.map((row, i) => h(Box, { key: i }, ...row.map((text, c) => h(Box, { key: c, width: widthOf(c) }, h(Text, null, text)))))));
    t.deepEqual(grid(() => auto), ['Sosa Saunders17', 'Al3'], `width="${auto}" does not align the columns: each row sizes its own cells`);
    t.deepEqual(grid(() => '50%'), [`${'Sosa Saunders'.padEnd(50)}17`, `${'Al'.padEnd(50)}3`], 'positive control: a percentage is a width Ink understands, and aligns the columns');
    const widest = (c) => Math.max(...rows.map((row) => row[c].length)) + 2;
    t.deepEqual(grid(widest), [`${'Sosa Saunders'.padEnd(15)}17`, `${'Al'.padEnd(15)}3`], 'the widest string in a column plus a gap, computed beforehand, does');
  },
);
