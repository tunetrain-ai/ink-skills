// Claims for skills/ecosystem/inkjs-ui/inkjs-ui-lists/SKILL.md.
import { skill, tsx, runFence, stripAnsi, catchRenderError } from '../lib/index.mjs';
import { ui, h, ink, keys, open, skillText, lines } from './inkjs-ui-inputs.helpers.mjs';

const s = skill('inkjs-ui-lists');
const F = 'SKILL.md';
const { Box, Text, renderToString } = ink;

const EQ = `type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;`;
const render = (element, columns = 40) => stripAnsi(renderToString(element, { columns }));
const item = (List, label, ...nested) => h(List.Item, { key: label }, h(Text, null, label), ...nested);
/** The labels a fence puts in `<Text>`, in order. */
const labels = (fence) => [...fence.code.matchAll(/<Text>([^<]+)<\/Text>/g)].map((m) => m[1]);
/** Column where the marker starts, and where the label starts, for each line. */
const columns = (out, label) => {
  const line = out.split('\n').find((l) => l.includes(label));
  return { marker: line.search(/\S/), label: line.indexOf(label) };
};

// ===================================================================== description

s.fact(
  F,
  ['@inkjs/ui UnorderedList and OrderedList components (with .Item subcomponents) for rendering nested bullet/numbered lists with correct terminal indentation.'],
  { kind: 'R' },
  async (t) => {
    for (const name of ['UnorderedList', 'OrderedList']) {
      t.equal(typeof ui[name], 'function', `${name} is an export of @inkjs/ui`);
      t.equal(typeof ui[name].Item, 'function', `with an Item subcomponent`);
    }
    const nested = (List) => render(h(List, null, item(List, 'Fruits', h(List, null, item(List, 'Apple')))));
    t.deepEqual(nested(ui.UnorderedList).split('\n').map((l) => l.replace(/^(\s*)\S /, '$1')), ['Fruits', '  Apple'], 'a bullet before every item, a nested list indented under its parent item');
    t.deepEqual(nested(ui.OrderedList).split('\n').map((l) => l.replace(/^(\s*)[\d.]+ /, '$1')), ['Fruits', '   Apple'], 'a number before every item, a nested list indented under its parent item');
  },
);

s.guidance(F, ['Use when the user wants a bullet list, numbered list, or nested list rendered in the terminal.'], 'a recommendation about when to reach for the skill; it asserts nothing about behaviour (each list is exercised by the claims below)');

// ===================================================================== intro

s.fact(
  F,
  ["Static (non-interactive) list rendering with correct bullet/number glyphs and nested indentation — for selectable lists, see `inkjs-ui-inputs`'s `Select`/`MultiSelect` instead."],
  { kind: 'R' },
  async (t, q) => {
    const [Select, MultiSelect] = [q.api(ui, 'Select'), q.api(ui, 'MultiSelect')];
    const inputs = skillText(q.tok('inkjs-ui-inputs'));
    t.ok(inputs.includes('## `Select`') && inputs.includes('## `MultiSelect`'), 'the skill it points to covers both');
    // static: a list never listens to the keyboard; the selectable components do
    const options = [{ label: 'Red', value: 'red' }, { label: 'Green', value: 'green' }];
    for (const List of [ui.UnorderedList, ui.OrderedList]) {
      const app = await open(h(List, null, item(List, 'Red'), item(List, 'Green')));
      t.deepEqual(app.stdin.rawModeCalls, [], 'a list does not read the keyboard');
      const before = app.screen();
      await app.press(keys.down, keys.enter, ' ');
      t.equal(app.screen(), before, 'and does not react to keys');
    }
    for (const Input of [Select, MultiSelect]) {
      const app = await open(h(Input, { options }));
      t.deepEqual(app.stdin.rawModeCalls, [true], 'positive control: a selectable component does read the keyboard');
      const before = app.screen();
      await app.press(keys.down);
      t.notEqual(app.screen(), before, 'and moves its selection');
    }
  },
);

// ===================================================================== UnorderedList

s.fence(F, 0, {
  run: async (t, fence) => {
    const { mod } = await runFence(fence);
    const out = render(h(mod.Example)).split('\n');
    const [first, second] = labels(fence);
    t.match(out[0], new RegExp(`^(\\S) ${first}$`), 'a marker, then the first item');
    const marker = out[0][0];
    t.deepEqual(out, [`${marker} ${first}`, `${marker} ${second}`], 'the same marker before every item');
    t.ok(!/[\p{L}\p{N}]/u.test(marker), 'a bullet glyph, not a letter or digit');
  },
});

// ===================================================================== OrderedList

s.fact(F, ['Same shape, numbered instead of bulleted:'], { kind: 'R' }, async (t) => {
  const children = (List) => [item(List, 'First'), item(List, 'Second'), item(List, 'Third')];
  const ordered = render(h(ui.OrderedList, null, ...children(ui.OrderedList)));
  const unordered = render(h(ui.UnorderedList, null, ...children(ui.UnorderedList)));
  t.equal(ordered, '1. First\n2. Second\n3. Third', 'numbered from 1');
  t.equal(ordered.replace(/^\d\./gm, '-'), unordered.replace(/^\S/gm, '-'), 'the same layout as the bulleted list, with numbers where the bullets were');
  const ten = render(h(ui.OrderedList, null, ...Array.from({ length: 10 }, (_, i) => item(ui.OrderedList, `i${i + 1}`))));
  t.equal(ten.split('\n')[0], ' 1. i1', 'the numbers are right-aligned when there are ten or more items');
  t.equal(ten.split('\n')[9], '10. i10');
});
s.types(F, ['Same shape, numbered instead of bulleted:'], tsx`
import React from 'react';
import {UnorderedList, OrderedList} from '@inkjs/ui';
${EQ}
export const list: Equal<React.ComponentProps<typeof OrderedList>, React.ComponentProps<typeof UnorderedList>> = true;
export const itemProps: Equal<React.ComponentProps<typeof OrderedList.Item>, React.ComponentProps<typeof UnorderedList.Item>> = true;
export const missing = <OrderedList />; //! TS2741
`);

s.fence(F, 1, {
  run: async (t, fence) => {
    const { mod } = await runFence(fence);
    const [first, second] = labels(fence);
    t.equal(render(h(mod.Example)), `1. ${first}\n2. ${second}`, 'the items are numbered 1., 2.');
  },
});

// ===================================================================== Nesting

s.fact(F, ["Both accept another list as an item's child — indentation compounds automatically:"], { kind: 'R' }, async (t) => {
  const deep = (List) => h(List, null, item(List, 'One', h(List, null, item(List, 'Two', h(List, null, item(List, 'Three'))), item(List, 'Two b'))));
  for (const List of [ui.UnorderedList, ui.OrderedList]) {
    const out = render(deep(List));
    const [one, two, three] = ['One', 'Two', 'Three'].map((label) => columns(out, label));
    t.equal(two.marker, one.label, `${List.name}: a nested list starts where its parent item's text starts`);
    t.equal(three.marker, two.label, `${List.name}: and so does the next level, so the indentation adds up`);
    t.ok(one.marker < two.marker && two.marker < three.marker, `${List.name}: every level is indented further than the one above`);
    t.equal(columns(out, 'Two b').marker, two.marker, `${List.name}: siblings share an indentation`);
  }
  const mixed = render(h(ui.UnorderedList, null, item(ui.UnorderedList, 'Top', h(ui.OrderedList, null, item(ui.OrderedList, 'Numbered')))));
  t.match(mixed.split('\n')[1], /^\s+1\. Numbered$/, 'and the two kinds nest in each other');
});

s.fence(F, 2, {
  run: async (t, fence) => {
    const { mod } = await runFence(fence);
    const [parent, ...children] = labels(fence);
    const out = render(h(mod.Example)).split('\n');
    const top = columns(out.join('\n'), parent);
    t.equal(top.marker, 0, 'the outer item is not indented');
    const inner = children.map((label) => columns(out.join('\n'), label));
    t.ok(inner.every((position) => position.marker === top.label), 'the inner items start under the outer item text');
    t.deepEqual(out.map((line) => line.trim().replace(/^\S /, '')), [parent, ...children], 'one line each, in order');
  },
});

s.fact(F, ['Note: `@inkjs/ui` does **not** re-export `<Text>` — import it from `ink` directly, as above.'], { kind: 'R', ctx: ['not'] }, async (t, q) => {
  const name = q.tok('<Text>').replace(/[<>]/g, '');
  const [uiModule, inkModule] = [await import(q.tok('@inkjs/ui')), await import(q.tok('ink'))];
  const Text = q.el(inkModule, '<Text>');
  t.equal(typeof Text, 'function', 'Ink exports it');
  t.ok(!(name in uiModule), '@inkjs/ui does not');
  t.ok('UnorderedList' in uiModule && 'Badge' in uiModule, 'positive control: it does export its own components');
  t.equal(render(h(ui.UnorderedList, null, h(ui.UnorderedList.Item, null, h(Text, null, 'x')))), `${render(h(ui.UnorderedList, null, item(ui.UnorderedList, 'x')))}`, 'the Text from ink is what goes in an item');
});
s.types(F, ['Note: `@inkjs/ui` does **not** re-export `<Text>` — import it from `ink` directly, as above.'], tsx`
import {Text} from '@inkjs/ui'; //! TS2305
import {Text as InkText} from 'ink';
import {UnorderedList} from '@inkjs/ui';

export const ok = <UnorderedList><UnorderedList.Item><InkText>x</InkText></UnorderedList.Item></UnorderedList>;
export const unused = Text;
`, { ctx: ['<Text>', 'not'] });

s.fact(
  F,
  ['Text in a list item must still be inside `<Text>` — a bare string throws, as it does anywhere in Ink.'],
  { kind: 'R' },
  async (t, q) => {
    const Text = q.el(ink, '<Text>');
    const pattern = /Text string "([^"]*)" must be rendered inside <Text> component/;
    for (const List of [ui.UnorderedList, ui.OrderedList]) {
      const bare = catchRenderError(h(List, null, h(List.Item, null, 'bare words')));
      t.ok(bare instanceof Error, `${List.name}: a string straight inside an item throws`);
      t.equal(bare.message.match(pattern)?.[1], 'bare words', 'with the message Ink gives for it');
      t.equal(catchRenderError(h(List, null, h(List.Item, null, h(Text, null, 'wrapped')))), null, 'positive control: the same words inside <Text> render');
      t.equal(catchRenderError(h(List, null, h(List.Item, null, h(List, null, h(List.Item, null, h(Text, null, 'inner')))))), null, 'and an item may hold only another list');
    }
    const elsewhere = catchRenderError(h(Box, null, 'bare words'));
    t.equal(elsewhere.message, catchRenderError(h(ui.UnorderedList, null, h(ui.UnorderedList.Item, null, 'bare words'))).message, 'the same error as a bare string inside a <Box>');
  },
);
