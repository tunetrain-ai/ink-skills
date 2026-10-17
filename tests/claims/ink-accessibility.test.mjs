// Claims for skills/core/ink-accessibility/SKILL.md.
import { skill, tsx, h, ink, mount, stripAnsi, packageDir } from '../lib/index.mjs';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { allSkillFiles } from '../lib/claims.mjs';
import { runFenceForwarding, skillText } from './ink-input-handling.helpers.mjs';
import { declaredRoles, declaredStates, frame, withEnv } from './ink-accessibility.helpers.mjs';

const { Box, Text } = ink;
const s = skill('ink-accessibility');
const F = 'SKILL.md';

const evaluate = (expression, vars = {}) => new Function(...Object.keys(vars), `return (${expression})`)(...Object.values(vars));
/** `{isScreenReaderEnabled: true}` out of the notation `isScreenReaderEnabled: true`. */
const optionsOf = (notation) => evaluate(`{${notation}}`);
const spoken = (element) => frame(element, { screenReader: true });
const seen = (element) => frame(element, { screenReader: false });
const box = (props, ...children) => h(Box, props, ...children);
const text = (props, ...children) => h(Text, props, ...children);
/** A tree for every prop: the same text, with the props on a <Box> or on a <Text>. */
const onBox = (props) => box(props, text(null, 'inner'));
const onText = (props) => text(props, 'inner');

// ===================================================================== description

s.fact(
  F,
  ['Make an Ink UI screen-reader friendly — enable screen reader support (isScreenReaderEnabled / INK_SCREEN_READER env var), detect it at runtime with useIsScreenReaderEnabled, and use aria-label/aria-hidden (on <Box> and <Text>) and aria-role/aria-state (on <Box> only) to give elements semantic meaning.'],
  { kind: 'R' },
  async (t) => {
    const element = box({ 'aria-role': 'checkbox', 'aria-state': { checked: true } }, text(null, 'Accept'));
    t.equal(await seen(element), 'Accept', 'without screen reader support the props change nothing');
    t.equal(await spoken(element), 'checkbox: (checked) Accept', 'with the isScreenReaderEnabled option they give the element a role and a state');
    t.equal(await withEnv('INK_SCREEN_READER', 'true', () => frame(element, { screenReader: null })), 'checkbox: (checked) Accept', 'the INK_SCREEN_READER environment variable enables it too');
    const Detect = () => h(Text, null, ink.useIsScreenReaderEnabled() ? 'on' : 'off');
    t.equal(await spoken(h(Detect)), 'on', 'useIsScreenReaderEnabled reports it');
    t.equal(await seen(h(Detect)), 'off');
    t.equal(await spoken(onBox({ 'aria-label': 'label' })), 'label', 'aria-label on a Box');
    t.equal(await spoken(onText({ 'aria-label': 'label' })), 'label', 'aria-label on a Text');
    t.equal(await spoken(box(null, onBox({ 'aria-hidden': true }), text(null, 'kept'))), 'kept', 'aria-hidden on a Box');
    t.equal(await spoken(box(null, onText({ 'aria-hidden': true }), text(null, 'kept'))), 'kept', 'aria-hidden on a Text');
    t.equal(await spoken(onText({ 'aria-role': 'button', 'aria-state': { checked: true } })), 'inner', 'aria-role and aria-state do nothing on a Text');
  },
);

s.guidance(F, ['Use when the user asks about accessibility, screen readers, or ARIA in a terminal app.'], 'a trigger for when to load the skill; what it teaches is proven by the other claims');

// ===================================================================== overview

s.fact(
  F,
  ['Ink supports screen readers through ARIA-style props (`aria-label`, `aria-hidden`, `aria-role`, `aria-state`) and the `useIsScreenReaderEnabled` hook.'],
  { kind: 'R' },
  async (t, q) => {
    const [label, hidden, role, state] = ['aria-label', 'aria-hidden', 'aria-role', 'aria-state'].map((name) => q.tok(name));
    const useIsScreenReaderEnabled = q.api(ink, 'useIsScreenReaderEnabled');
    t.equal(await spoken(onBox({ [label]: 'Label' })), 'Label', 'aria-label replaces the text');
    t.equal(await spoken(box(null, onBox({ [hidden]: true }), text(null, 'kept'))), 'kept', 'aria-hidden removes the element');
    t.equal(await spoken(onBox({ [role]: 'button' })), 'button: inner', 'aria-role names the role');
    t.equal(await spoken(onBox({ [state]: { checked: true } })), '(checked) inner', 'aria-state names the state');
    const Detect = () => h(Text, null, useIsScreenReaderEnabled() ? 'on' : 'off');
    t.equal(await spoken(h(Detect)), 'on');
    t.equal(await seen(h(Detect)), 'off', 'the hook tells screen reader mode from the normal one');
  },
);

// ===================================================================== enabling

s.fact(
  F,
  ['Either pass `isScreenReaderEnabled: true` to `render()`, or set the `INK_SCREEN_READER` environment variable to `true` — useful for enabling it without touching render call sites, e.g. in a launcher script.'],
  { kind: 'R' },
  async (t, q) => {
    q.api(ink, 'render()');
    const element = onBox({ 'aria-role': 'button' });
    const off = 'inner';
    const on = 'button: inner';
    t.equal(await seen(element), off, 'baseline: the role is not spoken');
    // the render option
    const option = optionsOf(q.tok('isScreenReaderEnabled: true'));
    const app = mount(element, { debug: true, render: option });
    await app.flush();
    t.equal(app.stdout.writes.filter(Boolean).at(-1), on, 'passed to render() it enables screen reader mode');
    await app.unmount();
    // the environment variable, without any option in the render call
    const name = q.tok('INK_SCREEN_READER');
    const value = q.tok('true');
    t.equal(await withEnv(name, value, () => frame(element, { screenReader: null })), on, 'set to true it enables it with no option at all');
    t.equal(await withEnv(name, undefined, () => frame(element, { screenReader: null })), off, 'unset it does not');
    t.equal(await withEnv(name, `${value}x`, () => frame(element, { screenReader: null })), off, 'and only the value true counts');
  },
);

s.fence(F, 0, {
  run: async (t) => {
    const { apps, renderOptions } = await runFenceForwarding(s, F, 0);
    t.equal(apps.length, 1);
    await apps[0].flush();
    t.deepEqual(renderOptions, [{ isScreenReaderEnabled: true }], 'the fence passes the option');
    const reference = async (isScreenReaderEnabled) => {
      const app = mount(h(Text, null, 'Hello'), { render: { isScreenReaderEnabled } });
      await app.flush();
      const bytes = app.bytes();
      await app.unmount();
      return bytes;
    };
    t.equal(apps[0].bytes(), await reference(true), 'the fence writes what screen reader mode writes');
    t.notEqual(apps[0].bytes(), await reference(false), 'which is not what normal mode writes');
    t.ok(stripAnsi(apps[0].bytes()).includes('Hello'), 'the app says Hello');
  },
});

// ===================================================================== the hook

s.fact(F, ['Detect it at runtime to branch your own render output — not just rely on ARIA props:'], { kind: 'R' }, async (t) => {
  const Branch = () => (ink.useIsScreenReaderEnabled() ? h(Text, null, 'read this') : h(Box, { borderStyle: 'round' }, h(Text, null, 'look at this')));
  const normal = await seen(h(Branch));
  const reader = await spoken(h(Branch));
  t.equal(reader, 'read this', 'a component can render something else for a screen reader');
  t.ok(normal.includes('look at this') && normal.includes('╭'), 'than it draws otherwise');
});

s.fence(F, 1, {
  run: async (t) => {
    const { mod } = await s.runFence(F, 1);
    t.equal(await spoken(h(mod.Example)), 'Screen reader is enabled', 'with screen reader support on');
    t.equal(await seen(h(mod.Example)), 'Screen reader is disabled', 'and off');
  },
});

// ===================================================================== ARIA props

s.fact(
  F,
  [
    "`aria-label` and `aria-hidden` work on both `<Box>` and `<Text>`; `aria-role` and `aria-state` are `<Box>`-only — `<Text>` silently ignores them, and TypeScript won't flag it (hyphenated JSX attributes skip excess-property checks).",
  ],
  { kind: 'R' },
  async (t, q) => {
    const [label, hidden, role, state] = ['aria-label', 'aria-hidden', 'aria-role', 'aria-state'].map((name) => q.tok(name));
    const [Box_, Text_] = [q.el(ink, '<Box>'), q.el(ink, '<Text>')];
    const as = (Component, props, ...children) => h(Component, props, ...children);
    for (const [name, Component] of [['Box', Box_], ['Text', Text_]]) {
      t.equal(await spoken(as(Component, { [label]: 'Label' }, name === 'Box' ? text(null, 'inner') : 'inner')), 'Label', `aria-label works on a ${name}`);
      const row = box(null, as(Component, { [hidden]: true }, name === 'Box' ? text(null, 'gone') : 'gone'), text(null, 'kept'));
      t.equal(await spoken(row), 'kept', `aria-hidden works on a ${name}`);
    }
    t.equal(await spoken(as(Box_, { [role]: 'button', [state]: { checked: true } }, text(null, 'inner'))), 'button: (checked) inner', 'aria-role and aria-state work on a Box');
    const plain = await spoken(as(Text_, null, 'inner'));
    const ignored = await spoken(as(Text_, { [role]: 'button', [state]: { checked: true } }, 'inner'));
    t.equal(ignored, plain, 'a Text silently ignores them: no error and the same output');
    t.equal(plain, 'inner');
  },
);

s.types(
  F,
  [
    "`aria-label` and `aria-hidden` work on both `<Box>` and `<Text>`; `aria-role` and `aria-state` are `<Box>`-only — `<Text>` silently ignores them, and TypeScript won't flag it (hyphenated JSX attributes skip excess-property checks).",
  ],
  tsx`
import React from 'react';
import {Box, Text} from 'ink';

export const boxLabel = <Box aria-label="x" aria-hidden aria-role="button" aria-state={{checked: true}} />;
export const textLabel = <Text aria-label="x" aria-hidden>x</Text>;
// TypeScript accepts the Box-only props on a Text: hyphenated attributes skip excess-property checks
export const textRole = <Text aria-role="button">x</Text>;
export const textState = <Text aria-state={{checked: true}}>x</Text>;
export const anyHyphenated = <Text aria-unknown="x">x</Text>;
// a prop without a hyphen is checked
export const unknown = <Text unknown="x">x</Text>; //! TS2322
`,
  { ctx: ['<Box>', '<Text>', 'aria-label', 'aria-hidden', 'aria-role', 'aria-state'] },
);

s.fact(F, ['All four only change output while screen reader support is enabled.'], { kind: 'R' }, async (t) => {
  const variants = {
    'aria-label': onBox({ 'aria-label': 'Label' }),
    'aria-hidden': box(null, onBox({ 'aria-hidden': true }), text(null, 'kept')),
    'aria-role': onBox({ 'aria-role': 'button' }),
    'aria-state': onBox({ 'aria-state': { checked: true, busy: true } }),
  };
  const bare = {
    'aria-label': onBox({}),
    'aria-hidden': box(null, onBox({}), text(null, 'kept')),
    'aria-role': onBox({}),
    'aria-state': onBox({}),
  };
  for (const name of Object.keys(variants)) {
    t.equal(await seen(variants[name]), await seen(bare[name]), `${name}: normal output is the same with and without the prop`);
    t.notEqual(await spoken(variants[name]), await spoken(bare[name]), `${name}: positive control: screen reader output is not`);
  }
});

s.fact(
  F,
  ["| `aria-label` | `<Box>`, `<Text>` | `string` | Overrides what's read for this element — use when the visible text alone isn't descriptive enough. |"],
  { kind: 'R' },
  async (t, q) => {
    const label = q.tok('aria-label');
    const [Box_, Text_] = [q.el(ink, '<Box>'), q.el(ink, '<Text>')];
    const value = 'a longer description';
    t.equal(typeof value, q.tok('string'), 'the label is a string');
    t.equal(await spoken(h(Box_, { [label]: value }, text(null, 'x'))), value, 'on a Box what is read is the label, not the visible text');
    t.equal(await spoken(h(Text_, { [label]: value }, 'x')), value, 'on a Text too');
    t.equal(await seen(h(Text_, { [label]: value }, 'x')), 'x', 'positive control: the visible text is what is drawn');
    t.equal(await spoken(h(Box_, { [label]: value }, text(null, 'x'), text(null, 'y'))), value, 'the label stands in for all the children of a Box');
  },
);

s.types(
  F,
  ["| `aria-label` | `<Box>`, `<Text>` | `string` | Overrides what's read for this element — use when the visible text alone isn't descriptive enough. |"],
  tsx`
import React from 'react';
import {Box, Text} from 'ink';

export const box = <Box aria-label="x" />;
export const text = <Text aria-label="x">x</Text>;
export const badBox = <Box aria-label={5} />; //! TS2322
export const badText = <Text aria-label={5}>x</Text>; //! TS2322
`,
  { ctx: ['aria-label', '<Box>', '<Text>', 'string'] },
);

s.fact(
  F,
  ['| `aria-hidden` | `<Box>`, `<Text>` | `boolean` (default `false`) | Removes the element from the screen-reader tree entirely. |'],
  { kind: 'D' },
  async (t, q) => {
    const hidden = q.tok('aria-hidden');
    const [Box_, Text_] = [q.el(ink, '<Box>'), q.el(ink, '<Text>')];
    const dflt = JSON.parse(q.tok('false'));
    t.equal(typeof dflt, q.tok('boolean'), 'the default is a boolean');
    const around = (element) => box({ flexDirection: 'column' }, text(null, 'before'), element, text(null, 'after'));
    const targets = { Box: (props) => h(Box_, props, text(null, 'target')), Text: (props) => h(Text_, props, 'target') };
    for (const [name, make] of Object.entries(targets)) {
      t.equal(await spoken(around(make({ [hidden]: true }))), 'before\nafter', `${name}: hidden is gone from the screen reader output`);
      t.equal(await spoken(around(make({ [hidden]: !true }))), 'before\ntarget\nafter', `${name}: false keeps it`);
      t.equal(await spoken(around(make({}))), await spoken(around(make({ [hidden]: dflt }))), `${name}: leaving it out is the same as false`);
      t.equal(await seen(around(make({ [hidden]: true }))), await seen(around(make({}))), `${name}: and the normal output is untouched`);
    }
    const tree = around(h(Box_, { [hidden]: true }, text(null, 'deep'), box(null, text(null, 'deeper'))));
    t.equal(await spoken(tree), 'before\nafter', 'a hidden element takes its whole subtree with it');
  },
);

s.types(
  F,
  ['| `aria-hidden` | `<Box>`, `<Text>` | `boolean` (default `false`) | Removes the element from the screen-reader tree entirely. |'],
  tsx`
import React from 'react';
import {Box, Text} from 'ink';

export const box = <Box aria-hidden={true} />;
export const text = <Text aria-hidden={false}>x</Text>;
export const badBox = <Box aria-hidden="yes" />; //! TS2322
export const badText = <Text aria-hidden="yes">x</Text>; //! TS2322
`,
  { ctx: ['aria-hidden', '<Box>', '<Text>', 'boolean', 'false'] },
);

const ROLE_ROW =
  "| `aria-role` | `<Box>` | one of the roles listed | Spoken before the element's text, unless the parent `<Box>` has the same role. One of: `button`, `checkbox`, `combobox`, `list`, `listbox`, `listitem`, `menu`, `menuitem`, `option`, `progressbar`, `radio`, `radiogroup`, `tab`, `tablist`, `table`, `textbox`, `timer`, `toolbar`. |";
const ROLES = ROLE_ROW.split('One of: ')[1].split(', ').map((role) => role.replace(/[`.|]/g, '').trim());

s.fact(F, [ROLE_ROW], { kind: 'D' }, async (t, q) => {
  const prop = q.tok('aria-role');
  const [Box_] = [q.el(ink, '<Box>')];
  const roles = ROLES.map((role) => q.tok(role));
  t.deepEqual([...roles].sort(), [...declaredRoles()].sort(), 'these are exactly the roles Ink allows');
  for (const role of roles) t.equal(await spoken(h(Box_, { [prop]: role }, text(null, 'x'))), `${role}: x`, `${role} is spoken before the text`);
  t.equal(await seen(h(Box_, { [prop]: 'button' }, text(null, 'x'))), 'x', 'positive control: only screen reader output has it');
  // a child with the same role as its parent does not repeat it; a different role does
  const nested = (outer, inner) => h(Box_, { [prop]: outer }, h(Box_, { [prop]: inner }, text(null, 'x')));
  t.equal(await spoken(nested('list', 'list')), 'list: x', 'the parent has the same role: not repeated');
  t.equal(await spoken(nested('list', 'listitem')), 'list: listitem: x', 'a different role is spoken');
  const parent = q.tok('<Box>');
  t.equal(parent, '<Box>');
});

s.types(
  F,
  [ROLE_ROW],
  tsx`
import React from 'react';
import {Box} from 'ink';

export const a = <Box aria-role="button" />;
export const b = <Box aria-role="checkbox" />;
export const c = <Box aria-role="combobox" />;
export const d = <Box aria-role="list" />;
export const e = <Box aria-role="listbox" />;
export const f = <Box aria-role="listitem" />;
export const g = <Box aria-role="menu" />;
export const h = <Box aria-role="menuitem" />;
export const i = <Box aria-role="option" />;
export const j = <Box aria-role="progressbar" />;
export const k = <Box aria-role="radio" />;
export const l = <Box aria-role="radiogroup" />;
export const m = <Box aria-role="tab" />;
export const n = <Box aria-role="tablist" />;
export const o = <Box aria-role="table" />;
export const p = <Box aria-role="textbox" />;
export const q = <Box aria-role="timer" />;
export const r = <Box aria-role="toolbar" />;
export const unknown = <Box aria-role="banner" />; //! TS2322
const anyString: string = 'button';
export const notEvery = <Box aria-role={anyString} />; //! TS2322
`,
  { ctx: ['aria-role', '<Box>', ...ROLES] },
);

const STATE_ROW = '| `aria-state` | `<Box>` | `object` | Any of `busy`, `checked`, `disabled`, `expanded`, `multiline`, `multiselectable`, `readonly`, `required`, `selected` (all `boolean`). |';
const STATES = STATE_ROW.split('Any of ')[1].split(' (all')[0].split(', ').map((state) => state.replace(/`/g, ''));

s.fact(F, [STATE_ROW], { kind: 'D' }, async (t, q) => {
  const prop = q.tok('aria-state');
  const Box_ = q.el(ink, '<Box>');
  const states = STATES.map((state) => q.tok(state));
  t.deepEqual([...states].sort(), [...declaredStates()].sort(), 'these are exactly the states Ink allows');
  const flag = JSON.parse('true');
  t.equal(typeof flag, q.tok('boolean'), 'each state is a boolean');
  t.equal(typeof { [states[0]]: flag }, q.tok('object'), 'and aria-state is an object of them');
  for (const state of states) {
    t.equal(await spoken(h(Box_, { [prop]: { [state]: true } }, text(null, 'x'))), `(${state}) x`, `${state}: true is spoken in parentheses`);
    t.equal(await spoken(h(Box_, { [prop]: { [state]: false } }, text(null, 'x'))), 'x', `${state}: false is not spoken`);
  }
  t.equal(await spoken(h(Box_, { [prop]: { checked: true, disabled: true, busy: false } }, text(null, 'x'))), '(checked, disabled) x', 'several states are listed together');
  t.equal(await seen(h(Box_, { [prop]: { checked: true } }, text(null, 'x'))), 'x', 'positive control: only screen reader output has them');
});

s.types(
  F,
  [STATE_ROW],
  tsx`
import React from 'react';
import {Box} from 'ink';

export const all = (
  <Box aria-state={{busy: true, checked: true, disabled: true, expanded: true, multiline: true, multiselectable: true, readonly: true, required: true, selected: true}} />
);
export const none = <Box aria-state={{}} />;
export const notAnObject = <Box aria-state={5} />; //! TS2326
export const notBoolean = <Box aria-state={{checked: 'yes'}} />; //! TS2322
export const unknown = <Box aria-state={{pressed: true}} />; //! TS2326
`,
  { ctx: ['aria-state', '<Box>', 'object', ...STATES, 'boolean'] },
);

// ---- the two worked examples --------------------------------------------------------------

s.fence(F, 2, {
  run: async (t) => {
    const { mod } = await s.runFence(F, 2);
    t.equal(await spoken(h(mod.Checkbox)), 'checkbox: (checked) Accept terms and conditions', 'the checkbox is spoken as a checked checkbox');
    t.equal(await seen(h(mod.Checkbox)), 'Accept terms and conditions', 'and drawn as its text');
  },
});

s.fact(F, ['// screen reader reads: "checkbox: (checked) Accept terms and conditions"'], { kind: 'R' }, async (t, q) => {
  const { mod } = await s.runFence(F, 2);
  t.equal(await spoken(h(mod.Checkbox)), q.tok('checkbox: (checked) Accept terms and conditions'), 'this is what the screen reader reads');
});

s.fact(
  F,
  ['`aria-label` replaces an element\'s text with a fuller spoken description — for example a progress bar rendered as colored blocks with just "50%" as text:'],
  { kind: 'R' },
  async (t, q) => {
    const label = q.tok('aria-label');
    const visible = q.tok('50%');
    t.match(visible, /^\d{1,3}%$/, 'the visible text is just a percentage');
    const description = `Progress: ${visible}`;
    const bar = h(Box, null, h(Box, { width: '50%', height: 1, backgroundColor: 'green' }), h(Text, { [label]: description }, visible));
    t.equal(await spoken(bar), description, 'the description is what is read: the visible text is replaced, and the colored block says nothing');
    t.ok(stripAnsi(await seen(bar)).includes(visible), 'while the visible text is what is drawn');
    t.ok(!(await seen(bar)).includes('Progress'), 'and the description is not drawn');
  },
);

s.fence(F, 3, {
  run: async (t) => {
    const { mod } = await s.runFence(F, 3);
    t.equal(await spoken(h(mod.Progress)), 'Progress: 50%', 'the description is read');
    t.ok(stripAnsi(await seen(h(mod.Progress))).trimEnd().endsWith('50%'), 'and 50% is drawn');
  },
});

s.fact(F, ['// screen reader reads "Progress: 50%" instead of "50%"'], { kind: 'R' }, async (t, q) => {
  const { mod } = await s.runFence(F, 3);
  const instead = q.tok('Progress: 50%');
  const visible = q.tok('50%');
  const read = await spoken(h(mod.Progress));
  t.equal(read, instead, 'the screen reader reads the description');
  t.notEqual(read, visible, 'instead of the visible text');
  t.equal(stripAnsi(await seen(h(mod.Progress))).trim().split(/\s+/).at(-1), visible, 'which is what is drawn');
});

// ===================================================================== principles

s.fact(
  F,
  ['**Prefer semantic `aria-role`/`aria-state` over visual-only cues.** Screen reader output carries no color, and a glyph (✔, ✗) is just a character in the text; `aria-role` and `aria-state` add the role and state as words.'],
  // the first sentence is the recommendation; the second is its basis and is what is proven
  { kind: 'R', ctx: ['Prefer semantic `aria-role`/`aria-state` over visual-only cues.'] },
  async (t, q) => {
    const [role, state] = ['aria-role', 'aria-state'].map((name) => q.tok(name));
    const styled = box(null, text({ color: 'green', backgroundColor: 'red', bold: true, underline: true }, '✔'), text({ color: 'red', dimColor: true }, '✗'));
    const read = await spoken(styled);
    t.equal(read, '✔ ✗', 'a glyph comes through as plain text');
    t.equal(read, stripAnsi(read), 'with no color or style codes at all');
    t.ok((await seen(styled)).includes('\x1b['), 'positive control: normal output does carry them');
    const checked = box({ [role]: 'checkbox', [state]: { checked: true } }, text(null, 'Accept'));
    t.equal(await spoken(checked), 'checkbox: (checked) Accept', 'the role and state are added as words');
    t.equal(await spoken(box(null, text({ color: 'green' }, '✔'), text(null, 'Accept'))), '✔ Accept', 'where a glyph alone is only the character');
  },
);

s.fact(
  F,
  [
    "**Use `useIsScreenReaderEnabled` to render different output** when the visual layout doesn't read well in order: screen reader output has no borders or column padding and joins the children of a row with a single space (e.g. a table — see `ink-tables` — can render a row-by-row summary instead).",
  ],
  { kind: 'R', ctx: ['Use `useIsScreenReaderEnabled` to render different output'] },
  async (t, q) => {
    const useIsScreenReaderEnabled = q.api(ink, 'useIsScreenReaderEnabled');
    t.ok(skillText(q.tok('ink-tables')).length > 0, 'ink-tables is a skill');
    const cell = (width, value) => box({ width }, text(null, value));
    const row = (...cells) => box(null, ...cells);
    const grid = box({ flexDirection: 'column', borderStyle: 'round', paddingX: 2 }, row(cell(10, 'Name'), cell(6, 'Age')), row(cell(10, 'Ann'), cell(6, '31')));
    t.equal(await spoken(grid), 'Name Age\nAnn 31', 'no border, no padding, no column alignment: the children of a row are joined with one space');
    const drawn = await seen(grid);
    t.ok(drawn.includes('╭') && drawn.includes('Name      Age'), 'positive control: normally the grid has a border and aligned columns');
    // a component that branches on the hook renders the summary a screen reader needs
    const Table = () =>
      useIsScreenReaderEnabled()
        ? box({ flexDirection: 'column' }, text(null, 'Ann: age 31'))
        : grid;
    t.equal(await spoken(h(Table)), 'Ann: age 31', 'with the hook, a screen reader gets a row-by-row summary');
    t.equal(await seen(h(Table)), drawn, 'and everyone else the grid');
  },
);

s.fact(
  F,
  ["`@inkjs/ui` components (see the `inkjs-ui-*` skills) don't set ARIA props themselves — wrap them in a `<Box>` with `aria-role` and `aria-state` yourself."],
  { kind: 'R' },
  async (t, q) => {
    const ui = await import(q.tok('@inkjs/ui'));
    const Box_ = q.el(ink, '<Box>');
    const [role, state] = ['aria-role', 'aria-state'].map((name) => q.tok(name));
    // no skill is called exactly that, but a family of them is
    const family = allSkillFiles().map((entry) => entry.skill).filter((name) => name.startsWith(q.tok('inkjs-ui-*').replace('*', '')));
    t.ok(family.length >= 3, 'the inkjs-ui-* skills exist');
    // nothing in the package sets an aria-* prop; Ink's own Box does (positive control)
    const ariaIn = (dir) =>
      readdirSync(dir, { recursive: true })
        .filter((file) => /\.js$/.test(file) && statSync(join(dir, file)).isFile())
        .filter((file) => /aria-/.test(readFileSync(join(dir, file), 'utf8')));
    t.deepEqual(ariaIn(join(packageDir('@inkjs/ui'), 'build')), [], 'no file of @inkjs/ui mentions an aria- prop');
    t.ok(ariaIn(join(packageDir('ink'), 'build', 'components')).includes('Box.js'), 'positive control: the same search finds them in Ink');
    // so a screen reader hears nothing of the role until it is wrapped
    const bar = h(ui.ProgressBar, { value: 50 });
    const bare = await spoken(bar);
    t.ok(!/^progressbar: /.test(bare), 'unwrapped, the component speaks no role');
    const wrapped = await spoken(h(Box_, { [role]: 'progressbar', [state]: { busy: true } }, bar));
    t.equal(wrapped, `progressbar: (busy) ${bare}`, 'wrapped in a Box with aria-role and aria-state it does');
  },
);
