// Claims for skills/ecosystem/inkjs-ui/inkjs-ui-feedback/SKILL.md.
import { readFileSync } from 'node:fs';
import spinners from 'cli-spinners';
import { skill, tsx, runFence, loadEcosystem, pkg, stripAnsi } from '../lib/index.mjs';
import { ui, h, ink, open, spy, skillText, lines, waitFor } from './inkjs-ui-inputs.helpers.mjs';
import { stubTimers, framesOf, SGR_OPEN } from './inkjs-ui-feedback.helpers.mjs';

const s = skill('inkjs-ui-feedback');
const F = 'SKILL.md';
const MD = skillText('inkjs-ui-feedback');
const { Box, Text, renderToString } = ink;

const EQ = `type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;`;
const render = (element, columns = 40) => renderToString(element, { columns });
/** The label of a fence's single `<Component label="…">`, read out of the fence text. */
const attr = (fence, name) => fence.code.match(new RegExp(`${name}="([^"]*)"`))[1];
const VARIANTS = ['info', 'success', 'error', 'warning'];

// ===================================================================== description

s.fact(
  F,
  ['@inkjs/ui feedback components: Spinner, ProgressBar, Badge, StatusMessage, Alert — for loading states, progress, tags, and success/error/warning/info messages.'],
  { kind: 'R' },
  async (t) => {
    for (const name of ['Spinner', 'ProgressBar', 'Badge', 'StatusMessage', 'Alert']) t.equal(typeof ui[name], 'function', `${name} is an export of @inkjs/ui`);
    t.equal(stripAnsi(render(h(ui.Spinner, { label: 'Loading' }))), `${spinners.dots.frames[0]} Loading`, 'a Spinner for a loading state');
    t.equal(stripAnsi(render(h(ui.ProgressBar, { value: 50 }), 10)), '█████░░░░░', 'a ProgressBar for progress');
    t.equal(stripAnsi(render(h(ui.Badge, null, 'new'))).trim(), 'NEW', 'a Badge for a tag');
    const symbols = new Set();
    for (const variant of ['success', 'error', 'warning', 'info']) {
      const status = stripAnsi(render(h(ui.StatusMessage, { variant }, 'msg')));
      const alert = stripAnsi(render(h(ui.Alert, { variant }, 'msg'), 20));
      t.ok(status.endsWith('msg') && alert.includes('msg'), `${variant}: both show the message`);
      symbols.add(status);
    }
    t.equal(symbols.size, 4, 'and each of the four message kinds looks different');
  },
);

s.guidance(F, ['Use whenever the user wants a spinner, progress bar, status tag, or colored alert/message box.'], 'a recommendation about when to reach for the skill; it asserts nothing about behaviour (each component is exercised by the claims below)');

// ===================================================================== Spinner

s.fence(F, 0, {
  run: async (t, fence) => {
    const { mod } = await runFence(fence);
    const app = await open(h(mod.Example));
    t.equal(app.screen(), `${spinners.dots.frames[0]} ${attr(fence, 'label')}`, 'the first frame of the default spinner, then the label');
  },
});

s.types(F, ['`label` | `string` | Shown next to the spinner glyph.'], tsx`
import React from 'react';
import {Spinner} from '@inkjs/ui';
${EQ}
type Props = React.ComponentProps<typeof Spinner>;
export const type: Equal<Props['label'], string | undefined> = true;
export const ok = <Spinner label="Loading" />;
export const wrong = <Spinner label={1} />; //! TS2322
`);
s.fact(F, ['`label` | `string` | Shown next to the spinner glyph.'], { kind: 'R' }, async (t, q) => {
  const prop = q.tok('label');
  const text = 'Loading';
  t.equal(typeof text, q.tok('string'), 'a string');
  const glyph = spinners.dots.frames[0];
  t.equal(stripAnsi(render(h(ui.Spinner, { [prop]: text }))), `${glyph} ${text}`, 'the glyph, a space, then the label');
  t.equal(stripAnsi(render(h(ui.Spinner, {}))), glyph, 'without a label only the glyph is shown');
});

const TYPE_ROW = '`type` | spinner name | From [`cli-spinners`](https://github.com/sindresorhus/cli-spinners) — default `\'dots\'`.';
s.types(F, [TYPE_ROW], tsx`
import React from 'react';
import {Spinner} from '@inkjs/ui';
import type {SpinnerName} from 'cli-spinners';
${EQ}
type Props = React.ComponentProps<typeof Spinner>;
export const type: Equal<Props['type'], SpinnerName | undefined> = true;
export const named = <Spinner type="line" />;
export const dflt = <Spinner type={'dots'} />;
export const unknown = <Spinner type="nope" />; //! TS2322
`, { ctx: ['cli-spinners'] });
s.fact(F, [TYPE_ROW], { kind: 'D' }, async (t, q) => {
  const prop = q.tok('type');
  const library = q.tok('cli-spinners');
  const dflt = q.tok("'dots'").replace(/'/g, '');
  const names = Object.keys((await import(library)).default);
  t.ok(names.length > 50, `${library} has many spinners`);
  for (const name of names) {
    t.equal(stripAnsi(render(h(ui.Spinner, { [prop]: name }))), spinners[name].frames[0], `${name}: its first frame is drawn`);
  }
  const frames = new Set(names.map((name) => spinners[name].frames[0]));
  t.ok(frames.size > 10, 'and they differ');
  t.equal(render(h(ui.Spinner, {})), render(h(ui.Spinner, { [prop]: dflt })), 'with no type it draws the default spinner');
  t.notEqual(render(h(ui.Spinner, { [prop]: 'line' })), render(h(ui.Spinner, {})), 'positive control: another type draws something else');
  const repository = pkg(library).repository;
  t.ok(MD.includes(`](https://github.com/${typeof repository === 'string' ? repository : repository.url.replace(/^git\+https:\/\/github.com\/|\.git$/g, '')})`), 'the link points at the package repository');
});

s.fact(
  F,
  ["`Spinner` takes only `label` and `type`: its frames and interval come from the chosen `type`."],
  { kind: 'R' },
  async (t, q) => {
    const Spinner = q.api(ui, 'Spinner');
    const [label, type] = [q.tok('label'), q.tok('type')];
    for (const name of ['dots', 'line', 'bouncingBar']) {
      const { frames, interval, intervals } = await framesOf(Spinner, { [type]: name, [label]: 'x' });
      t.deepEqual(frames.slice(0, spinners[name].frames.length), spinners[name].frames.map((frame) => `${frame} x`), `${name}: the frames of cli-spinners, in order`);
      t.equal(frames[spinners[name].frames.length], frames[0], `${name}: back to the first frame after the last`);
      t.deepEqual(intervals, [spinners[name].interval], `${name}: one timer, with the interval of cli-spinners`);
      t.equal(interval, spinners[name].interval);
    }
  },
);
s.types(F, ["`Spinner` takes only `label` and `type`: its frames and interval come from the chosen `type`."], tsx`
import React from 'react';
import {Spinner} from '@inkjs/ui';
${EQ}
type Props = React.ComponentProps<typeof Spinner>;
export const keys: Equal<keyof Props, 'label' | 'type'> = true;
export const interval = <Spinner interval={50} />; //! TS2322
export const frames = <Spinner frames={['a', 'b']} />; //! TS2322
export const ok = <Spinner label="x" type="line" />;
`, { ctx: ['Spinner'] });

s.fact(
  F,
  ["For a fully custom spinner (different timing model, `time`/`delta`-based animation instead of a fixed frame set), use Ink's own `useAnimation` hook instead — see `ink-animation-and-performance`."],
  { kind: 'R' },
  async (t, q) => {
    const useAnimation = q.api(ink, 'useAnimation');
    const [time, delta] = [q.tok('time'), q.tok('delta')];
    t.ok(skillText(q.tok('ink-animation-and-performance')).includes('`useAnimation(options?)`'), 'the skill it points to documents the hook');
    const seen = [];
    const Probe = () => {
      const animation = useAnimation({ interval: 10 });
      seen.push(animation);
      return h(Text, null, String(animation.frame));
    };
    const app = await open(h(Probe));
    await waitFor(() => seen.at(-1)[time] > 0 && seen.at(-1).frame > 0, { message: 'a tick' });
    const last = seen.at(-1);
    t.equal(typeof last[time], 'number', 'time: milliseconds since the animation started');
    t.equal(typeof last[delta], 'number', 'delta: milliseconds since the previous tick');
    t.ok(last[time] > 0 && last[delta] > 0, 'both advance with the timer');
    t.ok(last[time] >= last[delta], 'and time is the sum of the deltas');
    await app.unmount();
    // a fixed frame set is what Spinner has: nothing in its output depends on time
    t.deepEqual((await framesOf(ui.Spinner, { type: 'line' })).frames.slice(0, 4), spinners.line.frames, 'while Spinner steps through the fixed frame list of its type');
  },
);

// ===================================================================== ProgressBar

s.fence(F, 1, {
  run: async (t, fence) => {
    const { mod } = await runFence(fence);
    const value = Number(fence.code.match(/value=\{(\d+)\}/)[1]);
    const app = await open(h(mod.Example), { columns: 20 });
    t.equal(app.screen(), '█'.repeat((20 * value) / 100) + '░'.repeat(20 - (20 * value) / 100), `value ${value} fills that share of the width`);
  },
});

const PROGRESS_PROPS = 'One prop: `value` (`number`, `0`–`100`; **required** in the types).';
s.types(F, [PROGRESS_PROPS], tsx`
import React from 'react';
import {ProgressBar} from '@inkjs/ui';
${EQ}
type Props = React.ComponentProps<typeof ProgressBar>;
export const onlyValue: Equal<keyof Props, 'value'> = true;
export const type: Equal<Props['value'], number> = true;
export const ok = <ProgressBar value={0} />;
export const full = <ProgressBar value={100} />;
export const missing = <ProgressBar />; //! TS2741
export const wrong = <ProgressBar value="50" />; //! TS2322
`, { ctx: ['required', '0', '100'] });
s.fact(F, [PROGRESS_PROPS], { kind: 'D', ctx: ['required'] }, async (t, q) => {
  const prop = q.tok('value');
  const [low, high] = [Number(q.tok('0')), Number(q.tok('100'))];
  t.equal(typeof high, q.tok('number'), 'a number');
  const width = 20;
  const bar = (value) => stripAnsi(render(h(ui.ProgressBar, { [prop]: value }), width));
  t.equal(bar(low), '░'.repeat(width), `${low} is an empty bar`);
  t.equal(bar(high), '█'.repeat(width), `${high} is a full bar`);
  for (const value of [10, 25, 50, 75]) t.equal(bar(value), '█'.repeat((width * value) / 100) + '░'.repeat(width - (width * value) / 100), `${value} fills ${value}% of the width`);
  t.equal(bar(low - 10), bar(low), 'a value below the range is an empty bar');
  t.equal(bar(high + 50), bar(high), 'a value above it is a full one');
});

s.fact(
  F,
  ["It's a controlled, presentational component only — track progress in your own state and pass it in; `ProgressBar` doesn't animate or advance on its own."],
  { kind: 'R' },
  async (t, q) => {
    const ProgressBar = q.api(ui, 'ProgressBar');
    const timers = stubTimers();
    const app = await open(h(ProgressBar, { value: 30 }), { columns: 20 });
    const first = app.bytes();
    for (let i = 0; i < 5; i++) await app.flush();
    const spinner = await open(h(ui.Spinner, { type: 'line' }), { columns: 20 });
    timers.restore();
    t.deepEqual(timers.intervals.length, 1, 'positive control: of the two components only the Spinner starts a repeating timer');
    t.equal(timers.intervals[0], spinners.line.interval);
    t.equal(app.bytes(), first, 'the bar writes nothing more while nothing changes');
    await app.rerender(h(ProgressBar, { value: 80 }));
    t.equal(stripAnsi(app.screen()), '█'.repeat(16) + '░'.repeat(4), 'it changes when the value it is passed changes');
    // the value comes from the parent's state
    const React = (await import('react')).default;
    let setValue;
    const Parent = () => {
      const [value, set] = React.useState(10);
      setValue = set;
      return h(ProgressBar, { value });
    };
    const owner = await open(h(Parent), { columns: 20 });
    t.equal(owner.screen(), '█'.repeat(2) + '░'.repeat(18));
    setValue(60);
    await owner.flush();
    t.equal(owner.screen(), '█'.repeat(12) + '░'.repeat(8), 'state kept by the parent drives it');
    await spinner.unmount();
  },
);

// ===================================================================== Badge

s.fact(F, ['A small inline tag.'], { kind: 'R' }, async (t) => {
  const solo = render(h(ui.Badge, null, 'ok'));
  t.equal(stripAnsi(solo).trimEnd(), ' OK', 'one line: the label with a space around it');
  const inline = stripAnsi(render(h(Text, null, 'Status: ', h(ui.Badge, null, 'ok'), ' done')));
  t.equal(inline, 'Status:  OK  done', 'and it sits inside a line of text');
});

s.fence(F, 2, {
  run: async (t, fence) => {
    const { mod } = await runFence(fence);
    const label = fence.code.match(/>([^<]+)<\/Badge>/)[1];
    const app = await open(h(mod.Example));
    t.equal(app.screen(), ` ${label.toUpperCase()}`, 'the label, upper-cased, with a space around it');
    t.ok(app.bytes().includes('\x1b[42m'), 'on a green background');
  },
});

const BADGE = "`children: ReactNode` (required; a string is shown upper-cased), `color?: TextProps['color']` (default `'magenta'`, used as the badge's background) — accepts the same color values as Ink's `<Text color>`.";
s.types(F, [BADGE], tsx`
import React, {type ReactNode} from 'react';
import {Text, type TextProps} from 'ink';
import {Badge} from '@inkjs/ui';
${EQ}
type Props = React.ComponentProps<typeof Badge>;
export const children: Equal<Pick<Props, 'children'>, {readonly children: ReactNode}> = true;
export const color: Equal<Pick<Props, 'color'>, {readonly color?: TextProps['color']}> = true;
export const fromText: TextProps['color'] = 'magenta';
export const anyNode = [<Badge>text</Badge>, <Badge>{1}</Badge>, <Badge><Text>x</Text></Badge>, <Badge>{null}</Badge>];
export const colors = [<Badge color="green">x</Badge>, <Badge color="#ff8800">x</Badge>, <Badge color="rgb(1, 2, 3)">x</Badge>];
export const missing = <Badge />; //! TS2741
export const wrong = <Badge color={1}>x</Badge>; //! TS2322
`, { ctx: ['<Text color>'] });
s.fact(F, [BADGE], { kind: 'D', ctx: ['children: ReactNode'] }, async (t, q) => {
  const prop = q.tok("color?: TextProps['color']").match(/^(\w+)\?/)[1];
  const dflt = q.tok("'magenta'").replace(/'/g, '');
  const [textName, textProp] = q.tok('<Text color>').slice(1, -1).split(' ');
  const Text = ink[textName];
  t.equal(typeof Text, 'function', `${textName} is a component of Ink`);
  // the opening code of a foreground color, turned into the background code of the same color
  const asBackground = (code) => code.replace(/^\x1b\[38;/, '\x1b[48;').replace(/^\x1b\[3(\d)m/, '\x1b[4$1m').replace(/^\x1b\[9(\d)m/, '\x1b[10$1m');
  const foreground = (value) => SGR_OPEN(render(h(Text, { [textProp]: value }, 'x')));
  const badge = (props, children = 'ok') => render(h(ui.Badge, props, children));
  t.equal(stripAnsi(badge({}, 'Passing')).trim(), 'PASSING', 'a string child is shown upper-cased');
  t.equal(stripAnsi(render(h(ui.Badge, null, h(Text, null, 'Passing')))).trim(), 'Passing', 'while an element child is left as it is');
  t.equal(badge({}), badge({ [prop]: dflt }), 'with no color the badge is magenta');
  t.notEqual(badge({}), badge({ [prop]: 'green' }), 'positive control: another color gives another badge');
  t.ok(badge({}).startsWith(asBackground(foreground(dflt))), 'and that color is the badge background');
  t.ok(badge({}).includes('\x1b[30mOK'), 'with a black label on it');
  for (const value of ['green', 'redBright', '#ff8800', 'rgb(1, 2, 3)', 'ansi256(200)']) {
    t.notEqual(foreground(value), '', `${value} is a color for <${textName} ${textProp}>`);
    t.ok(badge({ [prop]: value }).startsWith(asBackground(foreground(value))), `${value} is accepted as the badge color: it paints the same color as a background`);
  }
});

// ===================================================================== StatusMessage

s.fence(F, 3, {
  run: async (t, fence) => {
    const { mod } = await runFence(fence);
    const message = fence.code.match(/>([^<]+)<\/StatusMessage>/)[1];
    const app = await open(h(mod.Example));
    t.match(app.screen(), new RegExp(`^\\S ${message}$`), 'a symbol, then the message, on one line');
    t.ok(app.bytes().includes('\x1b[32m'), 'success is green');
  },
});

s.fact(
  F,
  ['A message for one line of text, prefixed with a variant-colored symbol (longer text wraps, aligned after the symbol).'],
  { kind: 'R' },
  async (t) => {
    const seen = new Map();
    for (const variant of VARIANTS) {
      const out = render(h(ui.StatusMessage, { variant }, 'Message'));
      t.equal(out.split('\n').length, 1, `${variant}: a short message is one line`);
      const [, symbol] = stripAnsi(out).match(/^(\S) Message$/);
      const color = out.match(SGR_OPEN_RE)[0];
      seen.set(variant, { symbol, color });
      t.ok(out.startsWith(color + symbol), `${variant}: the symbol is the colored part`);
    }
    t.equal(new Set([...seen.values()].map((v) => v.symbol)).size, 4, 'each variant has its own symbol');
    t.equal(new Set([...seen.values()].map((v) => v.color)).size, 4, 'and its own color');
    const long = 'This message is longer than the width of the box so it must wrap onto several lines.';
    const wrapped = stripAnsi(render(h(ui.StatusMessage, { variant: 'info' }, long), 30)).split('\n');
    t.ok(wrapped.length > 1, 'longer text wraps');
    t.ok(wrapped.slice(1).every((line) => line.startsWith('  ') && !line.startsWith('   ')), 'with the continuation lines aligned under the start of the text, after the symbol');
  },
);
const SGR_OPEN_RE = /\x1b\[\d+m/;

const VARIANT_TOKEN = "`variant: 'info' | 'success' | 'error' | 'warning'` is **required** — there's no default: without one, no symbol is drawn.";
s.types(F, [VARIANT_TOKEN], tsx`
import React from 'react';
import {StatusMessage} from '@inkjs/ui';
${EQ}
type Props = React.ComponentProps<typeof StatusMessage>;
export const variant: Equal<Pick<Props, 'variant'>, {readonly variant: 'info' | 'success' | 'error' | 'warning'}> = true;
export const ok = <StatusMessage variant="success">x</StatusMessage>;
export const missing = <StatusMessage>x</StatusMessage>; //! TS2741
export const wrong = <StatusMessage variant="debug">x</StatusMessage>; //! TS2322
`, { ctx: ['required'] });
s.fact(F, [VARIANT_TOKEN], { kind: 'D', ctx: ['required'] }, async (t, q) => {
  const [prop, union] = q.tok("variant: 'info' | 'success' | 'error' | 'warning'").split(': ');
  const variants = union.split(' | ').map((member) => member.replace(/'/g, ''));
  t.deepEqual([...variants].sort(), [...VARIANTS].sort(), 'four variants');
  const symbols = variants.map((variant) => stripAnsi(render(h(ui.StatusMessage, { [prop]: variant }, 'x'))));
  t.ok(symbols.every((out) => /^\S x$/.test(out)), 'each draws a symbol before the message');
  t.equal(new Set(symbols).size, variants.length, 'a different one for each');
  const bare = stripAnsi(render(h(ui.StatusMessage, {}, 'x'))).trim();
  t.equal(bare, 'x', 'without a variant nothing but the message is drawn');
  t.ok(!/\x1b\[3\dm/.test(render(h(ui.StatusMessage, {}, 'x'))), 'and no variant color is applied');
});

// ===================================================================== Alert

s.fence(F, 4, {
  run: async (t, fence) => {
    const { mod } = await runFence(fence);
    const title = attr(fence, 'title');
    const message = fence.code.match(/>\s*([^<\n]+?)\s*<\/Alert>/)[1];
    const app = await open(h(mod.Example), { columns: 50 });
    const out = lines(app);
    t.ok(out[0].startsWith('╭') && out[0].endsWith('╮') && out.at(-1).startsWith('╰'), 'the content sits in a rounded box');
    t.match(out[1], new RegExp(`│ \\S ${title}\\s+│`), 'the symbol and the title come first');
    t.match(out[3], new RegExp(`│\\s+${message}\\s+│`), 'then the message, below the title');
    t.ok(app.bytes().includes('\x1b[31m'), 'an error is red');
  },
});

const ALERT_INTRO = 'A boxed, multi-line message — reach for `Alert` over `StatusMessage` when the content is more than one line or needs a title.';
s.fact(F, [ALERT_INTRO], { kind: 'R' }, async (t, q) => {
  const [Alert, StatusMessage] = [q.api(ui, 'Alert'), q.api(ui, 'StatusMessage')];
  const long = 'This message is longer than the width of the box so it must wrap onto several lines.';
  const box = stripAnsi(render(h(Alert, { variant: 'info' }, long), 30)).split('\n');
  t.ok(box[0].startsWith('╭') && box.at(-1).startsWith('╰'), 'Alert draws a box around its content');
  t.ok(box.length > 4, 'and long text wraps onto several lines inside it');
  t.ok(box.slice(1, -1).every((line) => line.startsWith('│') && line.endsWith('│')), 'every line stays inside the box');
  const titled = stripAnsi(render(h(Alert, { variant: 'info', title: 'Heads up' }, 'Body'), 30)).split('\n');
  t.match(titled[1], /Heads up/, 'a title goes above the message');
  t.match(titled[3], /Body/);
  const status = stripAnsi(render(h(StatusMessage, { variant: 'info' }, long), 30));
  t.ok(!/[╭│╰]/.test(status), 'StatusMessage draws no box around the same text');
});
s.types(F, [ALERT_INTRO], tsx`
import React from 'react';
import {Alert, StatusMessage} from '@inkjs/ui';

export const titled = <Alert variant="info" title="Heads up">x</Alert>;
export const noTitle = <StatusMessage variant="info" title="Heads up">x</StatusMessage>; //! TS2322
`);
s.guidance(F, ['reach for `Alert` over `StatusMessage` when the content is more than one line or needs a title.'], 'a recommendation about which component to choose; what each one can do (a box, a title, wrapping) is proven by the claim on the sentence it belongs to', { exempt: ['Alert', 'StatusMessage'] });

const ALERT_PROPS = '`variant` is the same union as `StatusMessage` (required); `title?: string` is optional.';
s.types(F, [ALERT_PROPS], tsx`
import React from 'react';
import {Alert, StatusMessage} from '@inkjs/ui';
${EQ}
type AlertProps = React.ComponentProps<typeof Alert>;
type StatusProps = React.ComponentProps<typeof StatusMessage>;
export const sameUnion: Equal<AlertProps['variant'], StatusProps['variant']> = true;
export const title: Equal<Pick<AlertProps, 'title'>, {readonly title?: string}> = true;
export const required: Equal<{} extends Pick<AlertProps, 'variant'> ? true : false, false> = true;
export const ok = [<Alert variant="info">x</Alert>, <Alert variant="warning" title="t">x</Alert>];
export const missing = <Alert>x</Alert>; //! TS2741
export const wrong = <Alert variant="debug">x</Alert>; //! TS2322
`, { ctx: ['variant'] });
s.fact(F, [ALERT_PROPS], { kind: 'D' }, async (t, q) => {
  const StatusMessage = q.api(ui, 'StatusMessage');
  const prop = q.tok('variant');
  const title = q.tok('title?: string').split('?')[0];
  for (const variant of VARIANTS) {
    const alert = render(h(ui.Alert, { [prop]: variant }, 'x'), 20);
    const status = render(h(StatusMessage, { [prop]: variant }, 'x'));
    const symbol = stripAnsi(status).match(/^(\S) x$/)[1];
    t.ok(stripAnsi(alert).includes(`│ ${symbol} x`), `${variant}: the symbol is the one StatusMessage draws`);
    t.ok(alert.includes(status.match(SGR_OPEN_RE)[0]), `${variant}: in the same color`);
  }
  t.equal(stripAnsi(render(h(ui.Alert, {}, 'x'), 20)).includes('x'), true, 'without a variant it still renders text (the types are what require it)');
  const plain = stripAnsi(render(h(ui.Alert, { [prop]: 'info' }, 'Body'), 20)).split('\n');
  const titled = stripAnsi(render(h(ui.Alert, { [prop]: 'info', [title]: 'Title' }, 'Body'), 20)).split('\n');
  t.equal(plain.length, 3, 'with no title the message is the only content row');
  t.equal(titled.length, 5, 'a title adds a row for itself and a blank one');
  t.match(titled[1], /Title/);
});

// ===================================================================== Choosing between them

s.fact(F, ['"still working" indicator | `Spinner`'], { kind: 'R', ctx: ['still working'] }, async (t, q) => {
  const Spinner = q.api(ui, 'Spinner');
  const { frames } = await framesOf(Spinner, { type: 'line' });
  const cycle = spinners.line.frames;
  t.deepEqual(frames.slice(0, cycle.length), cycle, 'a Spinner changes by itself as time passes');
  t.equal(frames[cycle.length], frames[0], 'and keeps going: after the last frame it starts over, with no end');
  t.equal(frames.length > cycle.length, true);
});
s.types(F, ['"still working" indicator | `Spinner`'], tsx`
import React from 'react';
import {Spinner} from '@inkjs/ui';

export const ok = <Spinner />;
export const noProgress = <Spinner value={50} />; //! TS2322
`, { ctx: ['still working'] });

s.fact(F, ['Quantified progress (0–100%) | `ProgressBar`'], { kind: 'R' }, async (t, q) => {
  const ProgressBar = q.api(ui, 'ProgressBar');
  const [low, high] = q.tok('0–100%').replace('%', '').split('–').map(Number);
  const bar = (value) => stripAnsi(render(h(ProgressBar, { value }), 100));
  t.equal(bar(low), '░'.repeat(100), `${low}% is empty`);
  t.equal(bar(high), '█'.repeat(100), `${high}% is full`);
  for (const percent of [1, 33, 50, 99]) t.equal(bar(percent), '█'.repeat(percent) + '░'.repeat(100 - percent), `${percent}% fills ${percent} of 100 cells`);
});

s.fact(F, ['A short inline tag/label | `Badge`'], { kind: 'R' }, async (t, q) => {
  const Badge = q.api(ui, 'Badge');
  t.equal(stripAnsi(render(h(Text, null, 'build ', h(Badge, null, 'ok')))).trimEnd(), 'build  OK', 'a Badge is a padded label that sits inside a line of text');
  t.equal(render(h(Badge, null, 'ok')).split('\n').length, 1, 'on one line');
  t.ok(render(h(Badge, { color: 'green' }, 'ok')).includes('\x1b[42m'), 'with a colored background');
});

s.fact(F, ['One line of pass/fail/warn/info feedback | `StatusMessage`'], { kind: 'R' }, async (t, q) => {
  const StatusMessage = q.api(ui, 'StatusMessage');
  const kinds = { pass: 'success', fail: 'error', warn: 'warning', info: 'info' };
  const out = Object.entries(kinds).map(([, variant]) => render(h(StatusMessage, { variant }, 'done')));
  t.ok(out.every((line) => line.split('\n').length === 1), 'each kind is one line');
  t.equal(new Set(out.map((line) => stripAnsi(line))).size, 4, 'and they look different from one another');
});

s.fact(F, ['A boxed, possibly multi-line message, optionally titled | `Alert`'], { kind: 'R' }, async (t, q) => {
  const Alert = q.api(ui, 'Alert');
  const plain = stripAnsi(render(h(Alert, { variant: 'info' }, 'one\ntwo'), 20)).split('\n');
  t.deepEqual(plain.map((line) => line[0]), ['╭', '│', '│', '╰'], 'a box around a message that spans two lines');
  t.match(plain[2], /two/);
  const titled = stripAnsi(render(h(Alert, { variant: 'info', title: 'Title' }, 'one'), 20)).split('\n');
  t.match(titled[1], /Title/, 'and a title when one is given');
  t.equal(plain.some((line) => line.includes('Title')), false, 'but only then');
});

s.fact(F, ["A list of completed steps that shouldn't re-render | `<Static>` (`ink-static-output`)"], { kind: 'R' }, async (t, q) => {
  const Static = q.el(ink, '<Static>');
  t.ok(skillText(q.tok('ink-static-output')).includes('<Static>'), 'the skill it points to covers <Static>');
  const React = (await import('react')).default;
  const Steps = ({ n, kept }) =>
    h(Box, { flexDirection: 'column' }, kept ? h(Static, { items: ['step one', 'step two'] }, (item) => h(Text, { key: item }, item)) : h(Text, null, 'step one\nstep two'), h(Text, null, `tick ${n}`));
  const writes = async (kept) => {
    const app = await open(h(Steps, { n: 0, kept }));
    for (const n of [1, 2, 3]) await app.rerender(h(Steps, { n, kept }));
    return app.bytes();
  };
  const count = (bytes, text) => bytes.split(text).length - 1;
  t.equal(count(await writes(true), 'step one'), 1, 'items inside <Static> are written once, however often the rest re-renders');
  t.equal(count(await writes(false), 'step one'), 4, 'positive control: the same text outside <Static> is repainted with every update');
});

s.fact(F, ['A list of steps whose status changes in place | `ink-task-list` (`ink-task-runners`)'], { kind: 'R' }, async (t, q) => {
  const { TaskList, Task } = await import(q.tok('ink-task-list'));
  t.ok(skillText(q.tok('ink-task-runners')).includes('ink-task-list'), 'the skill it points to covers the package');
  const { packages } = await loadEcosystem();
  t.equal(packages.find((p) => p.name === 'ink-task-list').status, 'works', 'the package works on this Ink');
  const tree = (state) => h(TaskList, null, h(Task, { label: 'Build', state, spinner: spinners.dots }), h(Task, { label: 'Test', state: 'pending' }));
  const app = await open(tree('loading'));
  t.deepEqual(lines(app), [`${spinners.dots.frames[0]} Build`, '◼ Test']);
  await app.rerender(tree('success'));
  t.deepEqual(lines(app), ['✔ Build', '◼ Test'], 'a step changes state on the line it already occupies');
});
