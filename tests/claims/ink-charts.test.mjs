// Claims for skills/ecosystem/data-display/ink-charts/SKILL.md.
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import semver from 'semver';
import * as charts from '@pppp606/ink-chart';
import { skill, tsx, h, ink, stripAnsi, loadEcosystem, extPkg, extPackageDir, extReadFile, runExternal, pkg, packageDir } from '../lib/index.mjs';
import { npmInstall } from './ink-navigation.helpers.mjs';

const { Box, Text, renderToString } = ink;
const { Sparkline, BarChart, StackedBarChart, LineGraph } = charts;
const s = skill('ink-charts');
const F = 'SKILL.md';

const rows = (element, columns = 100) => stripAnsi(renderToString(element, { columns })).split('\n');
const raw = (element, columns = 100) => renderToString(element, { columns });
const SGR_RGB = /\x1b\[38;2;(\d+);(\d+);(\d+)m/;

/** `mode?: 'block' | 'braille'` -> {name, optional, type}. Anything that is not a prop token throws, so a changed token fails its claim. */
const prop = (token) => {
  const m = token.match(/^([A-Za-z]+)(\?)?(?:: (.+))?$/);
  if (!m) throw new Error(`not a prop: ${token}`);
  return { name: m[1], optional: Boolean(m[2]), type: m[3] };
};
/** The members of a union type text: `'a' | 1 | number` -> [{literal: 'a'}, {literal: 1}, {kind: 'number'}]. */
const members = (type) =>
  type.split(' | ').map((member) => {
    if (/^'[^']*'$/.test(member)) return { literal: member.slice(1, -1) };
    if (/^\d+$/.test(member)) return { literal: Number(member) };
    if (['number', 'number[]', '[number, number]'].includes(member)) return { kind: member };
    throw new Error(`not a type member: ${member}`);
  });
const literals = (type) => members(type).map((m) => m.literal);
/** `data: {label, value, color?, char?}[]` -> the props of one element. */
const elementProps = (token) => {
  const m = token.match(/^data: \{(.+)\}\[\]$/);
  if (!m) throw new Error(`not a data prop: ${token}`);
  return m[1].split(', ').map(prop);
};
/** The escape sequence Ink opens text of `color` with in this environment (how many colours a terminal has is not the skill's business). */
const sgrOf = (color) => raw(h(Text, { color }, 'x')).match(/^(\x1b\[[0-9;]*m)x/)[1];
const count = (text, char) => [...text].filter((c) => c === char).length;

const DESCRIPTION = 'Render sparklines, bar charts, stacked bar charts, and line graphs in an Ink terminal UI with the @pppp606/ink-chart package (Sparkline, BarChart, StackedBarChart, LineGraph), or build a simple custom chart from <Box> blocks.';
const COMPONENTS = DESCRIPTION.match(/\(([^)]*)\)/)[1].split(', ');
const base = { ink: pkg('ink').version, react: pkg('react').version };

// ===================================================================== description

s.fact(F, [DESCRIPTION], { kind: 'R' }, async (t) => {
  const names = COMPONENTS;
  t.deepEqual(names, ['Sparkline', 'BarChart', 'StackedBarChart', 'LineGraph']);
  const data = [{ label: 'a', value: 1 }, { label: 'b', value: 2 }];
  const drawn = {
    Sparkline: rows(h(charts[names[0]], { data: [1, 3, 2] })),
    BarChart: rows(h(charts[names[1]], { data })),
    StackedBarChart: rows(h(charts[names[2]], { data })),
    LineGraph: rows(h(charts[names[3]], { data: [{ values: [1, 3, 2] }] })),
  };
  for (const name of names) t.ok(drawn[name].join('').trim().length > 0, `${name} draws something`);
  const { mod } = await s.runFence(F, 2);
  t.ok(rows(h(mod.Bar, { label: 'x', value: 5, max: 10 })).join('').trim().length > 0, 'and so does a chart made from <Box> blocks');
});

s.guidance(F, ['Use when the user wants a chart, graph, or sparkline in their CLI output.'], 'tells an agent when to load the skill; it asserts nothing about behaviour');

// ===================================================================== install

s.fence(F, 0, {
  run: async (t, fence) => {
    const [command, subcommand, ...packages] = fence.code.trim().split(/\s+/);
    t.deepEqual([command, subcommand], ['npm', 'install']);
    const run = await npmInstall({ dependencies: base, install: packages });
    t.equal(run.status, 0, `resolves next to Ink ${base.ink} with strict peer dependencies`);
    for (const name of packages) t.ok(run.lock.packages[`node_modules/${name}`], `${name} is in the resolved tree`);
  },
});

s.fact(
  F,
  ['**Do not install `ink-chart`** — that unscoped name is an unrelated package with a different API (a default-exported `Chart`): it is a CommonJS build that `require()`s Ink, so importing it on Ink 8 throws `ERR_REQUIRE_ASYNC_MODULE`, and it has none of the components below.'],
  { kind: 'P', ctx: ['Do not install `ink-chart`'] },
  async (t, q) => {
    const name = q.tok('ink-chart');
    const { packages } = await loadEcosystem();
    const unscoped = packages.find((p) => p.name === name);
    const scoped = packages.find((p) => p.name === `@pppp606/${name}`);
    t.ok(unscoped && scoped, 'both names are in the registry data');
    t.notEqual(unscoped.repository, scoped.repository, 'unrelated: another repository');
    t.deepEqual(unscoped.maintainers.filter((who) => scoped.maintainers.includes(who)), [], 'and another maintainer');

    const meta = extPkg(name);
    t.notEqual(meta.type, 'module', 'a CommonJS build');
    const source = extReadFile(name, meta.main);
    t.ok(source.includes(q.tok('require()').replace('()', "('ink')")), 'that require()s Ink');
    // evaluate the CommonJS file with Ink stubbed out: what does it export?
    const require = createRequire(join(extPackageDir(name), 'package.json'));
    const module = { exports: {} };
    new Function('require', 'module', 'exports', source)((id) => (id === 'ink' ? { Box: 'Box' } : require(id)), module, module.exports);
    t.equal(typeof module.exports, 'function', 'what it exports is one component');
    t.equal(module.exports.name, q.tok('Chart'), 'named Chart (the default export)');
    for (const component of COMPONENTS) {
      t.equal(module.exports[component], undefined, `no ${component}`);
      t.ok(charts[component], `positive control: @pppp606/ink-chart has ${component}`);
    }

    t.equal(semver.major(extPkg('ink').version), Number(q.tok('8')), 'the Ink in use');
    const run = await runExternal({ code: `try { await import('${name}'); console.log(JSON.stringify({loaded: true})); } catch (e) { console.log(JSON.stringify({loaded: false, code: e.code})); }` });
    if (semver.gte(process.versions.node, '22.12.0')) t.equal(run.json?.code, q.tok('ERR_REQUIRE_ASYNC_MODULE'), 'importing it throws');
    else t.equal(run.json?.loaded, false);
  },
);

s.fact(F, ['The package documented here is the scoped `@pppp606/ink-chart`: ESM, ships its own types, peer `ink >=6` (covers Ink 8), and pre-1.0 — pin the version.'], { kind: 'P' }, async (t, q) => {
  const name = q.tok('@pppp606/ink-chart');
  const meta = pkg(name);
  t.equal(meta.type, 'module', 'ESM');
  t.deepEqual(Object.keys(meta.exports['.']).filter((condition) => condition !== 'types'), ['import'], 'with an import entry only');
  t.ok(existsSync(join(packageDir(name), meta.types)), 'ships its own types');
  const [inkName, range] = q.tok('ink >=6').split(' ');
  t.equal(meta.peerDependencies[inkName], range);
  t.equal(semver.major(pkg(inkName).version), Number(q.tok('8')), 'the Ink in use');
  t.ok(semver.satisfies(pkg(inkName).version, range), 'which the range covers');
  t.ok(semver.major(meta.version) < Math.floor(Number(q.tok('1.0'))), `pre-1.0 (${meta.version})`);
});

s.guidance(F, ['pin the version'], 'advice that follows from the package being below 1.0; the version itself is proven by the sentence before it');

// ===================================================================== the example

s.fence(F, 1, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const { apps } = await runFence(fence, { mountOptions: { columns: 80 } });
    await apps[0].flush();
    const lines = apps[0].screen().split('\n');
    t.equal(lines[0], [...'▁▃▂█▄'].map((c) => c.repeat(6)).join(''), 'the five values stretched over 30 columns');
    t.equal(lines[1], 'Sales Trend', 'then its caption');
    t.equal(lines[2], `${'Success'.padEnd(7)} ${'▆'.repeat(39)} 22`, 'a bar chart row per entry, 50 columns wide');
    t.equal(lines[3], `${'Errors'.padEnd(7)} ${'▆'.repeat(26).padEnd(39)} 15`);
    t.equal(lines.length, 4);
    const bytes = apps[0].bytes();
    t.ok(bytes.includes(`${sgrOf('#4aaa1a')}Success`), 'the Success row is #4aaa1a');
    t.ok(bytes.includes(`${sgrOf('#a61d24')}Errors`), 'the Errors row is #a61d24');
    t.match(bytes, /\x1b\[38;2;255;\d+;\d+m▃/, 'and the sparkline paints the values above its thresholds in the red gradient');
  },
});

// ===================================================================== width

s.types(
  F,
  ["`width` on every component is `'auto' | 'full' | number`."],
  tsx`
import type {SparklineProps, BarChartProps, StackedBarChartProps, LineGraphProps} from '@pppp606/ink-chart';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Width = 'auto' | 'full' | number | undefined;

export const sparkline: Same<SparklineProps['width'], Width> = true;
export const barChart: Same<BarChartProps['width'], Width> = true;
export const stackedBarChart: Same<StackedBarChartProps['width'], Width> = true;
export const lineGraph: Same<LineGraphProps['width'], Width> = true;
export const notSame: Same<SparklineProps['width'], 'auto' | number | undefined> = true; //! TS2322
`,
  { ctx: ['width', "'auto' | 'full' | number"] },
);

s.fact(F, ["`width` on every component is `'auto' | 'full' | number`."], { kind: 'D', ctx: ["'auto' | 'full' | number"] }, async (t, q) => {
  const width = q.tok('width');
  const widest = (lines) => Math.max(...lines.map((line) => [...line].length));
  const data = [{ label: 'A', value: 10 }, { label: 'Bee', value: 20 }];
  t.deepEqual(rows(h(Sparkline, { data: [1, 2, 3, 4, 5], [width]: 40 })).map((l) => l.length), [40], 'Sparkline: a number is its width in characters');
  t.equal(rows(h(Sparkline, { data: [1, 2, 3, 4, 5], [width]: 'auto' }))[0].length, 5, 'and auto is one character per value');
  t.deepEqual(rows(h(BarChart, { data, [width]: 40, showValue: 'right' })).map((l) => l.length), [40, 40], 'BarChart: every row is that wide');
  t.notEqual(widest(rows(h(BarChart, { data, [width]: 'auto', showValue: 'right' }))), 40, 'auto is the natural width of the content');
  t.equal(rows(h(StackedBarChart, { data, [width]: 40 }))[1].length, 40, 'StackedBarChart: the bar is that wide');
  t.equal(widest(rows(h(LineGraph, { data: [{ values: [1, 5, 2, 8, 3] }], [width]: 40 }))), 40, 'LineGraph: the graph is that wide');
});

// ===================================================================== the props table

const SPARKLINE_ROW = "| `Sparkline` | Compact inline trend line | `data: number[]`, `width?`, `height?: 1 | 2 | 'braille'`, `mode?: 'block' | 'braille'`, `yDomain?: 'auto' | [number, number]`, `threshold?: number | number[]`, `colorScheme?: 'red' | 'blue' | 'green'`, `caption?` |";
const BARCHART_ROW = "| `BarChart` | Horizontal bars, one per category | `data: {label, value, color?, char?}[]`, `max?: 'auto' | number`, `sort?: 'none' | 'asc' | 'desc'`, `showValue?: 'right' | 'inside' | 'none'`, `format?: (value) => string`, `barChar?: '▆' | '█' | '▓' | '▒' | '░'`, `padding?: 0 | 1 | 2`, `width?`, `color?` |";
const STACKED_ROW = "| `StackedBarChart` | 100%-stacked or absolute horizontal bars | `data: {label, value, color?, char?}[]`, `mode?: 'percentage' | 'absolute'`, `max?`, `width?`, `showLabels?`, `showValues?`, `format?: (value, mode) => string` |";
const LINEGRAPH_ROW = '| `LineGraph` | Multi-series line graph with axes | `data: {values: number[], color?}[]`, `width?`, `height?: number`, `yDomain?`, `caption?`, `showYAxis?`, `yLabels?`, `xLabels?` |';

// every prop of a row, with the type the row gives it, is exactly the prop of the component
const exactness = tsx`
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Exact<P, S> = [keyof P] extends [keyof S] ? ([keyof S] extends [keyof P] ? ([{[K in keyof S]-?: Same<P[K], S[K]>}[keyof S]] extends [true] ? true : false) : false) : false;
`;

s.types(
  F,
  [SPARKLINE_ROW],
  tsx`
import type {SparklineProps} from '@pppp606/ink-chart';
import {Sparkline} from '@pppp606/ink-chart';
${exactness}
type Row = {
	data: number[];
	width?: 'auto' | 'full' | number;
	height?: 1 | 2 | 'braille';
	mode?: 'block' | 'braille';
	yDomain?: 'auto' | [number, number];
	threshold?: number | number[];
	colorScheme?: 'red' | 'blue' | 'green';
	caption?: string;
};

export const exact: Exact<SparklineProps, Row> = true;
export const drops: Exact<SparklineProps, Omit<Row, 'caption'>> = true; //! TS2322
export const rendered = <Sparkline data={[1, 2]} height="braille" mode="braille" yDomain={[0, 9]} threshold={[1, 2]} colorScheme="blue" caption="c" />;
export const needsData = <Sparkline />; //! TS2741
export const badScheme = <Sparkline data={[1]} colorScheme="purple" />; //! TS2322
`,
  { ctx: [] },
);

s.types(
  F,
  [BARCHART_ROW],
  tsx`
import type {BarChartProps, BarChartData} from '@pppp606/ink-chart';
import {BarChart} from '@pppp606/ink-chart';
${exactness}
type Row = {
	data: {label: string; value: number; color?: string; char?: string}[];
	max?: 'auto' | number;
	sort?: 'none' | 'asc' | 'desc';
	showValue?: 'right' | 'inside' | 'none';
	format?: (value: number) => string;
	barChar?: '▆' | '█' | '▓' | '▒' | '░';
	padding?: 0 | 1 | 2;
	width?: 'auto' | 'full' | number;
	color?: string;
};

export const exact: Exact<BarChartProps, Row> = true;
export const element: Exact<BarChartData, {label: string; value: number; color?: string; char?: string}> = true;
export const drops: Exact<BarChartProps, Omit<Row, 'color'>> = true; //! TS2322
export const rendered = <BarChart data={[{label: 'a', value: 1, color: 'red', char: '#'}]} max={5} sort="asc" showValue="inside" format={(value) => String(value)} barChar="█" padding={2} width={20} color="blue" />;
export const badChar = <BarChart data={[]} barChar="#" />; //! TS2322
export const badPadding = <BarChart data={[]} padding={3} />; //! TS2322
`,
  { ctx: ['data: {label, value, color?, char?}[]', 'format?: (value) => string'] },
);

s.types(
  F,
  [STACKED_ROW],
  tsx`
import type {StackedBarChartProps, StackedBarSegment} from '@pppp606/ink-chart';
import {StackedBarChart} from '@pppp606/ink-chart';
${exactness}
type Row = {
	data: {label: string; value: number; color?: string; char?: string}[];
	mode?: 'percentage' | 'absolute';
	max?: 'auto' | number;
	width?: 'auto' | 'full' | number;
	showLabels?: boolean;
	showValues?: boolean;
	format?: (value: number, mode: 'percentage' | 'absolute') => string;
};

export const exact: Exact<StackedBarChartProps, Row> = true;
export const element: Exact<StackedBarSegment, {label: string; value: number; color?: string; char?: string}> = true;
export const drops: Exact<StackedBarChartProps, Omit<Row, 'showValues'>> = true; //! TS2322
export const rendered = <StackedBarChart data={[{label: 'a', value: 1}]} mode="absolute" max={10} width={20} showLabels={false} showValues={false} format={(value, mode) => mode + value} />;
export const badMode = <StackedBarChart data={[]} mode="relative" />; //! TS2322
`,
  { ctx: ['100%', 'data: {label, value, color?, char?}[]', 'format?: (value, mode) => string'] },
);

s.types(
  F,
  [LINEGRAPH_ROW],
  tsx`
import type {LineGraphProps, LineGraphSeries} from '@pppp606/ink-chart';
import {LineGraph} from '@pppp606/ink-chart';
${exactness}
type Row = {
	data: {values: number[]; color?: string}[];
	width?: 'auto' | 'full' | number;
	height?: number;
	yDomain?: 'auto' | [number, number];
	caption?: string;
	showYAxis?: boolean;
	yLabels?: (string | number)[];
	xLabels?: (string | number)[];
};

export const exact: Exact<LineGraphProps, Row> = true;
export const element: Exact<LineGraphSeries, {values: number[]; color?: string}> = true;
export const drops: Exact<LineGraphProps, Omit<Row, 'xLabels'>> = true; //! TS2322
export const rendered = <LineGraph data={[{values: [1, 2], color: 'red'}]} width={20} height={4} yDomain={[0, 3]} caption="c" showYAxis yLabels={[0, 'hi']} xLabels={['a', 1]} />;
export const noValues = <LineGraph data={[{color: 'red'}]} />; //! TS2741
export const badHeight = <LineGraph data={[]} height="tall" />; //! TS2322
`,
  { ctx: ['data: {values: number[], color?}[]', 'height?: number'] },
);

s.fact(F, [SPARKLINE_ROW], { kind: 'R', ctx: ["height?: 1 | 2 | 'braille'"] }, async (t, q) => {
  const Component = q.api(charts, 'Sparkline');
  const data = prop(q.tok('data: number[]')).name;
  const draw = (props = {}, columns) => raw(h(Component, { [data]: [1, 3, 2, 8, 4], ...props }), columns);
  const plain = (props) => stripAnsi(draw(props));
  t.equal(plain(), '▁▃▂█▄', 'Compact inline trend line: one block character per value, tallest for the largest');

  const width = prop(q.tok('width?')).name;
  t.equal(plain({ [width]: 10 }).length, 10, 'width resamples the line to that many characters');

  const mode = prop(q.tok("mode?: 'block' | 'braille'"));
  const [block, braille] = literals(mode.type);
  t.equal(plain({ [mode.name]: block }), plain(), `${block} is what you get without mode`);
  t.match(plain({ [mode.name]: braille }), /^[⠀-⣿]{5}$/, `${braille} draws braille patterns`);
  t.notEqual(plain({ [mode.name]: braille }), plain(), 'which differ from the blocks');

  const domain = prop(q.tok("yDomain?: 'auto' | [number, number]"));
  const [auto] = literals(domain.type.replace(' | [number, number]', ''));
  t.equal(plain({ [domain.name]: auto }), plain(), `${auto} is the default: the range of the data`);
  t.equal(plain({ [domain.name]: [0, 100] }), '▁▁▁▁▁', 'a [min, max] pair fixes the range, so small values stay low');

  const caption = prop(q.tok('caption?')).name;
  t.deepEqual(rows(h(Component, { [data]: [1, 3, 2, 8, 4], [caption]: 'Sales Trend' })), ['▁▃▂█▄', 'Sales Trend'], 'caption goes on the line below');

  const threshold = prop(q.tok('threshold?: number | number[]'));
  const [single, many] = members(threshold.type);
  t.equal(single.kind, 'number');
  t.equal(many.kind, 'number[]');
  const above = draw({ [threshold.name]: 5 });
  t.equal(stripAnsi(above), '▁▃▂█▄', 'a number highlights ...');
  t.match(above, /▂\x1b\[\d+m█\x1b\[39m▄$/, '... only the value above it (8 > 5), painted');
  const gradient = draw({ [threshold.name]: [2, 4, 6] });
  t.equal(stripAnsi(gradient), '▁▃▂█▄');
  t.match(gradient, SGR_RGB, 'and an array paints a gradient');

  const scheme = prop(q.tok("colorScheme?: 'red' | 'blue' | 'green'"));
  const schemes = literals(scheme.type);
  const channel = (out) => out.match(SGR_RGB).slice(1, 4).map(Number);
  const dominant = { red: 0, green: 1, blue: 2 };
  for (const name of schemes) {
    const rgb = channel(draw({ [threshold.name]: [2, 4, 6], [scheme.name]: name }));
    t.equal(rgb[dominant[name]], 255, `${name}: the ${name} channel is full`);
    t.ok(rgb.filter((v, i) => i !== dominant[name]).every((v) => v < 255), `${name}: the other channels are not`);
  }
  t.equal(new Set(schemes).size, 3);
});

s.fact(F, [BARCHART_ROW], { kind: 'R', ctx: ["showValue?: 'right' | 'inside' | 'none'", 'padding?: 0 | 1 | 2'] }, async (t, q) => {
  const Component = q.api(charts, 'BarChart');
  const [label, value, color, char] = elementProps(q.tok('data: {label, value, color?, char?}[]')).map((p) => p.name);
  const entry = (name, v, extra = {}) => ({ [label]: name, [value]: v, ...extra });
  const entries = [entry('b', 20), entry('a', 10), entry('c', 30)];
  const draw = (props = {}, data = entries) => rows(h(Component, { data, width: 30, ...props }));
  const bar = (line) => count(line, '▆');

  const plain = draw();
  t.deepEqual(plain.map((line) => line[0]), ['b', 'a', 'c'], 'one row per entry, labelled');
  t.deepEqual(plain.map(bar), [18, 9, 28], 'with a bar in proportion to its value');

  const max = prop(q.tok("max?: 'auto' | number"));
  const [maxAuto] = literals(max.type.replace(' | number', ''));
  t.deepEqual(draw({ [max.name]: maxAuto }), plain, `${maxAuto} scales to the largest value`);
  t.deepEqual(draw({ [max.name]: 60 }).map(bar), [9, 4, 14], 'a number scales to that value instead');

  const sort = prop(q.tok("sort?: 'none' | 'asc' | 'desc'"));
  const orders = { none: ['b', 'a', 'c'], asc: ['a', 'b', 'c'], desc: ['c', 'b', 'a'] };
  for (const order of literals(sort.type)) t.deepEqual(draw({ [sort.name]: order }).map((line) => line[0]), orders[order], `sort ${order}`);

  const format = prop(q.tok('format?: (value) => string'));
  const received = [];
  const formatted = draw({ [format.name]: (...args) => (received.push(args), `${args[0]}%`), showValue: 'right' });
  t.deepEqual(formatted.map((line) => line.split(' ').at(-1)), ['20%', '10%', '30%'], 'format turns each value into the text shown after the bar');
  const parameters = format.type.match(/^\((.+)\) => string$/)[1].split(', ');
  t.ok(received.length >= 3 && received.every((args) => args.length === parameters.length), `it is called with (${parameters.join(', ')}): the value alone`);

  const barChar = prop(q.tok("barChar?: '▆' | '█' | '▓' | '▒' | '░'"));
  const chars = literals(barChar.type);
  t.equal(chars.length, 5);
  for (const c of chars) t.ok(draw({ [barChar.name]: c })[0].endsWith(c.repeat(18)), `${c} fills the bars`);
  t.equal(draw({ [barChar.name]: chars[0] }).join('\n'), plain.join('\n'), `${chars[0]} is what bars are drawn with by default`);

  t.match(draw({}, [entry('a', 10, { [char]: '#' })])[0], /^a #+$/, 'char draws one entry with another character');

  const width = prop(q.tok('width?')).name;
  t.deepEqual(draw({ [width]: 20, showValue: 'right' }).map((line) => line.length), [20, 20, 20], 'width fixes the row width');

  const defaultColor = prop(q.tok('color?')).name;
  const colored = raw(h(Component, { data: [entry('a', 10, { [color]: '#ff0000' }), entry('b', 10)], [defaultColor]: '#00ff00', width: 20 }));
  t.ok(colored.includes(`${sgrOf('#ff0000')}a ▆`), 'color on an entry colours that bar');
  t.ok(colored.includes(`${sgrOf('#00ff00')}b ▆`), 'while color colours the bars that have none');
});

s.fact(F, [STACKED_ROW], { kind: 'R', ctx: [] }, async (t, q) => {
  const Component = q.api(charts, 'StackedBarChart');
  const [label, value, color, char] = elementProps(q.tok('data: {label, value, color?, char?}[]')).map((p) => p.name);
  const entry = (name, v, extra = {}) => ({ [label]: name, [value]: v, ...extra });
  const entries = [entry('Sales', 30), entry('Warning', 20), entry('Error', 50)];
  const draw = (props = {}, data = entries) => rows(h(Component, { data, width: 50, ...props }));

  const percentage = draw();
  t.deepEqual(percentage, ['Sales          Warning   Error', '█'.repeat(50), '30.0%          20.0%     50.0%'], 'labels above one bar, values below; the width is split in proportion');
  const whole = Number(q.tok('100%').slice(0, -1));
  const shares = draw({}, [entry('a', 30), entry('b', 20)]);
  t.equal(shares[2].match(/[\d.]+(?=%)/g).map(Number).reduce((a, b) => a + b), whole, 'whatever the values, the percentages add up to 100%');
  t.equal(shares[1].length, 50, 'and the bar fills the width');

  const mode = prop(q.tok("mode?: 'percentage' | 'absolute'"));
  const [pct, absolute] = literals(mode.type);
  t.deepEqual(draw({ [mode.name]: pct }), percentage, `${pct} is what you get without mode`);
  const max = prop(q.tok('max?')).name;
  const abs = draw({ [mode.name]: absolute, [max]: 200, data: [entry('Complete', 75), entry('In Progress', 25)] });
  t.deepEqual(abs.map((line) => count(line, '█')), [0, 25, 0], `${absolute} draws the values against a maximum: 100 of 200 fills half the width`);
  t.match(abs[2], /^75\s+25$/, 'and shows the values themselves');

  const width = prop(q.tok('width?')).name;
  t.equal(draw({ [width]: 20 })[1].length, 20, 'width is the width of the bar');

  const labels = prop(q.tok('showLabels?')).name;
  t.deepEqual(draw({ [labels]: false }), percentage.slice(1), 'showLabels: false drops the labels row');
  const values = prop(q.tok('showValues?')).name;
  t.deepEqual(draw({ [values]: false }), percentage.slice(0, 2), 'showValues: false drops the values row');

  const format = prop(q.tok('format?: (value, mode) => string'));
  const parameters = format.type.match(/^\((.+)\) => string$/)[1].split(', ');
  const received = [];
  const formatted = draw({ [format.name]: (...args) => (received.push(args), `<${args[0]}>`) });
  t.deepEqual(formatted[2].match(/<\d+>/g), ['<30>', '<20>', '<50>'], 'format turns each value into the text under its segment');
  t.ok(received.every((args) => args.length === parameters.length && args[1] === pct), `it is called with (${parameters.join(', ')})`);
  t.ok(draw({ [format.name]: (...args) => (received.push(args), 'x'), [mode.name]: absolute }) && received.at(-1)[1] === absolute, 'mode is the mode in use');

  t.deepEqual(draw({}, [entry('a', 30, { [char]: '#' }), entry('b', 20, { [char]: '=' })])[1], '#'.repeat(30) + '='.repeat(20), 'char draws a segment with its own character');
  const colored = raw(h(Component, { data: [entry('a', 30, { [color]: '#4aaa1a' }), entry('b', 20, { [color]: '#d89612' })], width: 20 }));
  t.ok(colored.includes(`${sgrOf('#4aaa1a')}${'█'.repeat(12)}${sgrOf('#d89612')}${'█'.repeat(8)}`), 'color paints each segment');
});

s.fact(F, [LINEGRAPH_ROW], { kind: 'R', ctx: ['height?: number', 'data: {values: number[], color?}[]'] }, async (t, q) => {
  const Component = q.api(charts, 'LineGraph');
  const [values, color] = elementProps(q.tok('data: {values: number[], color?}[]')).map((p) => p.name);
  const series = { [values]: [1, 5, 2, 8, 3], [color]: 'red' };
  const other = { [values]: [8, 1, 5, 2, 9], [color]: 'blue' };
  const draw = (props = {}, data = [series]) => rows(h(Component, { data, width: 10, height: 3, ...props }));

  t.deepEqual(draw(), ['      ⎽⎻', '  ─⎼ ⎽  ⎻', '⎽⎺  ⎻    ⎺'], 'a line graph: the values drawn with scan-line characters');
  const both = draw({}, [series, other]);
  t.notDeepEqual(both, draw(), 'Multi-series: another series is drawn on the same axes');
  const coloured = raw(h(Component, { data: [series, other], width: 10, height: 3 }));
  t.ok(coloured.includes(`${sgrOf('red')}⎼`) || coloured.includes(`${sgrOf('red')}─`), 'each in its own colour (red)');
  t.ok(coloured.includes(sgrOf('blue')), '(blue)');

  const width = prop(q.tok('width?')).name;
  t.equal(Math.max(...draw({ [width]: 20 }).map((line) => line.length)), 20);
  t.equal(draw({ [width]: 20 }).length, 3, 'width does not change the number of rows');

  const height = rows(h(Component, { data: [series] }));
  t.equal(height.length, 10, 'height defaults to 10 rows');
  t.equal(draw({ height: 5 }).length, 5);

  const domain = prop(q.tok('yDomain?')).name;
  t.deepEqual(draw({ [domain]: [0, 100] }), ['', '', '⎽⎽⎼⎼⎽⎽⎼⎼⎼⎽'], 'yDomain fixes the vertical range');
  const caption = prop(q.tok('caption?')).name;
  t.deepEqual(draw({ [caption]: 'Cap' }), [...draw(), 'Cap'], 'caption goes below the graph');

  const yAxis = prop(q.tok('showYAxis?')).name;
  t.deepEqual(draw({ [yAxis]: true }), ['8│     ─⎽', ' │ ⎽─ ⎽', '1│⎽  ⎺   ⎺'], 'showYAxis labels the minimum and maximum');
  const yLabels = prop(q.tok('yLabels?')).name;
  t.deepEqual(draw({ [yLabels]: ['lo', 'hi'] }), ['lo│    ⎽⎼', '  │ ⎽⎼', 'hi│⎽  ─  ⎺'], 'yLabels replaces them (and turns the axis on)');
  const xLabels = prop(q.tok('xLabels?')).name;
  t.deepEqual(draw({ [xLabels]: ['a', 'b'] }).slice(3), ['──────────', 'a        b'], 'xLabels sit under a horizontal axis');
});

// ===================================================================== threshold and colorScheme

s.fact(F, ['`Sparkline` colours only the values above a `threshold`.'], { kind: 'R' }, async (t, q) => {
  const Component = q.api(charts, 'Sparkline');
  const threshold = q.tok('threshold');
  const data = [1, 3, 2, 8, 4, 6, 5];
  const draw = (props) => raw(h(Component, { data, ...props }));
  t.equal(draw({}), stripAnsi(draw({})), 'positive control: no escape sequences without a threshold');
  const out = draw({ [threshold]: 5 });
  const painted = [...out.matchAll(/\x1b\[\d+m(.)\x1b\[39m/g)].map((m) => m[1]);
  t.deepEqual(painted, ['█', '▆'], 'the values 8 and 6, the two above 5, are painted');
  t.equal(stripAnsi(out), '▁▃▂█▄▆▅', 'the others (and the text) are untouched');
});

s.fact(
  F,
  ['A single number paints them red whatever the `colorScheme`; an array of thresholds paints a gradient in the `colorScheme` (red by default), deeper for each threshold a value exceeds.'],
  { kind: 'R', ctx: ['colorScheme'] },
  async (t) => {
    const Component = Sparkline;
    const data = [1, 3, 2, 8, 4, 6, 5];
    const draw = (props) => raw(h(Component, { data, ...props }));
    const [single, gradient] = [5, [2, 4, 6]];
    const reds = new Set(['red', 'blue', 'green'].map((colorScheme) => draw({ threshold: single, colorScheme })));
    t.equal(reds.size, 1, 'a number: the same output for every scheme');
    t.match([...reds][0], /\x1b\[91m█/, 'which is the red of the helper `red`');
    t.equal([...reds][0], draw({ threshold: single }), 'and for no scheme at all');
    const strongest = (colorScheme) => draw({ threshold: gradient, colorScheme });
    t.equal(new Set(['red', 'blue', 'green'].map(strongest)).size, 3, 'an array: each scheme paints differently');
    t.equal(strongest('red'), draw({ threshold: gradient }), 'and red is the default');
    // 3 exceeds one threshold, 6 exceeds two, 8 exceeds all three: the colour deepens
    const colourOf = (colorScheme, character) => strongest(colorScheme).match(new RegExp(`\x1b\\[38;2;(\\d+);(\\d+);(\\d+)m${character}`)).slice(1, 4).map(Number);
    for (const [colorScheme, fading] of [['red', 1], ['blue', 0], ['green', 0]]) {
      const levels = ['▃', '▆', '█'].map((character) => colourOf(colorScheme, character));
      t.ok(levels[0][fading] > levels[1][fading] && levels[1][fading] > levels[2][fading], `${colorScheme}: deeper for 2, 3 thresholds than for 1`);
    }
  },
);

s.fact(F, ['Without a `threshold`, `colorScheme` changes nothing.'], { kind: 'R' }, async (t, q) => {
  const Component = Sparkline;
  const threshold = q.tok('threshold');
  const scheme = q.tok('colorScheme');
  const data = [1, 3, 2, 8, 4];
  const draw = (props) => raw(h(Component, { data, ...props }));
  t.equal(new Set(['red', 'blue', 'green', undefined].map((value) => draw({ [scheme]: value }))).size, 1, 'the output is the same with every scheme');
  t.equal(draw({ [scheme]: 'blue' }), '▁▃▂█▄', 'and has no colour at all');
  t.notEqual(draw({ [scheme]: 'blue', [threshold]: [2, 4, 6] }), draw({ [threshold]: [2, 4, 6] }), 'positive control: with a threshold it does');
});

// ===================================================================== props that do nothing

s.fact(
  F,
  ["Three props are accepted but do nothing: `Sparkline`'s `height`, `BarChart`'s `padding`, and the `'inside'` value of `BarChart`'s `showValue` (it draws no value, like `'none'`)."],
  { kind: 'R' },
  async (t, q) => {
    const sparkline = q.api(charts, 'Sparkline');
    const barChart = q.api(charts, 'BarChart');
    const [height, padding, showValue] = [q.tok('height'), q.tok('padding'), q.tok('showValue')];
    const inside = q.tok("'inside'").slice(1, -1);
    const none = q.tok("'none'").slice(1, -1);
    // positive control: they are props of the components (declared in the shipped types), and other props do change the output
    const declared = (file, name) => readFileSync(join(packageDir('@pppp606/ink-chart'), 'dist', 'components', file), 'utf8').match(new RegExp(`\\b${name}\\?:`));
    t.ok(declared('Sparkline.d.ts', height) && declared('BarChart.d.ts', padding) && declared('BarChart.d.ts', showValue), 'all three are declared props');
    const values = readFileSync(join(packageDir('@pppp606/ink-chart'), 'dist', 'components', 'BarChart.d.ts'), 'utf8').match(/type BarChartValueDisplay = ([^;]+);/)[1];
    t.deepEqual(values.split(' | ').sort(), [`'${inside}'`, `'${none}'`, "'right'"].sort(), 'inside and none are two of the three values showValue takes');

    const draw = (Component, props) => raw(h(Component, props));
    const spark = { data: [1, 3, 2, 8, 4] };
    t.notEqual(draw(sparkline, { ...spark, width: 10 }), draw(sparkline, spark), 'positive control: width changes a sparkline');
    for (const value of [1, 2, 'braille']) t.equal(draw(sparkline, { ...spark, [height]: value }), draw(sparkline, spark), `height ${value}`);

    const bars = { data: [{ label: 'A', value: 10 }, { label: 'B', value: 20 }], width: 30, showValue: 'right' };
    t.notEqual(draw(barChart, { ...bars, sort: 'desc' }), draw(barChart, bars), 'positive control: sort changes a bar chart');
    for (const value of [0, 1, 2]) t.equal(draw(barChart, { ...bars, [padding]: value }), draw(barChart, bars), `padding ${value}`);

    t.notEqual(draw(barChart, { ...bars, [showValue]: 'right' }), draw(barChart, { ...bars, [showValue]: none }), 'positive control: right draws the values and none does not');
    t.equal(draw(barChart, { ...bars, [showValue]: inside }), draw(barChart, { ...bars, [showValue]: none }), 'inside draws exactly what none draws');
    t.doesNotMatch(draw(barChart, { ...bars, [showValue]: inside }), /\d/, 'no value');
  },
);

// ===================================================================== the other exports

s.fact(F, ['It also exports a `useAutoWidth()` hook and its ANSI helpers (`red`, `green`, `bold`, `colorize`, …).'], { kind: 'R' }, async (t, q) => {
  const hook = q.api(charts, 'useAutoWidth()');
  t.throws(() => hook(), 'a hook: it cannot be called outside a component');
  let seen;
  const Probe = () => {
    seen = hook();
    return h(Text, null, 'probe');
  };
  renderToString(h(Probe));
  t.equal(typeof seen.width, 'number', 'inside one it returns the terminal width ...');
  t.equal(seen.isAutoWidth, true, '... in an object');
  const [red, green, bold] = ['red', 'green', 'bold'].map((name) => q.api(charts, name));
  const colorize = q.api(charts, 'colorize');
  for (const helper of [red, green, bold]) {
    const out = helper('text');
    t.equal(stripAnsi(out), 'text', `${helper.name} keeps the text`);
    t.notEqual(out, 'text', `${helper.name} wraps it in escape sequences`);
  }
  t.equal(colorize('text', charts.ANSI.RED), `${charts.ANSI.RED}text${charts.ANSI.RESET}`, 'colorize wraps text in the colour it is given');
  t.equal(red('x'), colorize('x', charts.ANSI.BRIGHT_RED));
});

// ===================================================================== the hand-rolled chart

s.fact(F, ['A single simple bar chart can be a `<Box width>` filled proportionally, with no dependency:'], { kind: 'R', ctx: ['<Box width>'] }, async (t) => {
  const { mod } = await s.runFence(F, 2);
  const bar = (value, max) => raw(h(mod.Bar, { label: 'cpu', value, max }), 80);
  t.equal(stripAnsi(bar(15, 30)), `${'cpu'.padEnd(12)}${' '.repeat(15)} 15`, 'the label, a bar of round(value / max * 30) columns, the value');
  t.match(bar(15, 30), /\x1b\[42m {15}\x1b\[49m/, 'the bar is a green background');
  t.match(bar(30, 30), /\x1b\[42m {30}\x1b\[49m/, 'and the largest value fills 30 columns');
  t.match(bar(1, 3), /\x1b\[42m {10}\x1b\[49m/, 'a third fills a third');
});

s.fence(F, 2, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const { mod } = await runFence(fence);
    t.equal(typeof mod.Bar, 'function', 'declares the Bar component');
    t.deepEqual([...fence.code.matchAll(/from '([^']+)'/g)].map((m) => m[1]), ['react', 'ink'], 'and needs nothing but React and Ink');
  },
});

s.fact(F, ["Reach for `@pppp606/ink-chart` once you need more than one series, axis labels, or a sparkline/line-graph shape"], { kind: 'R' }, async (t, q) => {
  const name = q.tok('@pppp606/ink-chart');
  const lib = await import(name);
  const data = [{ values: [1, 5, 2, 8, 3] }, { values: [8, 1, 5, 2, 9] }];
  const graph = (props) => rows(h(lib.LineGraph, { data, width: 10, height: 3, ...props }));
  t.ok(graph({}).join('').trim().length > 0, 'the package draws several series in one graph');
  t.notDeepEqual(graph({}), rows(h(lib.LineGraph, { data: data.slice(0, 1), width: 10, height: 3 })), 'more than one series');
  t.ok(graph({ showYAxis: true }).every((line) => line.includes('│')) && graph({ xLabels: ['a', 'b'] }).at(-1).includes('b'), 'with axis labels');
  t.ok(lib.Sparkline && lib.LineGraph, 'a sparkline and a line graph');
});

s.guidance(F, ["those aren't worth reimplementing"], 'a recommendation about build-versus-buy, which no test can decide; the capabilities it refers to are shown in the first half of the sentence');
