// Claims for skills/ecosystem/data-display/ink-decoration/SKILL.md.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import semver from 'semver';
import gradientString from 'gradient-string';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
import { skill, tsx, h, ink, stripAnsi, loadEcosystem, externalHarness, extImport, extPkg, extPackageDir, extReadFile, runExternal, runIsolated, pkg, packageDir } from '../lib/index.mjs';
import { linkProbe, png, serve, picture } from './ink-decoration.helpers.mjs';

const { Box, Text, renderToString } = ink;
const s = skill('ink-decoration');
const F = 'SKILL.md';

const render = (element, columns = 40) => renderToString(element, { columns });
const SGR = /\x1b\[38;2;(\d+);(\d+);(\d+)m(.)/g;
/** Per output line: the 24-bit foreground of each coloured character. */
const lineColors = (out) => out.split('\n').map((line) => [...line.matchAll(SGR)].map((m) => ({ rgb: `${m[1]},${m[2]},${m[3]}`, ch: m[4] })));
const ends = (line) => [line[0]?.rgb, line.at(-1)?.rgb];
const RED = '255,0,0';
const BLUE = '0,0,255';
const custom = { colors: ['#ff0000', '#0000ff'] };
const OSC8 = (url) => `\x1b]8;;${url}\x07`;

// ===================================================================== description

s.fact(F, ['Decorative text and layout components for Ink — clickable terminal links (ink-link), gradient-colored text (ink-gradient), large ASCII banner text (ink-big-text), section dividers drawn with a <Box> border, titled boxes (@mishieck/ink-titled-box), and inline images (ink-picture).'], { kind: 'R' }, async (t) => {
  const link = await linkProbe({ FORCE_HYPERLINK: '1' });
  t.ok(link.plain.startsWith(OSC8('https://example.com')), 'ink-link: the text is a clickable OSC 8 link');
  const gradient = lineColors(render(h(Gradient, { name: 'rainbow' }, 'hello')))[0];
  t.ok(new Set(gradient.map((c) => c.rgb)).size > 1, 'ink-gradient: the characters get different colours');
  const banner = render(h(BigText, { text: 'hi' })).split('\n');
  t.ok(banner.length >= 3 && banner.some((line) => /[█╗╔╝╚║═]/.test(line)), 'ink-big-text: large block letters over several rows');
  const rule = render(h(Box, { width: 10, flexDirection: 'column' }, h(Box, { borderStyle: 'single', borderBottom: false, borderLeft: false, borderRight: false })));
  t.equal(rule, '──────────', 'a divider is one side of a <Box> border');
  const ext = await externalHarness();
  const { TitledBox } = await extImport('@mishieck/ink-titled-box');
  const titled = ext.mount(ext.h(TitledBox, { titles: ['Status'], borderStyle: 'round', width: 20 }, ext.h(ext.ink.Text, null, 'x')), { columns: 30 });
  await titled.flush();
  t.match(titled.screen().split('\n')[0], /^╭.* Status .*╮$/, '@mishieck/ink-titled-box: the title sits in the top border');
  const pic = await picture({ props: { src: (await png()).file, width: 8, height: 4, protocol: 'kitty' }, info: { supportsKittyGraphics: true } });
  await pic.settle();
  t.ok(pic.app.bytes().includes('\x1b_G'), 'ink-picture: draws the image with a terminal graphics protocol');
});

s.guidance(F, ['Use for branding, banners, section headers, or clickable links.'], 'a recommendation about when to reach for the skill; it asserts nothing about behaviour');

// ===================================================================== ink-link

s.fence(F, 0, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const { apps } = await runFence(fence);
    await apps[0].flush();
    t.equal(stripAnsi(apps[0].screen()), 'My Website https://example.com', 'without hyperlink support the label is followed by the URL');
  },
});

s.fact(F, ['Only works in [terminals that support the OSC 8 hyperlink escape sequence]'], { kind: 'R' }, async (t, q) => {
  const osc = q.tok('8');
  const supported = await linkProbe({ FORCE_HYPERLINK: '1' });
  t.equal(supported.plain, `\x1b]${osc};;https://example.com\x07My Website\x1b]${osc};;\x07`, 'where hyperlinks are supported the text is wrapped in the OSC 8 sequence');
  const unsupported = await linkProbe({ FORCE_HYPERLINK: '0' });
  t.ok(!unsupported.plain.includes(`\x1b]${osc};`), 'where they are not, no OSC 8 sequence is written');
});

s.fact(F, ['For unsupported terminals, `fallback` (default `true`) prints the URL after the text instead (`My Website https://example.com` for the example above)'], { kind: 'D' }, async (t, q) => {
  const prop = q.tok('fallback');
  const dflt = q.tok('true');
  const example = q.tok('My Website https://example.com');
  const run = await linkProbe({ FORCE_HYPERLINK: '0' });
  t.equal(run.styled.replace(/\x1b\[\d+m/g, ''), example, 'the URL follows the text of the example above');
  t.equal(run.plain, example);
  const { default: Link } = await import('ink-link');
  const explicit = renderToString(h(Link, { url: 'https://example.com', [prop]: JSON.parse(dflt) }, 'My Website'), { columns: 80 });
  t.equal(explicit, run.plain, 'and `fallback` defaults to true: passing it explicitly changes nothing');
  const suppressed = renderToString(h(Link, { url: 'https://example.com', [prop]: false }, 'My Website'), { columns: 80 });
  t.equal(suppressed, 'My Website', 'while fallback: false is what switches the URL off');
});

s.fact(F, ['pass `false` to suppress it'], { kind: 'R' }, async (t, q) => {
  const off = JSON.parse(q.tok('false'));
  const { default: Link } = await import('ink-link');
  const run = await linkProbe({ FORCE_HYPERLINK: '0' });
  t.equal(run.noFallback, 'My Website', 'the text alone');
  t.equal(renderToString(h(Link, { url: 'https://example.com', fallback: off }, 'My Website'), { columns: 80 }), 'My Website');
});

s.fact(F, ['or a function `(text, url) => string` for a custom fallback format (e.g. Markdown-style `[text](url)`)'], { kind: 'R' }, async (t, q) => {
  const signature = q.tok('(text, url) => string');
  const markdown = q.tok('[text](url)');
  const run = await linkProbe({ FORCE_HYPERLINK: '0' });
  t.equal(signature, '(text, url) => string');
  t.equal(run.customFallback, markdown.replace('text', 'My Website').replace('url', 'https://example.com'), 'the function receives the text and the URL and returns what is printed');
  const supported = await linkProbe({ FORCE_HYPERLINK: '1' });
  t.equal(supported.customFallback, supported.plain, 'where hyperlinks work the fallback is not used at all');
});

s.types(
  F,
  ['or a function `(text, url) => string` for a custom fallback format (e.g. Markdown-style `[text](url)`)'],
  tsx`
import React from 'react';
import Link from 'ink-link';

type Fallback = (text: string, url: string) => string;
const markdown: Fallback = (text, url) => \`[\${text}](\${url})\`;
export const ok = <Link url="https://example.com" fallback={markdown}>site</Link>;
export const off = <Link url="https://example.com" fallback={false}>site</Link>;
export const bad = <Link url="https://example.com" fallback="x">site</Link>; //! TS2322
`,
  { ctx: ['(text, url) => string', '[text](url)'] },
);

// ===================================================================== ink-gradient

s.fence(F, 1, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const { apps } = await runFence(fence, { mountOptions: { columns: 80 } });
    await apps[0].flush();
    const lines = apps[0].screen().split('\n').filter((l) => l.trim());
    t.ok(lines.length >= 3, 'the banner is several rows tall');
    const colours = new Set(lineColors(apps[0].bytes()).flat().map((c) => c.rgb));
    t.ok(colours.size > 4, 'and is painted with the rainbow gradient');
  },
});

s.fact(F, ['`name` picks a [built-in gradient]'], { kind: 'R' }, async (t, q) => {
  const prop = q.tok('name');
  const builtIn = Object.keys(gradientString).filter((key) => typeof gradientString[key]?.multiline === 'function');
  t.equal(builtIn.length, 13, 'gradient-string ships 13 built-in gradients');
  const outputs = new Map();
  for (const name of builtIn) {
    const out = render(h(Gradient, { [prop]: name }, 'gradient'));
    t.ok(new Set(lineColors(out)[0].map((c) => c.rgb)).size > 1, `${name} colours the text`);
    outputs.set(name, out);
  }
  t.equal(new Set(outputs.values()).size, builtIn.length, 'each name gives a different gradient');
});

s.types(
  F,
  ['`name` picks a [built-in gradient]'],
  tsx`
import React from 'react';
import Gradient from 'ink-gradient';

export const ok = <Gradient name="rainbow">x</Gradient>;
export const unknown = <Gradient name="nope">x</Gradient>; //! TS2322
`,
);

s.fact(F, ['`colors` takes an array of colour strings or objects for a custom gradient.'], { kind: 'R' }, async (t, q) => {
  const prop = q.tok('colors');
  const strings = lineColors(render(h(Gradient, { [prop]: ['#ff0000', '#0000ff'] }, 'abcd')))[0];
  t.deepEqual(ends(strings), [RED, BLUE], 'strings: from the first colour to the last');
  const objects = lineColors(render(h(Gradient, { [prop]: [{ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 }] }, 'abcd')))[0];
  t.deepEqual(ends(objects), [RED, BLUE], 'objects: the same');
  const mixed = lineColors(render(h(Gradient, { [prop]: ['#ff0000', { r: 0, g: 0, b: 255 }] }, 'abcd')))[0];
  t.deepEqual(ends(mixed), [RED, BLUE], 'and both kinds can be mixed in one array');
});

s.types(
  F,
  ['`colors` takes an array of colour strings or objects for a custom gradient.'],
  tsx`
import React from 'react';
import Gradient from 'ink-gradient';

export const strings = <Gradient colors={['red', '#00f']}>x</Gradient>;
export const objects = <Gradient colors={[{r: 255, g: 0, b: 0}, {r: 0, g: 0, b: 255}]}>x</Gradient>;
export const mixed = <Gradient colors={['red', {r: 0, g: 0, b: 255}]}>x</Gradient>;
export const notAnArray = <Gradient colors="red">x</Gradient>; //! TS2322
`,
  { ctx: ['colors'] },
);

s.fact(F, ['The two are mutually exclusive — passing both throws.'], { kind: 'R' }, async (t) => {
  t.throws(() => render(h(Gradient, { name: 'rainbow', ...custom }, 'x')), /mutually exclusive/, 'name together with colors throws');
  t.doesNotThrow(() => render(h(Gradient, { name: 'rainbow' }, 'x')), 'name alone is fine');
  t.doesNotThrow(() => render(h(Gradient, custom, 'x')), 'colors alone is fine');
});

s.fact(F, ['Children can be a string or Ink components.'], { kind: 'R' }, async (t) => {
  const fromString = lineColors(render(h(Gradient, custom, 'abcd')))[0];
  t.deepEqual(ends(fromString), [RED, BLUE], 'a string is coloured');
  const fromText = lineColors(render(h(Gradient, custom, h(Text, null, 'abcd'))))[0];
  t.deepEqual(ends(fromText), [RED, BLUE], 'a <Text> is coloured');
  const fromBigText = lineColors(render(h(Gradient, custom, h(BigText, { text: 'hi' }))));
  t.ok(fromBigText.filter((line) => line.length).every((line) => ends(line)[0] === RED), 'so is another component such as <BigText>');
  t.ok(lineColors(render(h(Gradient, custom, h(Box, { gap: 1 }, h(Text, null, 'ab'), h(Text, null, 'cd')))))[0].length > 0, 'and a <Box> full of text');
});

s.fact(F, ['Each line is coloured on its own, so every line spans the whole gradient however the text is passed.'], { kind: 'R' }, async (t) => {
  const spans = (out) => lineColors(out).filter((line) => line.length).map(ends);
  const expected = [[RED, BLUE], [RED, BLUE]];
  t.deepEqual(spans(render(h(Gradient, custom, 'ab\nabcdefgh'))), expected, 'one string containing a newline');
  t.deepEqual(spans(render(h(Gradient, custom, h(Text, null, 'ab\nabcdefgh')))), expected, 'one <Text> containing a newline');
  t.deepEqual(spans(render(h(Box, { flexDirection: 'column' }, h(Gradient, custom, h(Text, null, 'ab'), h(Text, null, 'abcdefgh'))))), expected, 'separate <Text> children');
  t.deepEqual(spans(render(h(Box, { width: 4 }, h(Gradient, custom, h(Text, null, 'abcdefgh'))))), expected, 'and the lines a long text wraps into');
});

s.fact(F, ['Multiple `<Text>` children are separate gradient runs: the gradient restarts in each, and their layout is preserved (stacked, for example, inside a `flexDirection="column"` box).'], { kind: 'R' }, async (t, q) => {
  const T = q.el(ink, '<Text>');
  const direction = q.tok('flexDirection="column"').match(/"(.+)"/)[1];
  const row = (...children) => lineColors(render(h(Box, null, h(Gradient, custom, ...children))))[0];
  const separate = row(h(T, { key: 1 }, 'ab'), h(T, { key: 2 }, 'cd'));
  t.deepEqual(separate.map((c) => c.rgb), [RED, BLUE, RED, BLUE], 'two <Text> children in a row: the gradient restarts in the second');
  const single = row(h(T, null, 'abcd'));
  t.notEqual(single[2].rgb, RED, 'a single <Text> is one run: its third character is not back at the start colour');
  const stacked = render(h(Box, { flexDirection: direction }, h(Gradient, custom, h(T, { key: 1 }, 'ab'), h(T, { key: 2 }, 'cd'))));
  t.deepEqual(stripAnsi(stacked).split('\n'), ['ab', 'cd'], 'in a column box they stack, one per row');
});

// ===================================================================== ink-big-text

s.fence(F, 2, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const { mod } = await runFence(fence);
    const out = render(h(mod.Banner), 120);
    t.equal(out, render(h(BigText, { text: 'unicorns' }), 120), 'Banner is <BigText text="unicorns" />');
    t.ok(out.split('\n').length >= 3, 'several rows of block letters');
  },
});

s.fact(F, ['Props other than `text` are passed to [`cfonts`](https://github.com/dominikwilkowski/cfonts) as its options'], { kind: 'R' }, async (t, q) => {
  const textProp = q.tok('text');
  const { default: cfonts } = await import(q.tok('cfonts'));
  const viaBigText = (props) => renderToString(h(BigText, { [textProp]: 'hi', ...props }), { columns: 120 });
  const viaCfonts = (props) => renderToString(h(Text, null, cfonts.render('hi', props).string), { columns: 120 });
  for (const props of [{}, { font: 'tiny' }, { align: 'right' }, { colors: ['red'] }, { backgroundColor: 'blue' }, { letterSpacing: 4 }, { lineHeight: 3 }, { space: false }, { maxLength: 1 }]) {
    t.equal(viaBigText(props), viaCfonts(props), `${JSON.stringify(props)} is handed to cfonts unchanged`);
  }
  t.notEqual(viaBigText({ font: 'tiny' }), viaBigText({}), 'and the options have an effect');
});

s.fact(F, ['The typed ones are `font`, `align`, `colors`, `backgroundColor`, `letterSpacing`, `lineHeight`, `space` and `maxLength`.'], { kind: 'R' }, async (t, q) => {
  // the type-level half is the types() claim below; here, that each of them reaches cfonts
  const names = ['font', 'align', 'colors', 'backgroundColor', 'letterSpacing', 'lineHeight', 'space', 'maxLength'].map((name) => q.tok(name));
  t.equal(names.length, 8);
  // two lines of text ('|' is cfonts' line break), or lineHeight has nothing to space out
  const two = 'ab|cd';
  const draw = (props) => renderToString(h(BigText, { text: two, ...props }), { columns: 120 });
  const base = draw({});
  const changed = { font: 'tiny', align: 'right', colors: ['red'], backgroundColor: 'blue', letterSpacing: 4, lineHeight: 3, maxLength: 1 };
  for (const name of names.filter((n) => n !== 'space')) t.notEqual(draw({ [name]: changed[name] }), base, `${name} changes the output`);
  const space = q.tok('space');
  t.match(readFileSync(join(packageDir('ink-big-text'), 'dist', 'index.js'), 'utf8'), new RegExp(`\\b${space}: true`), 'space is one of the options ink-big-text sets by default');
  t.equal(draw({ [space]: false }), base, 'but changing it does nothing: cfonts ignores it');
});

s.fact(F, ['Of these cfonts ignores `space`; the option that removes the empty rows around the text is `spaceless`, which the types do not list.'], { kind: 'R' }, async (t, q) => {
  const space = q.tok('space');
  const spaceless = q.tok('spaceless');
  t.match(readFileSync(join(packageDir('ink-big-text'), 'dist', 'index.js'), 'utf8'), new RegExp(`\\b${space}: true`), 'space is an option ink-big-text sets by default');
  const draw = (props) => renderToString(h(BigText, { text: 'ab', ...props }), { columns: 120 }).split('\n');
  const rowsBefore = (lines) => lines.findIndex((l) => l.trim());
  const base = draw({});
  t.ok(rowsBefore(base) > 0, 'by default there are empty rows above the text');
  t.deepEqual(draw({ [space]: false }), base, 'space: false leaves them');
  const tight = draw({ [spaceless]: true });
  t.equal(rowsBefore(tight), 0, 'spaceless: true removes the ones above');
  t.ok(tight.at(-1).trim(), 'and below');
  t.equal(pkg('cfonts').version.split('.')[0], '3', 'in the installed cfonts');
});

s.types(
  F,
  ['The typed ones are `font`, `align`, `colors`, `backgroundColor`, `letterSpacing`, `lineHeight`, `space` and `maxLength`.', 'the option that removes the empty rows around the text is `spaceless`, which the types do not list.'],
  tsx`
import React from 'react';
import BigText from 'ink-big-text';

type Typed = Exclude<keyof React.ComponentProps<typeof BigText>, 'text'>;
type Expected = 'font' | 'align' | 'colors' | 'backgroundColor' | 'letterSpacing' | 'lineHeight' | 'space' | 'maxLength';
export const exactlyTheseEight: [Typed] extends [Expected] ? ([Expected] extends [Typed] ? true : false) : false = true;

export const all = <BigText text="x" font="tiny" align="center" colors={['red']} backgroundColor="blue" letterSpacing={2} lineHeight={1} space={false} maxLength={10} />;
export const cfontsSpelling = <BigText text="x" background="red" />; //! TS2322
export const spaceless = <BigText text="x" spaceless />; //! TS2322
export const noText = <BigText font="tiny" />; //! TS2741
`,
);

// ===================================================================== dividers

s.fact(F, ['`ink-divider` cannot be used on Ink 8: it hard-depends on `ink ^5.1.0`, so it installs a second, old copy of Ink whose reconciler crashes on React 19.'], { kind: 'P' }, async (t, q) => {
  const dividerName = q.tok('ink-divider');
  const [name, range] = q.tok('ink ^5.1.0').split(' ');
  const dividerDir = extPackageDir(dividerName);
  t.equal(JSON.parse(readFileSync(join(dividerDir, 'package.json'), 'utf8')).dependencies[name], range, 'ink-divider depends on that range of ink, as a hard dependency');
  const { packages } = await loadEcosystem();
  t.equal(packages.find((p) => p.name === dividerName).dependencies[name], range, 'which the ecosystem data records too');
  const top = extPkg('ink').version;
  t.ok(!semver.satisfies(top, range), `Ink ${top} is outside that range, so npm cannot reuse it`);
  const nested = JSON.parse(readFileSync(join(extPackageDir('ink', dividerDir), 'package.json'), 'utf8')).version;
  t.ok(semver.satisfies(nested, range) && nested !== top, `and ink-divider gets its own copy (ink ${nested})`);
  t.equal(semver.major(extPkg('ink').version), Number(q.tok('8')), 'the Ink being used is 8');
  t.equal(semver.major(extPkg('react').version), Number(q.tok('19')), 'next to React 19');
  const run = await runExternal({ code: `try { await import('${dividerName}'); console.log(JSON.stringify({loaded: true})); } catch (e) { console.log(JSON.stringify({loaded: false, message: String(e.message)})); }` });
  t.equal(run.json?.loaded, false, 'importing it fails');
  t.match(run.json?.message ?? run.stderr, /ReactCurrentOwner/, 'inside the old copy of the React reconciler');
});

s.fact(F, ["A border on a single side does the same job and fills its parent's width:"], { kind: 'R' }, async (t) => {
  const { mod } = await s.runFence(F, 3);
  t.equal(render(h(Box, { width: 12, flexDirection: 'column' }, h(mod.Rule))), '────────────', 'a rule is a horizontal line across the whole width of its parent');
  t.equal(render(h(Box, { width: 20, flexDirection: 'column' }, h(mod.Rule))), '─'.repeat(20), 'whatever that width is');
});

s.fence(F, 3, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const { mod } = await runFence(fence);
    t.equal(typeof mod.Divider, 'function');
    t.equal(typeof mod.Rule, 'function');
  },
});

s.fact(F, ['In a 31-column terminal, <Divider title="Section title" />  →  ── Section title ──────────────'], { kind: 'R' }, async (t, q) => {
  const columns = Number(q.tok('31'));
  const title = q.tok('Section title');
  const { mod } = await s.runFence(F, 3);
  const expected = `── ${title} ${'─'.repeat(columns - `── ${title} `.length)}`;
  t.equal(stripAnsi(render(h(mod.Divider, { title }), columns)), expected, 'the title, then a rule filling the rest of the line');
  t.equal(expected, '── Section title ──────────────', 'which is the line the comment shows');
});

s.fact(F, ['A bare `<Rule />` stretches across a column parent'], { kind: 'R' }, async (t, q) => {
  const { mod } = await s.runFence(F, 3);
  const Rule = q.el(mod, '<Rule />');
  t.equal(render(h(Box, { width: 9, flexDirection: 'column' }, h(Rule))), '─────────');
});

s.fact(F, ['only the titled form needs `flexGrow` (it sits in a row and fills what the title leaves)'], { kind: 'R' }, async (t, q) => {
  const grow = q.tok('flexGrow');
  const { mod } = await s.runFence(F, 3);
  const titledRow = (ruleProps) => stripAnsi(render(h(Box, { width: 20 }, h(Text, null, '── '), h(Text, { bold: true }, 'T'), h(Text, null, ' '), h(mod.Rule, ruleProps))));
  t.equal(titledRow({ [grow]: 1 }), `── T ${'─'.repeat(15)}`, 'with flexGrow the rule fills what the title leaves');
  t.equal(titledRow({}), '── T', 'without it the rule has no width in a row and disappears');
  t.equal(stripAnsi(render(h(mod.Divider, { title: 'T' }), 20)), `── T ${'─'.repeat(15)}`, 'which is why the titled form passes it');
});

s.fact(F, ["Don't put `flexGrow` on a bare rule inside a fixed-height column — it would absorb the free vertical space."], { kind: 'R' }, async (t, q) => {
  const grow = q.tok('flexGrow');
  const { mod } = await s.runFence(F, 3);
  const column = (ruleProps) => render(h(Box, { height: 6, width: 4, flexDirection: 'column' }, h(Text, null, 'top'), h(mod.Rule, ruleProps), h(Text, null, 'end'))).split('\n');
  t.deepEqual(column({}).slice(0, 3), ['top', '────', 'end'], 'a bare rule takes one row');
  const grown = column({ [grow]: 1 });
  t.equal(grown.indexOf('end'), 5, 'with flexGrow the rule takes all the free rows and pushes what follows to the bottom');
});

s.fact(F, ["`borderStyle` picks the line glyph (`'single'` `─`, `'double'` `═`, `'bold'` `━`, `'classic'` `-`)"], { kind: 'R' }, async (t, q) => {
  const prop = q.tok('borderStyle');
  const { mod } = await s.runFence(F, 3);
  const pairs = [];
  for (const style of ["'single'", "'double'", "'bold'", "'classic'"]) {
    const name = q.tok(style).replace(/'/g, '');
    const glyph = q.tok(['─', '═', '━', '-'][pairs.length]);
    pairs.push([name, glyph]);
  }
  for (const [name, glyph] of pairs) {
    t.equal(render(h(Box, { width: 5, flexDirection: 'column' }, h(mod.Rule, { [prop]: name }))), glyph.repeat(5), `${name} draws ${glyph}`);
  }
});

// ===================================================================== @mishieck/ink-titled-box

s.fact(F, ['A bordered `<Box>` with titles embedded in its top border.'], { kind: 'R' }, async (t, q) => {
  const { h: eh, mount: emount, ink: eink } = await externalHarness();
  const BoxEl = q.el(eink, '<Box>');
  const { TitledBox } = await extImport('@mishieck/ink-titled-box');
  const app = emount(eh(TitledBox, { titles: ['One', 'Two'], borderStyle: 'single', width: 24 }, eh(eink.Text, null, 'body')), { columns: 30 });
  const plain = emount(eh(BoxEl, { borderStyle: 'single', width: 24 }, eh(eink.Text, null, 'body')), { columns: 30 });
  await app.flush();
  await plain.flush();
  const lines = app.screen().split('\n');
  t.deepEqual(lines.slice(1), plain.screen().split('\n').slice(1), 'it is a bordered <Box> below the top border');
  t.match(lines[0], /^┌.*One.*Two.*┐$/, 'both titles are in the top border');
  t.match(lines[1], /^│body\s*│$/, 'with a bordered box under it');
  t.match(lines.at(-1), /^└─+┘$/);
});

s.fact(F, ['The unscoped name `ink-titled-box` does not exist on npm — install the scoped package.'], { kind: 'X' }, async (t, q) => {
  const unscoped = q.tok('ink-titled-box');
  const data = await loadEcosystem();
  const entry = data.notOnNpm.find((p) => p.name === unscoped);
  t.ok(entry, 'the ecosystem data lists the unscoped name as not on npm');
  t.equal(entry.registry404, true, 'because the registry answered 404 for it');
  t.ok(data.packages.some((p) => p.name === `@mishieck/${unscoped}`), 'the scoped package is the one that exists');
  t.equal(extPkg(`@mishieck/${unscoped}`).name, `@mishieck/${unscoped}`, 'and it installs');
});

s.fact(F, ['Its peer range is `ink ^6`, so it needs `--legacy-peer-deps`'], { kind: 'P' }, async (t, q) => {
  const [name, range] = q.tok('ink ^6').split(' ');
  const flag = q.tok('--legacy-peer-deps');
  const peer = extPkg('@mishieck/ink-titled-box').peerDependencies[name];
  t.ok(semver.intersects(peer, range) && semver.subset(peer, range), `its peer range for ink is ${peer}, i.e. ${range}`);
  t.ok(!semver.satisfies(extPkg('ink').version, peer), 'Ink 8 is outside it');
  t.match(readFileSync(join(extPackageDir('ink'), '..', '..', '.npmrc'), 'utf8'), new RegExp(`^${flag.slice(2)}=true$`, 'm'), 'so the project that installs it has to switch peer checking off');
});

s.fact(F, ['on Ink 8 it renders and lays out like any other `<Box>`'], { kind: 'R' }, async (t, q) => {
  t.equal(semver.major(extPkg('ink').version), Number(q.tok('8')), 'the Ink in use');
  const { h: eh, mount: emount, ink: eink } = await externalHarness();
  const BoxEl = q.el(eink, '<Box>');
  const { TitledBox } = await extImport('@mishieck/ink-titled-box');
  const props = { borderStyle: 'round', width: 18, padding: 1, flexDirection: 'column', alignItems: 'center' };
  const children = [eh(eink.Text, { key: 1 }, 'a'), eh(eink.Text, { key: 2 }, 'bb')];
  const titled = emount(eh(TitledBox, { titles: ['T'], ...props }, ...children), { columns: 30 });
  const plain = emount(eh(BoxEl, props, ...children), { columns: 30 });
  await titled.flush();
  await plain.flush();
  t.deepEqual(titled.screen().split('\n').slice(1), plain.screen().split('\n').slice(1), 'everything below the top border is what a <Box> with the same props draws');
});

s.fence(F, 4, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const { mod } = await runFence(fence);
    const ext = await externalHarness();
    const app = ext.mount(ext.h(mod.Panel), { columns: 30 });
    await app.flush();
    const lines = app.screen().split('\n');
    t.match(lines[0], /^╭.* Status .*╮$/, 'the title is in a rounded top border');
    t.ok(lines.some((l) => l.includes('All systems go')), 'around the content');
  },
});

s.fact(F, ['`titles: string[]` and `borderStyle` are required; it also takes `titleJustify`, `titleStyles`, and the other `<Box>` props.'], { kind: 'R', ctx: ['titles: string[]', '<Box>'] }, async (t, q) => {
  const justify = q.tok('titleJustify');
  const styles = q.tok('titleStyles');
  const borderStyle = q.tok('borderStyle');
  const { h: eh, mount: emount, ink: eink } = await externalHarness();
  const { TitledBox } = await extImport('@mishieck/ink-titled-box');
  const top = async (props) => {
    const app = emount(eh(TitledBox, { titles: ['T'], [borderStyle]: 'single', width: 14, ...props }, eh(eink.Text, null, 'x')), { columns: 30 });
    await app.flush();
    return app.screen().split('\n')[0];
  };
  t.equal(await top({}), '┌ T ─────────┐');
  t.equal(await top({ [justify]: 'flex-end' }), '┌───────── T ┐', 'titleJustify moves the title');
  t.equal(await top({ [styles]: { start: '[', end: ']' } }), '┌[T]─────────┐', 'titleStyles puts its start and end around the title');
  t.equal(await top({ width: 20 }), '┌ T ───────────────┐', 'and other <Box> props such as width apply');
});

s.types(
  F,
  ['`titles: string[]` and `borderStyle` are required; it also takes `titleJustify`, `titleStyles`, and the other `<Box>` props.'],
  tsx`
import React from 'react';
import {TitledBox} from '@mishieck/ink-titled-box';

const titles: string[] = ['A'];
export const ok = (
	<TitledBox titles={titles} borderStyle="round" titleJustify="center" titleStyles={{start: '[', end: ']'}} width={20} padding={1} borderColor="green">
		x
	</TitledBox>
);
export const noTitles = <TitledBox borderStyle="round">x</TitledBox>; //! TS2741
export const noBorderStyle = <TitledBox titles={titles}>x</TitledBox>; //! TS2741
export const titlesNotAnArray = <TitledBox titles="A" borderStyle="round">x</TitledBox>; //! TS2322
`,
  { project: 'external', ctx: ['<Box>'] },
);

s.fact(F, ['If you only need a plain title row above a bordered box, composing a `<Text>` with a `<Box>` avoids the peer conflict entirely.'], { kind: 'R' }, async (t, q) => {
  const T = q.el(ink, '<Text>');
  const B = q.el(ink, '<Box>');
  const lines = stripAnsi(render(h(B, { flexDirection: 'column', width: 20 }, h(T, { bold: true }, 'Status'), h(B, { borderStyle: 'round', paddingX: 1 }, h(T, null, 'All systems go'))))).split('\n');
  t.equal(lines.length, 4);
  t.equal(lines[0], 'Status', 'a title row');
  t.match(lines[1], /^╭─+╮$/, 'above a bordered box');
  t.match(lines[2], /^│ All systems go\s*│$/, 'holding the content');
  t.throws(() => pkg('@mishieck/ink-titled-box'), 'and the root project, which has strict peer checking, does not even have the titled-box package installed');
});

// ===================================================================== ink-picture

s.fact(F, ["Renders raster images inline, detecting the terminal's best protocol (Kitty, iTerm2, Sixel) and falling back to half-block, braille or ASCII text."], { kind: 'R' }, async (t) => {
  const { file } = await png();
  const draw = async (info, props = {}) => {
    const pic = await picture({ props: { src: file, width: 8, height: 4, ...props }, info });
    await pic.settle();
    return pic.app;
  };
  t.ok((await draw({ supportsKittyGraphics: true })).bytes().includes('\x1b_Gf=100'), 'Kitty graphics protocol');
  t.ok((await draw({ supportsITerm2Graphics: true })).bytes().includes('\x1b]1337;File='), 'iTerm2 inline images');
  t.match((await draw({ supportsSixelGraphics: true })).bytes(), /\x1bP[\d;]*q/, 'Sixel');
  t.match((await draw({})).screen(), /^[▀▄█ ]+(\n[▀▄█ ]+){3}$/, 'half-block characters when the terminal has colour and Unicode');
  t.match((await draw({ supportsColor: false })).screen(), /^[⠀-⣿]{8}(\n[⠀-⣿]{8}){3}$/, 'braille when it has Unicode but no colour');
  t.match((await draw({ supportsColor: false, supportsUnicode: false })).screen(), /^[ -~]{8}(\n[ -~]{8}){3}$/, 'plain ASCII when it has neither');
});

s.fact(F, ['Its README says to wrap the **whole app** in `<InkPictureProvider>` once, at the root'], { kind: 'P', ctx: ['whole app'] }, async (t, q) => {
  const provider = q.tok('<InkPictureProvider>').slice(1, -1);
  const readme = extReadFile('ink-picture', 'README.md').replace(/\s+/g, ' ');
  t.ok(readme.includes(`Always wrap your app with \`${provider}\`.`), 'the README says to always wrap the app');
  t.ok(readme.includes(`Move \`${provider}\` as close to the app's root as possible, i.e. wrap your entire app with it, so terminal capabilities are only detected once`), 'once, at the root');
});

s.fact(F, ['on mount the provider queries the terminal and holds stdin for up to a second while it does, buffering keystrokes and replaying them afterwards.'], { kind: 'R' }, async (t) => {
  const tty = { isTTY: true, columns: 80, rows: 24 };
  const silent = await runIsolated({ probe: 'ink-picture-stdin', project: 'external', env: { FORCE_COLOR: '0' }, tty, stdin: [[200, 'a']], timeout: 20_000 });
  for (const query of ['\x1b[c', '\x1b[16t', '\x1b[14t']) t.ok(silent.stdout.includes(query), `it asks the terminal (${JSON.stringify(query)})`);
  const [held] = silent.json.keys;
  t.equal(held.input, 'a', 'a key typed during the wait is not lost');
  t.ok(held.at >= 900 && held.at < 1500, `it reaches the app only after the wait ends, about a second later (${held.at} ms)`);
  const answered = await runIsolated({ probe: 'ink-picture-stdin', project: 'external', env: { FORCE_COLOR: '0' }, tty, stdin: [[100, 'a'], [250, '\x1b[?62c'], [600, 'b']], timeout: 20_000 });
  const [a, b] = answered.json.keys;
  t.equal(a.input, 'a');
  t.ok(a.at >= 200 && a.at < 700, `when the terminal answers sooner, the held key is replayed as soon as it has (${a.at} ms)`);
  t.equal(b.input, 'b');
  t.ok(b.at >= 550 && b.at < 900, `and later keys pass straight through (${b.at} ms)`);
  t.equal(answered.json.leaked, false, "and the terminal's reply is not delivered to the app as input");
});

s.fact(F, ['It renders on Ink 8: its peer range, `ink >=5`, includes it.'], { kind: 'P' }, async (t, q) => {
  const [name, range] = q.tok('ink >=5').split(' ');
  t.equal(semver.major(extPkg('ink').version), Number(q.tok('8')), 'the Ink in use');
  const peer = extPkg('ink-picture').peerDependencies[name];
  t.equal(peer, range);
  t.ok(semver.satisfies(extPkg('ink').version, peer), `Ink ${extPkg('ink').version} satisfies it`);
  const { file } = await png();
  const pic = await picture({ props: { src: file, width: 8, height: 4 } });
  await pic.settle();
  t.equal(pic.app.screen().split('\n').length, 4, 'and it draws the image');
});

s.fence(F, 5, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const { file, dir } = await png({ name: 'logo.png' });
    const here = process.cwd();
    process.chdir(dir);
    try {
      const { apps } = await runFence(fence, { mountOptions: { columns: 40, rows: 20 } });
      for (let i = 0; i < 80 && (!apps[0].screen().trim() || /Logo|Loading/.test(apps[0].screen())); i++) {
        await new Promise((r) => setTimeout(r, 25));
        await apps[0].flush();
      }
      const lines = apps[0].screen().split('\n').filter((l) => l.trim());
      t.equal(lines.length, 10, 'the image is 10 rows tall, as the fence asks');
      t.ok(lines.every((l) => l.trimEnd().length === 20), 'and 20 columns wide');
    } finally {
      process.chdir(here);
    }
    t.ok(file.endsWith('logo.png'));
  },
});

s.fact(F, ['`src` (a path, URL or buffer) is required.'], { kind: 'R' }, async (t, q) => {
  const src = q.tok('src');
  const { file, buffer } = await png();
  const shown = async (value) => {
    const pic = await picture({ props: { [src]: value, width: 6, height: 3 } });
    await pic.settle();
    return pic.app.screen();
  };
  const fromPath = await shown(file);
  t.match(fromPath, /^[▀▄█ ]{6}(\n[▀▄█ ]{6}){2}$/, 'a path');
  t.equal(await shown(buffer), fromPath, 'a buffer gives the same picture');
  const server = await serve(buffer);
  try {
    t.equal(await shown(server.url), fromPath, 'and so does a URL');
  } finally {
    await server.close();
  }
});

s.types(
  F,
  ['`src` (a path, URL or buffer) is required.'],
  tsx`
import React from 'react';
import Image from 'ink-picture';

export const path = <Image src="./logo.png" />;
export const url = <Image src="https://example.com/logo.png" />;
export const buffer = <Image src={Buffer.from([])} />;
export const noSrc = <Image width={10} height={5} />; //! TS2741
`,
  { project: 'external' },
);

s.fact(F, ['`width` and `height` (a number of cells or a percentage of a parent `<Box>` with a determinable size) default to `"100%"`.'], { kind: 'D' }, async (t, q) => {
  const [w, hgt] = [q.tok('width'), q.tok('height')];
  const BoxEl = q.el((await externalHarness()).ink, '<Box>');
  const percent = JSON.parse(q.tok('"100%"'));
  const { file } = await png({ width: 16, height: 16 });
  const shown = async (imageProps, parentProps) => {
    const pic = await picture({ props: { src: file, ...imageProps }, wrap: (image, h2, ink2) => (parentProps ? h2(BoxEl, parentProps, image) : image), columns: 40, rows: 20 });
    await pic.settle();
    const lines = pic.app.screen().split('\n').filter((l) => l.trim());
    return [lines[0]?.trimEnd().length, lines.length];
  };
  t.deepEqual(await shown({ [w]: 10, [hgt]: 5 }), [10, 5], 'numbers are cells');
  t.deepEqual(await shown({ [w]: '60%', [hgt]: '80%' }, { width: 20, height: 10 }), [12, 8], 'a percentage is of the parent <Box>');
  t.deepEqual(await shown({}, { width: 20, height: 6 }), [20, 6], 'with neither the image fills its parent');
  t.deepEqual(await shown({ [w]: percent, [hgt]: percent }, { width: 20, height: 6 }), [20, 6], 'which is the same as 100%');
});

s.fact(F, ["`alt`, `objectFit` (`'fill' | 'contain' | 'cover'`, default `'fill'`) and `protocol` (to force one rendering protocol) are optional."], { kind: 'D' }, async (t, q) => {
  const alt = q.tok('alt');
  const fit = q.tok('objectFit');
  const values = q.tok("'fill' | 'contain' | 'cover'").split('|').map((v) => v.trim().replace(/'/g, ''));
  const dflt = q.tok("'fill'").replace(/'/g, '');
  const protocol = q.tok('protocol');
  const { file } = await png({ width: 16, height: 4, stripes: [0xff0000ff, 0x00ff00ff, 0x0000ffff] });
  const draw = async (props, info = {}) => {
    const pic = await picture({ props: { src: file, width: 8, height: 8, ...props }, info });
    await pic.settle();
    return pic.app;
  };
  // half-block cells carry the picture in their colours, which screen() leaves out: compare bytes
  const bytes = async (props) => (await draw(props)).bytes();
  t.equal(await bytes({ [fit]: dflt }), await bytes({}), `${fit} defaults to ${dflt}`);
  const drawn = await Promise.all(values.map((value) => bytes({ [fit]: value })));
  t.equal(new Set(drawn).size, values.length, `the ${values.length} values (${values.join(', ')}) all draw differently`);
  t.ok(values.includes(dflt), 'and the default is one of them');
  t.match((await draw({ [protocol]: 'braille' })).screen(), /^[\u2800-\u28ff]/, `${protocol} forces a rendering protocol even where half-block would be chosen`);
  const loading = await picture({ props: { src: '/nonexistent/logo.png', width: 20, height: 2, [alt]: 'A logo' } });
  await loading.settle();
  t.match(loading.app.screen(), /A logo/, 'alt is what is shown when the image cannot be loaded');
});

s.types(
  F,
  ["`alt`, `objectFit` (`'fill' | 'contain' | 'cover'`, default `'fill'`) and `protocol` (to force one rendering protocol) are optional."],
  tsx`
import React from 'react';
import Image from 'ink-picture';

export const bare = <Image src="a.png" />;
export const all = <Image src="a.png" alt="x" objectFit="cover" protocol="kitty" />;
export const hint = <Image src="a.png" protocol={{full: 'kitty'}} />;
export const fits = [<Image key="a" src="a.png" objectFit="fill" />, <Image key="b" src="a.png" objectFit="contain" />, <Image key="c" src="a.png" objectFit="cover" />];
export const badFit = <Image src="a.png" objectFit="stretch" />; //! TS2322
export const badProtocol = <Image src="a.png" protocol="png" />; //! TS2322
`,
  { project: 'external', ctx: ["'fill' | 'contain' | 'cover'", "'fill'", 'default'] },
);
