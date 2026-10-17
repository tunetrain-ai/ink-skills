// Claims for skills/ecosystem/data-display/ink-markdown-and-code/SKILL.md.
import { join } from 'node:path';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import semver from 'semver';
import hljs from 'highlight.js';
import * as cliHighlight from 'cli-highlight';
import { Marked, Renderer } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { skill, tsx, h, ink, React, stripAnsi, externalHarness, extImport, extPkg, extReadFile, runExternal, runIsolated, pkg, packageDir } from '../lib/index.mjs';
import { npmInstall } from './ink-navigation.helpers.mjs';

const { Box, Text, renderToString } = ink;
const { highlight } = cliHighlight;
const s = skill('ink-markdown-and-code');
const F = 'SKILL.md';

const base = { ink: pkg('ink').version, react: pkg('react').version };
const parse = (text, options) => new Marked(markedTerminal(options)).parse(text, { async: false });
const lines = (element, columns = 100) => stripAnsi(renderToString(element, { columns })).split('\n');
const ESC = /\x1b\[[0-9;]*m/;
const hasAnsi = (text) => ESC.test(text);

/** In a real process: does `import(name)` fail, and with which error code? (Node 22.12 and later load require(esm).) */
const importIn = async (name) => {
  const run = await runExternal({ code: `try { await import('${name}'); console.log(JSON.stringify({loaded: true})); } catch (e) { console.log(JSON.stringify({loaded: false, code: e.code})); }` });
  return run.json;
};
const requiresEsm = semver.gte(process.versions.node, '22.12.0');

// marked-terminal and cli-highlight read the colour environment once, at import: one process per environment
const colorRuns = new Map();
const colorProbe = ({ tty = {}, env = {} } = {}) => {
  const key = JSON.stringify({ tty, env });
  if (!colorRuns.has(key)) colorRuns.set(key, runIsolated({ probe: 'ink-markdown-and-code-colors', tty, env }).then((run) => run.json));
  return colorRuns.get(key);
};
const TERMINAL = { tty: { isTTY: true, columns: 80 }, env: { TERM: 'xterm-256color' } };

// ===================================================================== description

s.fact(
  F,
  ['Render Markdown text or syntax-highlighted source code in an Ink terminal UI — marked + marked-terminal for Markdown and cli-highlight for code, both turned into ANSI strings inside <Text> — and the status on Ink 8 of ink-markdown, @kud/ink-markdown and ink-syntax-highlight.'],
  { kind: 'P' },
  async (t, q) => {
    const markdown = '# Hello\n\nThis is **markdown**.';
    const rendered = parse(markdown);
    t.ok(hasAnsi(rendered), 'marked + marked-terminal turn Markdown into an ANSI string');
    t.deepEqual(lines(h(Text, null, rendered.trimEnd())), ['# Hello', '', 'This is markdown.'], 'which <Text> shows as formatted text');
    const code = "const hello = 'world';";
    t.ok(hasAnsi(highlight(code, { language: 'javascript' })), 'cli-highlight turns code into an ANSI string');
    t.deepEqual(lines(h(Text, null, highlight(code, { language: 'javascript' }))), [code], 'which <Text> shows');
    t.equal(semver.major(pkg('ink').version), Number(q.tok('8')), 'the Ink in use');
    t.equal((await importIn('ink-markdown')).loaded, false, 'ink-markdown cannot be loaded on it');
    const ext = await externalHarness();
    const { MarkdownViewport } = await extImport('@kud/ink-markdown');
    const viewport = ext.mount(ext.h(MarkdownViewport, { source: markdown, width: 30, height: 4 }), { columns: 40 });
    await viewport.flush();
    t.equal(viewport.screen(), 'Hello\n\nThis is markdown.', '@kud/ink-markdown renders');
    const { default: SyntaxHighlight } = await extImport('ink-syntax-highlight');
    const highlighted = ext.mount(ext.h(SyntaxHighlight, { code, language: 'javascript' }), { columns: 40 });
    await highlighted.flush();
    t.equal(highlighted.screen(), code, 'ink-syntax-highlight renders');
  },
);

s.guidance(F, ['Use when the user wants to display formatted Markdown or colorized code in their CLI.'], 'tells an agent when to load the skill; it asserts nothing about behaviour');

// ===================================================================== the recipe

s.fact(
  F,
  ['Ink passes ANSI escape sequences inside a string through `<Text>` intact and measures them correctly, so Markdown or source code can be turned into an **ANSI string** by a plain library and rendered with `<Text>`.'],
  { kind: 'R', ctx: ['ANSI string'] },
  async (t, q) => {
    const Component = q.el(ink, '<Text>');
    const ansi = highlight("const hello = 'world';", { language: 'javascript' });
    t.ok(hasAnsi(ansi), 'positive control: the string carries escape sequences');
    t.equal(renderToString(h(Component, null, ansi)), ansi, 'intact: <Text> writes the very same string');
    // measured correctly: the escape sequences take no room
    const visible = stripAnsi(ansi);
    t.ok(ansi.length > visible.length + 8);
    t.deepEqual(lines(h(Box, { width: visible.length }, h(Component, null, ansi))), [visible], 'a box exactly as wide as the visible text does not wrap it');
    const framed = lines(h(Box, { borderStyle: 'single', alignSelf: 'flex-start' }, h(Component, null, ansi)));
    t.equal(framed[0].length, visible.length + 2, 'and a border hugs the visible width');
    t.equal(framed.length, 3);
    const wrapped = lines(h(Box, { width: 12 }, h(Component, null, ansi)));
    t.deepEqual(wrapped, ["const hello", "= 'world';"], 'wrapping happens at the visible width too');
  },
);

s.fact(F, ['These libraries declare no Ink peer range, unlike the wrapper packages below.'], { kind: 'P' }, async (t) => {
  for (const name of ['marked', 'marked-terminal', 'cli-highlight']) t.equal(pkg(name).peerDependencies?.ink, undefined, `${name} has no peer range for ink`);
  for (const name of ['ink-markdown', '@kud/ink-markdown', 'ink-syntax-highlight']) t.equal(typeof extPkg(name).peerDependencies.ink, 'string', `${name} has one`);
});

s.fence(F, 0, {
  run: async (t, fence) => {
    const [command, subcommand, ...packages] = fence.code.trim().split(/\s+/);
    t.deepEqual([command, subcommand], ['npm', 'install']);
    const run = await npmInstall({ dependencies: base, install: packages });
    t.equal(run.status, 0, `resolves next to Ink ${base.ink} with strict peer dependencies`);
    t.deepEqual(['marked', 'marked-terminal', 'cli-highlight'].map((name) => run.lock.packages[`node_modules/${name}`].version.split('.')[0]), ['15', '7', '2']);
  },
});

s.fact(F, ['`marked-terminal@7` accepts `marked <16`, so pin `marked@^15`.'], { kind: 'P' }, async (t, q) => {
  const [name, major] = q.tok('marked-terminal@7').split('@');
  t.equal(semver.major(pkg(name).version), Number(major), 'the installed marked-terminal');
  const [peerName, upper] = q.tok('marked <16').split(' <');
  const peer = pkg(name).peerDependencies[peerName];
  t.ok(semver.satisfies(`${Number(upper) - 1}.99.0`, peer), `its peer range ${peer} accepts every marked below ${upper}`);
  t.ok(!semver.satisfies(`${upper}.0.0`, peer), `and not ${upper}.0.0`);
  const [pinned, range] = q.tok('marked@^15').split('@');
  t.ok(semver.subset(range, peer), `${range} is inside the peer range`);
  t.ok(semver.satisfies(pkg(pinned).version, range), 'and the installed marked is in it');
  const run = await npmInstall({ install: [q.tok('marked@^15'), name] });
  t.equal(run.status, 0, 'so npm resolves the pair with strict peers');
});

s.fact(F, ['`marked-terminal` ships no types — add `@types/marked-terminal` for TypeScript.'], { kind: 'P' }, async (t, q) => {
  const name = q.tok('marked-terminal');
  const meta = pkg(name);
  t.equal(meta.types ?? meta.typings, undefined, 'no types field in package.json');
  t.deepEqual(Object.keys(meta.exports.node), ['import', 'require'], 'and no types condition in its exports');
  const walk = (dir) => readdirSync(dir).flatMap((entry) => (statSync(join(dir, entry)).isDirectory() ? walk(join(dir, entry)) : [join(dir, entry)]));
  t.deepEqual(walk(packageDir(name)).filter((file) => /\.d\.[cm]?ts$/.test(file)), [], 'no declaration files in the package');
  const typesName = q.tok('@types/marked-terminal');
  t.equal(pkg(typesName).name, typesName, 'the types come from the separate package');
  t.ok(readFileSync(join(packageDir(typesName), 'index.d.ts'), 'utf8').includes('export function markedTerminal'), 'which declares markedTerminal');
});

// ===================================================================== the example

s.fence(F, 1, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const { apps } = await runFence(fence, { mountOptions: { columns: 45 } });
    await apps[0].flush();
    t.equal(
      stripAnsi(apps[0].screen()),
      ['# Hello', '', 'This is markdown printed in the terminal.', '', '    * one', '    * two', "const hello: string = 'world';"].join('\n'),
      'the Markdown, then the highlighted code',
    );
    t.ok(hasAnsi(apps[0].bytes()), 'with colours');
    await apps[0].resize(30);
    t.equal(
      stripAnsi(apps[0].screen().split('\n').slice(-8).join('\n')),
      ['# Hello', '', 'This is markdown printed in', 'the terminal.', '', '    * one', '    * two', "const hello: string = 'world';"].join('\n'),
      'and the paragraph re-wraps to the new width when the terminal is resized',
    );
  },
});

s.types(
  F,
  ['@types/marked-terminal still types this as the pre-v7 TerminalRenderer;'],
  tsx`
import type {MarkedExtension} from 'marked';
import TerminalRenderer, {markedTerminal} from 'marked-terminal';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const typedAsTheRenderer: Same<ReturnType<typeof markedTerminal>, TerminalRenderer> = true;
export const notAnExtension: MarkedExtension = markedTerminal(); //! TS2559
export const cast: MarkedExtension = markedTerminal() as unknown as MarkedExtension;
`,
);

s.fact(F, ['@types/marked-terminal still types this as the pre-v7 TerminalRenderer;'], { kind: 'P' }, async (t) => {
  const types = pkg('@types/marked-terminal');
  t.ok(semver.major(types.version) < semver.major(pkg('marked-terminal').version), `the types are ${types.version}, the library ${pkg('marked-terminal').version}`);
  const declaration = readFileSync(join(packageDir('@types/marked-terminal'), 'index.d.ts'), 'utf8');
  t.match(declaration, /export default class TerminalRenderer extends Renderer/, 'they declare a TerminalRenderer, a marked Renderer ...');
  t.match(declaration, /\): TerminalRenderer;/, '... as the return type of markedTerminal');
});

s.fact(F, ['marked-terminal@7 actually returns a MarkedExtension.'], { kind: 'R' }, async (t, q) => {
  t.equal(semver.major(pkg('marked-terminal').version), Number(q.tok('7')), 'the installed marked-terminal');
  const extension = markedTerminal();
  t.ok(!(extension instanceof Renderer), 'not a Renderer instance');
  t.equal(typeof extension.renderer, 'object', 'a plain object with a renderer: the shape of a MarkedExtension');
  t.deepEqual(Object.keys(extension).sort(), ['renderer', 'useNewRenderer'], 'and nothing else');
  t.ok(Object.values(extension.renderer).every((fn) => typeof fn === 'function'), 'whose members are the render functions');
  t.equal(new Marked(extension).parse('**x**', { async: false }), parse('**x**'), 'that Marked accepts as an extension');
});

// ===================================================================== width, colours, streaming, highlight()

const PARAGRAPH = `${'word '.repeat(40).trim()}\n\n---\n`;

s.fact(F, ['**Width.** `reflowText` defaults to `false`, in which case `marked-terminal` leaves paragraphs unwrapped and Ink wraps them to the box.'], { kind: 'D', ctx: ['Width.'] }, async (t, q) => {
  const [option, value] = ['reflowText', q.tok('false')];
  t.equal(q.tok('reflowText'), option);
  const out = parse(PARAGRAPH, { [option]: JSON.parse(value) });
  t.equal(out, parse(PARAGRAPH), `${value} is the default`);
  t.equal(stripAnsi(out).split('\n')[0].trim(), 'word '.repeat(40).trim(), 'the paragraph is one unbroken line');
  t.notEqual(parse(PARAGRAPH, { [option]: true }), out, 'positive control: reflowText: true does change it');
  const name = q.tok('marked-terminal');
  t.equal(typeof pkg(name).version, 'string');
  t.ok(lines(h(Box, { width: 30 }, h(Text, null, out.trimEnd()))).every((line) => line.length <= 30), 'Ink wraps it to the box ...');
  t.ok(lines(h(Box, { width: 30 }, h(Text, null, out.trimEnd()))).length > 5, '... over several lines');
});

s.fact(
  F,
  ['`width` (default `80`) only takes effect with `reflowText: true`, which re-wraps paragraphs and draws horizontal rules `width - 1` dashes long — pass the terminal width from `useWindowSize()` so it follows resizes.'],
  { kind: 'D' },
  async (t, q) => {
    const width = q.tok('width');
    const dflt = Number(q.tok('80'));
    const [option, on] = q.tok('reflowText: true').split(': ');
    const options = (extra) => ({ [option]: JSON.parse(on), ...extra });
    const longest = (text) => Math.max(...stripAnsi(text).split('\n').map((line) => line.length));
    t.equal(parse(PARAGRAPH, { [width]: 30 }), parse(PARAGRAPH), 'without reflowText, width changes nothing');
    t.ok(longest(parse(PARAGRAPH, options({ [width]: 30 }))) <= 30 && parse(PARAGRAPH, options({ [width]: 30 })).split('\n').length > 5, 'with it, paragraphs are re-wrapped to width');
    t.equal(parse(PARAGRAPH, options()), parse(PARAGRAPH, options({ [width]: dflt })), `${dflt} is the default width`);
    t.ok(longest(parse(PARAGRAPH, options())) <= dflt && longest(parse(PARAGRAPH, options())) > dflt - 10, 'filled up to it');
    const rule = (n) => stripAnsi(parse(PARAGRAPH, options({ [width]: n }))).split('\n').find((line) => /^-+$/.test(line));
    const minus = Number(q.tok('width - 1').split(' - ')[1]);
    t.equal(rule(30), '-'.repeat(30 - minus), 'horizontal rules are width - 1 dashes long');
    t.equal(rule(dflt), '-'.repeat(dflt - minus));
    const hook = q.api(ink, 'useWindowSize()');
    const Probe = () => h(Text, null, String(hook().columns));
    const app = (await import('../lib/index.mjs')).mount(h(Probe), { columns: 40 });
    await app.flush();
    t.equal(app.screen(), '40', 'useWindowSize reports the terminal width ...');
    await app.resize(30);
    t.equal(app.screen().split('\n').at(-1), '30', '... and follows resizes');
  },
);

s.fact(F, ['**Colors.** The output contains color codes only when `chalk` detects color support (a TTY, or `FORCE_COLOR`).'], { kind: 'R', ctx: ['Colors.'] }, async (t, q) => {
  const chalk = q.tok('chalk');
  t.ok(pkg('marked-terminal').dependencies[chalk] && pkg('cli-highlight').dependencies[chalk], 'both libraries get their colours from chalk');
  const force = q.tok('FORCE_COLOR');
  const plain = await colorProbe();
  t.ok(!hasAnsi(plain.markdown) && !hasAnsi(plain.code), 'no terminal, no FORCE_COLOR: no colour codes');
  const terminal = await colorProbe(TERMINAL);
  t.ok(hasAnsi(terminal.markdown) && hasAnsi(terminal.code), 'a colour-capable TTY: colour codes');
  const forced = await colorProbe({ env: { [force]: '1' } });
  t.ok(hasAnsi(forced.markdown) && hasAnsi(forced.code), 'FORCE_COLOR without a TTY: colour codes');
  const off = await colorProbe({ ...TERMINAL, env: { ...TERMINAL.env, [force]: '0' } });
  t.ok(!hasAnsi(off.markdown) && !hasAnsi(off.code), 'positive control: FORCE_COLOR=0 turns them off even on a TTY');
});

s.fact(F, ['In tests, strip ANSI or set `FORCE_COLOR=0` (see `ink-testing`).'], { kind: 'R', ctx: ['ink-testing'] }, async (t, q) => {
  const [variable, value] = q.tok('FORCE_COLOR=0').split('=');
  const colored = await colorProbe(TERMINAL);
  const off = await colorProbe({ ...TERMINAL, env: { ...TERMINAL.env, [variable]: value } });
  t.ok(hasAnsi(colored.markdown), 'positive control: the coloured output has escape sequences');
  t.ok(!hasAnsi(off.markdown) && !hasAnsi(off.code), `${variable}=${value}: the output has none`);
  t.equal(stripAnsi(colored.markdown), off.markdown, 'and stripping the coloured output leaves exactly that text (Markdown)');
  t.equal(stripAnsi(colored.code), off.code, '(code)');
});

s.fact(F, ['**Streaming Markdown** (a growing LLM response): re-run the same `parse` on the accumulated text each time it changes; memoize on the text.'], { kind: 'R', ctx: ['Streaming Markdown'] }, async (t, q) => {
  const method = q.tok('parse');
  t.equal(typeof new Marked()[method], 'function', 'parse is a method of Marked');
  const document = '# Title\n\nSome **bold** and `code` text\n\n- one\n- two\n\n```js\nconst a = 1;\n```\n\nThe end.\n';
  const marked = new Marked(markedTerminal({ reflowText: true, width: 40 }));
  let last;
  for (let end = 1; end <= document.length; end += 3) {
    const accumulated = document.slice(0, end);
    last = marked[method](accumulated, { async: false });
    t.equal(typeof last, 'string', `${JSON.stringify(accumulated.slice(-8))}: a string at every step`);
    t.equal(marked[method](accumulated, { async: false }), last, 'the same text gives the same output, so it can be memoized on the text');
  }
  const final = marked[method](document, { async: false });
  t.equal(final, new Marked(markedTerminal({ reflowText: true, width: 40 }))[method](document, { async: false }), 'the same Marked, run over every prefix, ends where a fresh one does');
  t.equal(stripAnsi(final).trim().split('\n')[0], '# Title');
});

s.guidance(F, ['memoize on the text'], 'advice about React memoisation; the output depends only on the text, which the claim before it shows', { exempt: [] });

s.fact(
  F,
  ["`highlight()` takes any [highlight.js language](https://github.com/highlightjs/highlight.js/blob/master/SUPPORTED_LANGUAGES.md) as `language` and auto-detects when it is omitted — pass it when you know it, since auto-detection can guess wrong on short snippets (`print('hi')` is detected as Stylus, not Python)."],
  { kind: 'R' },
  async (t, q) => {
    const call = q.api(cliHighlight, 'highlight()');
    const language = q.tok('language');
    const snippet = q.tok("print('hi')");
    const [, wrong, right] = "(`print('hi')` is detected as Stylus, not Python)".match(/detected as (\w+), not (\w+)\)/);
    const names = hljs.listLanguages();
    t.ok(names.length > 100, `highlight.js ships ${names.length} languages`);
    for (const name of names) t.equal(typeof call('x = 1', { [language]: name }), 'string', `${name} is accepted`);
    t.equal(typeof call('x = 1', { [language]: 'ts' }), 'string', 'and so are its aliases');
    const [warn, error] = [console.warn, console.error];
    console.warn = console.error = () => {};
    try {
      t.throws(() => call('x = 1', { [language]: 'no-such-language' }), /Unknown language/, 'positive control: a name highlight.js does not know throws');
    } finally {
      [console.warn, console.error] = [warn, error];
    }
    t.equal(call('{"a": 1}'), call('{"a": 1}', { [language]: 'json' }), 'without language the language is detected: here JSON');
    t.ok(hasAnsi(call('{"a": 1}')), 'and the result is highlighted');
    const detected = hljs.highlightAuto(snippet).language;
    t.equal(detected, wrong.toLowerCase(), `${snippet} is detected as ${wrong}`);
    t.equal(call(snippet), call(snippet, { [language]: detected }), 'and that is what is drawn');
    t.notEqual(call(snippet), call(snippet, { [language]: right.toLowerCase() }), `which is not what ${right} highlighting gives`);
  },
);

s.fact(F, ['Its `theme` option is a [`cli-highlight` theme](https://github.com/felixfbecker/cli-highlight#themes).'], { kind: 'R' }, async (t, q) => {
  const theme = q.tok('theme');
  const name = q.tok('cli-highlight');
  t.equal(pkg(name).name, name);
  const code = "const hello = 'world';";
  const custom = { keyword: (text) => `<${text}>`, string: (text) => `[${text}]` };
  t.equal(highlight(code, { language: 'javascript', [theme]: custom }), "<const> hello = ['world'];", 'the functions of the theme are applied to the matching tokens');
  t.notEqual(highlight(code, { language: 'javascript' }), highlight(code, { language: 'javascript', [theme]: custom }), 'positive control: the default theme looks different');
  t.equal(typeof cliHighlight.DEFAULT_THEME, 'object', 'a theme is an object of such functions, keyed by token class');
  t.ok(Object.values(cliHighlight.DEFAULT_THEME).every((fn) => typeof fn === 'function'));
});

// ===================================================================== the wrapper packages

s.fact(
  F,
  ['| `ink-markdown` | **cannot be loaded** | CommonJS build that `require()`s Ink: `ERR_REQUIRE_ASYNC_MODULE`. It only wrapped `marked-terminal`, which the recipe above uses directly. |'],
  { kind: 'P', ctx: ['cannot be loaded'] },
  async (t, q) => {
    const name = q.tok('ink-markdown');
    const meta = extPkg(name);
    t.notEqual(meta.type, 'module', 'a CommonJS build');
    const source = extReadFile(name, meta.main);
    t.ok(source.includes(q.tok('require()').replace('()', '("ink")')), 'that require()s Ink');
    const run = await importIn(name);
    t.equal(run.loaded, false, 'it cannot be loaded');
    if (requiresEsm) t.equal(run.code, q.tok('ERR_REQUIRE_ASYNC_MODULE'));
    const wrapped = q.tok('marked-terminal');
    t.deepEqual([...source.matchAll(/require\("([^"]+)"\)/g)].map((m) => m[1]), ['react', 'marked', 'ink', wrapped], 'it needs marked and marked-terminal besides React and Ink: nothing else does the rendering');
    t.ok(source.includes('parse)(children)'), 'it hands its children to marked.parse');
    t.ok(s.fenceOf(F, 1).code.includes(`from '${wrapped}'`), 'which the recipe above uses directly');
  },
);

s.fact(
  F,
  ['| `@kud/ink-markdown` | peer `ink 7.x` | Needs `--legacy-peer-deps` on Ink 8, where its `MarkdownViewport` renders a `source` string at a given `width` and `height`. It has no `<Markdown>` component. |'],
  { kind: 'P' },
  async (t, q) => {
    const name = q.tok('@kud/ink-markdown');
    const meta = extPkg(name);
    const [inkName, range] = q.tok('ink 7.x').split(' ');
    t.equal(meta.peerDependencies[inkName], range, 'its peer range');
    t.equal(semver.major(extPkg('ink').version), Number(q.tok('8')), 'the Ink in use');
    t.ok(!semver.satisfies(extPkg('ink').version, range), 'is not satisfied by it');
    const flag = q.tok('--legacy-peer-deps');
    const strict = await npmInstall({ dependencies: base, install: [name] });
    t.equal(strict.code, 'ERESOLVE', 'so npm refuses it with strict peers');
    const legacy = await npmInstall({ dependencies: base, install: [name], args: [flag] });
    t.equal(legacy.status, 0, `and takes it with ${flag}`);

    const ext = await externalHarness();
    const kud = await extImport(name);
    const Viewport = q.api(kud, 'MarkdownViewport');
    const [source, width, height] = [q.tok('source'), q.tok('width'), q.tok('height')];
    const document = `# Title\n\n${'word '.repeat(30)}\n\n${Array.from({ length: 20 }, (_, i) => `- item ${i}`).join('\n')}`;
    const show = async (props) => {
      const app = ext.mount(ext.h(Viewport, { [source]: document, ...props }), { columns: 80, rows: 60 });
      await app.flush();
      return app.screen().split('\n');
    };
    const wide = await show({ [width]: 40, [height]: 50 });
    t.equal(wide[0], 'Title', 'the heading, without its # marker');
    t.ok(wide[2].length <= 40 && wide[2].length > 30, 'paragraphs wrap at width');
    t.ok(wide.includes('• item 0') && wide.length > 20, 'lists get bullets');
    t.equal((await show({ [width]: 40, [height]: 5 })).length, 5, 'height is the number of rows shown');
    t.equal((await show({ [width]: 20, [height]: 50 }))[2].length <= 20, true, 'a narrower width wraps sooner');
    t.equal((await show({})).join('').trim(), '', 'positive control: without a size nothing is drawn');
    const missing = q.tok('<Markdown>').replace(/[<>]/g, '');
    t.equal(kud[missing], undefined, `no ${missing} export`);
    t.equal(kud.default, undefined, 'and no default export');
    t.match(extReadFile('ink-markdown', 'build/index.js'), new RegExp(`function ${missing}\\(`), `positive control: ${missing} is what the other wrapper, ink-markdown, calls its component`);
  },
);

s.fact(
  F,
  ['| `ink-syntax-highlight` | peer `ink ^5.1.0`, `react ^18.3.1` | Needs `--legacy-peer-deps` on Ink 8 and React 19, where it renders. It only calls `cli-highlight`, so calling that directly (above) avoids the conflict. |'],
  { kind: 'P' },
  async (t, q) => {
    const name = q.tok('ink-syntax-highlight');
    const meta = extPkg(name);
    const [inkName, inkRange] = q.tok('ink ^5.1.0').split(' ');
    const [reactName, reactRange] = q.tok('react ^18.3.1').split(' ');
    t.equal(meta.peerDependencies[inkName], inkRange);
    t.equal(meta.peerDependencies[reactName], reactRange);
    t.equal(semver.major(extPkg('ink').version), Number(q.tok('8')), 'the Ink in use');
    t.equal(semver.major(extPkg('react').version), Number(q.tok('19')), 'next to React 19');
    t.ok(!semver.satisfies(extPkg('ink').version, inkRange) && !semver.satisfies(extPkg('react').version, reactRange), 'both outside the ranges');
    const flag = q.tok('--legacy-peer-deps');
    const strict = await npmInstall({ dependencies: base, install: [name] });
    t.equal(strict.code, 'ERESOLVE', 'strict peers: refused');
    const legacy = await npmInstall({ dependencies: base, install: [name], args: [flag] });
    t.equal(legacy.status, 0, `${flag}: installed`);

    const library = q.tok('cli-highlight');
    t.deepEqual(Object.keys(meta.dependencies), [library], 'its only dependency is cli-highlight');
    const source = extReadFile(name, 'build/index.js');
    t.ok(source.includes(`from '${library}'`) && source.includes('highlight(code, { language, theme })'), 'which it calls with the code, language and theme');
    const ext = await externalHarness();
    const { default: SyntaxHighlight } = await extImport(name);
    const code = "const hello = 'world';";
    const component = ext.ink.renderToString(ext.h(SyntaxHighlight, { code, language: 'javascript' }));
    t.equal(component, ext.ink.renderToString(ext.h(ext.ink.Text, null, highlight(code, { language: 'javascript' }))), 'it renders what <Text> renders for the highlighted string');
    t.ok(hasAnsi(component), 'with colours');
  },
);

s.guidance(F, ['If you do use `ink-syntax-highlight`:'], 'introduces the example below; the package is covered by the table row above', { exempt: ['ink-syntax-highlight'] });

s.fence(F, 2, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const { apps } = await runFence(fence, { mountOptions: { columns: 40 } });
    await apps[0].flush();
    t.equal(apps[0].screen(), "const hello = 'world';", 'draws the code');
    t.ok(hasAnsi(apps[0].bytes()), 'highlighted');
  },
});

// ===================================================================== the props of ink-syntax-highlight

const CODE_ROW = '| `code` | `string` | Source to highlight. **Required.** |';
const LANGUAGE_ROW = '| `language` | `string` | Any highlight.js language; auto-detected if omitted. |';
const THEME_ROW = '| `theme` | `Theme` | A `cli-highlight` theme object, for custom colors. |';

s.types(
  F,
  [CODE_ROW, LANGUAGE_ROW, THEME_ROW],
  tsx`
import React from 'react';
import SyntaxHighlight from 'ink-syntax-highlight';
import type {Props} from 'ink-syntax-highlight';
import type {Theme} from 'cli-highlight';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const exact: Same<Props, {readonly code: string; readonly language?: string; readonly theme?: Theme}> = true;
export const minimal = <SyntaxHighlight code="x" />;
export const full = <SyntaxHighlight code="x" language="typescript" theme={{keyword: (text: string) => text}} />;
export const required = <SyntaxHighlight />; //! TS2741
export const codeIsAString = <SyntaxHighlight code={1} />; //! TS2322
export const languageIsAString = <SyntaxHighlight code="x" language={1} />; //! TS2322
export const themeIsAnObject = <SyntaxHighlight code="x" theme={1} />; //! TS2559
`,
  { project: 'external', ctx: ['code', 'string', 'Required.', 'language', 'theme', 'Theme', 'cli-highlight'] },
);

s.fact(F, [CODE_ROW, LANGUAGE_ROW, THEME_ROW], { kind: 'R', ctx: ['string', 'Required.', 'Theme'] }, async (t, q) => {
  const [code, language, theme] = [q.tok('code'), q.tok('language'), q.tok('theme')];
  const library = q.tok('cli-highlight');
  const ext = await externalHarness();
  const { default: SyntaxHighlight } = await extImport('ink-syntax-highlight');
  const render = (props) => ext.ink.renderToString(ext.h(SyntaxHighlight, props));
  const source = "const hello = 'world';";
  t.equal(stripAnsi(render({ [code]: source, [language]: 'javascript' })), source, 'code is the source that is drawn');
  t.throws(() => render({ [language]: 'javascript' }), 'it is required: without it nothing can be highlighted');
  t.equal(render({ [code]: '{"a": 1}' }), render({ [code]: '{"a": 1}', [language]: 'json' }), 'without language the language is auto-detected (here JSON)');
  t.notEqual(render({ [code]: "print('hi')", [language]: 'python' }), render({ [code]: "print('hi')" }), 'positive control: a language that differs from the detected one changes the colours');
  for (const name of hljs.listLanguages()) t.equal(stripAnsi(render({ [code]: 'x = 1', [language]: name })), 'x = 1', `${name} is accepted`);
  const custom = { keyword: (text) => `<${text}>`, string: (text) => `[${text}]` };
  t.ok(extPkg('ink-syntax-highlight').dependencies[library], `theme is passed on to ${library}`);
  t.equal(render({ [code]: source, [language]: 'javascript', [theme]: custom }), "<const> hello = ['world'];", `a ${library} theme: its functions colour the tokens`);
  t.notEqual(render({ [code]: source, [language]: 'javascript' }), render({ [code]: source, [language]: 'javascript', [theme]: custom }), 'positive control: the default theme looks different');
});
