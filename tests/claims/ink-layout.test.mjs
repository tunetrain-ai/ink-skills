// Claims for skills/core/ink-layout (SKILL.md, references/box-props.md, references/scrollable-view.md).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { skill, tsx, ink, h, React, mount, stripAnsi, pkg, readPackageFile, ROOT, loadEcosystem } from '../lib/index.mjs';
import { pick, resolvePath, propAndValue, propAndExpression, scrollView, press } from './ink-layout.helpers.mjs';

const { Box, Text, Spacer, renderToString, measureElement, useBoxMetrics } = ink;
const s = skill('ink-layout');
const F = 'SKILL.md';
const SKILL_DIR = join(ROOT, 'skills', 'core', 'ink-layout');

const render = (element, columns = 80) => renderToString(element, { columns });
const labels = (...names) => names.map((name, i) => h(Text, { key: i }, name));
const boxed = (props, ...names) => render(h(Box, props, ...labels(...names)));
const lines = (out) => out.split('\n');
const rows = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => `Row ${from + i}`);
/** Width in cells of the widest line (ANSI stripped). */
const widest = (out) => Math.max(...lines(stripAnsi(out)).map((l) => l.length));
/** A bordered box of the given props, so its extent is visible as characters. */
const frame = (props, columns) => render(h(Box, { borderStyle: 'single', ...props }), columns);
/** Rows and columns a single-border box occupies inside a larger render. */
const extent = (out) => {
  const ls = lines(stripAnsi(out));
  const top = ls.findIndex((l) => l.includes('┌'));
  const bottom = ls.findIndex((l) => l.includes('└'));
  return { rows: bottom - top + 1, cols: ls[top].indexOf('┐') - ls[top].indexOf('┌') + 1 };
};

// ---------------------------------------------------------------- frontmatter

s.fact(F, ["Lay out terminal UI with Ink's <Box>, a Yoga flexbox container"], { kind: 'D' }, async (t) => {
  t.ok(pkg('ink').dependencies['yoga-layout'], 'ink lays out with yoga-layout');
  t.equal(typeof Box, 'object', '<Box> is exported by ink');
});

s.types(F, ['width/height, padding/margin, gap, flex-grow/shrink/basis, flexDirection, alignItems/justifyContent, position, overflow, scrolling with contentOffsetX/contentOffsetY, and measuring a box at runtime with measureElement/useBoxMetrics'], tsx`
import {Box, measureElement, useBoxMetrics} from 'ink';
export const all = (
	<Box
		width={10} height={4} padding={1} margin={1} gap={1}
		flexGrow={1} flexShrink={1} flexBasis={5}
		flexDirection="column" alignItems="center" justifyContent="center"
		position="relative" overflow="hidden" contentOffsetX={1} contentOffsetY={1}
	/>
);
export const measuring = [measureElement, useBoxMetrics];
`);

s.guidance(F, ['Use for any "how do I position/size/center/space out" question in Ink.'], 'routing hint telling a reader when to load the skill; asserts nothing about Ink', {
  exempt: ['how do I position/size/center/space out'],
});

// ------------------------------------------------------------------ the model

s.types(F, ["`<Box>` is Ink's layout component: layout props exist on `<Box>`, not on `<Text>`."], tsx`
import {Box, Text} from 'ink';
export const plain = <Box><Text>x</Text></Box>;
export const onBox = <Box width={5} padding={1} gap={1} />;
export const onText = <Text width={5}>x</Text>; //! TS2322
`);

s.fact(F, ['Every `<Box>` is a Yoga flexbox container — think `<div style="display: flex">`'], { kind: 'D' }, async (t, q) => {
  const component = q.el(ink, '<Box>');
  const [prop, value] = q.tok('<div style="display: flex">').match(/style="([^"]+)"/)[1].split(': ');
  const sibling = (props) => render(h(component, props, ...labels('a', 'b')));
  // what `display` does to a Box: flex lays the children out, none removes the box
  const displayed = { flex: 'ab', none: '' };
  t.equal(sibling({ [prop]: value }), pick(displayed, value), 'display: flex lays the children out');
  t.equal(sibling({}), sibling({ [prop]: value }), 'a Box with no display behaves exactly like display: flex');
  t.equal(sibling({}), 'ab', 'children sit side by side, as in a flex row');
  t.equal(sibling({ [prop]: 'none' }), displayed.none, 'and `display` is the prop that switches the box off');
  t.ok(pkg('ink').dependencies['yoga-layout'], 'the layout engine is Yoga');
});

s.types(F, ['its `display` can be `flex` or `none`, nothing else'], tsx`
import {Box} from 'ink';
export const flex = <Box display="flex" />;
export const none = <Box display="none" />;
export const grid = <Box display="grid" />; //! TS2322
export const block = <Box display="block" />; //! TS2322
`);

s.fact(F, ['There is no CSS Grid, no absolute-by-default positioning, and no implicit block layout.'], { kind: 'R' }, async (t) => {
  // positioning defaults to relative: `top` nudges the box from where it would have been,
  // whereas absolute would place it against the parent's corner
  const placed = (props) => render(h(Box, { width: 6, height: 3 }, h(Text, null, 'A'), h(Box, props, h(Text, null, 'B'))));
  t.equal(placed({ top: 1 }), placed({ top: 1, position: 'relative' }), 'default position is relative');
  t.notEqual(placed({ top: 1 }), placed({ top: 1, position: 'absolute' }), 'absolute would differ, so the default is not absolute');
  // no block layout: siblings share a line by default
  t.equal(boxed({}, 'one', 'two'), 'onetwo');
});

s.fact(F, ['Without a border or background a `<Box>` renders nothing itself; characters come from `<Text>`.'], { kind: 'R' }, async (t, q) => {
  const component = ink[q.tok('<Box>').slice(1, -1)];
  const text = ink[q.tok('<Text>').slice(1, -1)];
  t.equal(render(h(component, { width: 6, height: 2 })).trim(), '', 'an empty plain Box prints no characters (only blank rows)');
  t.notEqual(frame({ width: 6, height: 3 }), '', 'a border prints characters');
  t.match(render(h(component, { width: 3, height: 1, backgroundColor: 'red' })), /\x1b\[41m/, 'a background prints coloured cells');
  t.equal(render(h(text, null, 'abc')), 'abc', 'Text is what prints characters');
});

s.fence(F, 0);

s.fact(F, ['For the full prop reference (every dimension/spacing/flex/position/overflow prop, with examples) see `references/box-props.md`.'], { kind: 'D' }, async (t, q) => {
  t.ok(existsSync(join(SKILL_DIR, q.tok('references/box-props.md'))), 'the referenced file exists in the skill');
});

s.guidance(F, ['This file covers the mental model and the handful of things that trip people up.'], 'describes the contents of this file; asserts nothing about Ink');

// ----------------------------------------------------------- default direction

s.fact(F, ['The flex default is `row`, not `column`', "Unlike a browser `<div>`, `<Box>`'s default `flexDirection` is `row` — children lay out left-to-right unless you set `flexDirection=\"column\"`."], { kind: 'D', ctx: ['<div>'] }, async (t, q) => {
  const Component = q.el(ink, '<Box>');
  const prop = q.tok('flexDirection');
  const row = q.tok('row');
  const column = q.tok('column');
  const [quotedProp, quotedValue] = propAndValue(q.tok('flexDirection="column"'));
  const stack = (props) => render(h(Component, props, ...labels('one', 'two')));
  // an unknown flexDirection is ignored (and Yoga's own default is column), so each value is checked against what it must draw
  const drawn = { row: 'onetwo', column: 'one\ntwo' };
  t.equal(stack({}), pick(drawn, row), 'no flexDirection means row');
  t.equal(stack({ [prop]: row }), pick(drawn, row), 'row lays children left to right');
  t.equal(stack({ [prop]: column }), pick(drawn, column), 'column stacks them');
  t.notEqual(stack({ [prop]: column }), stack({}), 'so the default is not column');
  t.equal(stack({ [quotedProp]: quotedValue }), pick(drawn, quotedValue), 'flexDirection="column" is the way to ask for a column');
  t.equal(quotedProp, prop);
  t.equal(quotedValue, column);
});

s.fence(F, 1);

// --------------------------------------------------------------------- sizing

s.fact(F, ['`width`/`height` are counted in character columns/rows.'], { kind: 'R' }, async (t, q) => {
  const [w, hgt] = [q.tok('width'), q.tok('height')];
  const out = lines(frame({ [w]: 9, [hgt]: 4 }));
  t.equal(out.length, 4, 'height counts rows');
  t.equal(out[0].length, 9, 'width counts columns');
});

s.fact(F, ["Percentages resolve against the parent's resolved size."], { kind: 'R' }, async (t) => {
  const inside = (child) => render(h(Box, { width: 20, height: 8 }, h(Box, { borderStyle: 'single', ...child })));
  const got = extent(inside({ width: '50%', height: '50%' }));
  t.equal(got.cols, 10, '50% of a 20-column parent is 10 columns');
  t.equal(got.rows, 4, '50% of an 8-row parent is 4 rows');
});

s.types(F, ['`minWidth`/`maxWidth` accept only numbers (cells); percentage strings are a type error.'], tsx`
import {Box} from 'ink';
export const ok = <Box minWidth={10} maxWidth={20} />;
export const minPercent = <Box minWidth="50%" />; //! TS2322
export const maxPercent = <Box maxWidth="50%" />; //! TS2322
`);

s.fact(F, ['`minWidth`/`maxWidth` accept only numbers (cells)'], { kind: 'R' }, async (t, q) => {
  const [min, max] = [q.tok('minWidth'), q.tok('maxWidth')];
  t.equal(frame({ width: 4, [min]: 9 }).split('\n')[0].length, 9, 'minWidth widens a narrower box, in cells');
  t.equal(frame({ width: 30, [max]: 12 }).split('\n')[0].length, 12, 'maxWidth narrows a wider box, in cells');
});

s.types(F, ['`minHeight`/`maxHeight` still accept percentages.'], tsx`
import {Box} from 'ink';
export const ok = <Box minHeight="50%" maxHeight="50%" />;
export const numbers = <Box minHeight={3} maxHeight={6} />;
`);

s.fact(F, ['`minHeight`/`maxHeight` still accept percentages.'], { kind: 'R' }, async (t, q) => {
  const [min, max] = [q.tok('minHeight'), q.tok('maxHeight')];
  // flex-start: a child that stretches (the default) would fill the parent and hide minHeight
  const parent = (child) => extent(render(h(Box, { width: 12, height: 10, alignItems: 'flex-start' }, h(Box, { borderStyle: 'single', ...child }))));
  t.equal(parent({ [min]: '50%' }).rows, 5, 'minHeight 50% of a 10-row parent');
  t.equal(parent({ height: 9, [max]: '50%' }).rows, 5, 'maxHeight 50% caps a taller box');
});

// -------------------------------------------------------------------- spacing

s.fact(F, ["`gap` (and `columnGap`/`rowGap`) space out a box's **direct children**, only between them — no gap before the first or after the last child."], { kind: 'R', ctx: ['direct children'] }, async (t, q) => {
  const [gap, columnGap, rowGap] = [q.tok('gap'), q.tok('columnGap'), q.tok('rowGap')];
  t.equal(boxed({ [gap]: 2 }, 'a', 'b', 'c'), 'a  b  c', 'gap goes only between row children');
  t.equal(boxed({ [columnGap]: 3 }, 'a', 'b'), 'a   b', 'columnGap spaces columns');
  t.equal(boxed({ flexDirection: 'column', [rowGap]: 1 }, 'a', 'b'), 'a\n\nb', 'rowGap spaces rows');
  // direct children only: the grandchildren inside one child are not spaced by the outer gap
  const nested = render(h(Box, { gap: 2 }, h(Box, null, ...labels('x', 'y')), h(Text, null, 'z')));
  t.equal(nested, 'xy  z', 'x and y are grandchildren: no gap between them');
});

s.fact(F, ['`margin*` pushes a box away from its siblings.'], { kind: 'R' }, async (t, q) => {
  const prefix = q.tok('margin*').replace('*', '');
  const plain = render(h(Box, null, h(Text, null, 'a'), h(Text, null, 'b')));
  const pushed = render(h(Box, null, h(Text, null, 'a'), h(Box, { [`${prefix}Left`]: 3 }, h(Text, null, 'b'))));
  t.equal(plain, 'ab');
  t.equal(pushed, 'a   b', 'marginLeft moves the box away from its left sibling');
  const vertical = render(h(Box, { flexDirection: 'column' }, h(Text, null, 'a'), h(Box, { [`${prefix}Top`]: 2 }, h(Text, null, 'b'))));
  t.equal(vertical, 'a\n\n\nb', 'marginTop pushes it down from the sibling above');
});

s.fact(F, ['`padding*` adds space inside a box, between its border and its content.'], { kind: 'R' }, async (t, q) => {
  const prefix = q.tok('padding*').replace('*', '');
  const out = lines(render(h(Box, { borderStyle: 'single', width: 8, [`${prefix}X`]: 2, [`${prefix}Y`]: 1 }, h(Text, null, 'hi'))));
  t.equal(out.length, 5, 'one row of padding above and below the text');
  t.equal(out[2], '│  hi  │', 'two columns of padding either side, inside the border');
});

s.fact(F, ["Prefer `gap` over adding `marginRight` to every child but the last — it's shorter and doesn't need a special case for the last item."], { kind: 'R' }, async (t, q) => {
  const [gap, marginRight] = [q.tok('gap'), q.tok('marginRight')];
  const withGap = render(h(Box, { [gap]: 2 }, ...labels('a', 'b', 'c')));
  const withMargins = render(h(Box, null, h(Box, { [marginRight]: 2, key: 0 }, h(Text, null, 'a')), h(Box, { [marginRight]: 2, key: 1 }, h(Text, null, 'b')), h(Text, { key: 2 }, 'c')));
  t.equal(withGap, withMargins, 'gap gives the output of margins on all but the last child');
  t.equal(withGap, 'a  b  c');
});

s.guidance(F, ['Three tools cover common layouts:'], 'frames the three examples that follow; each example is proven on its own');

// ------------------------------------------------------------------ the recipes

s.fence(F, 2);
s.fact(F, ['Center a single child in both axes'], { kind: 'R' }, async (t) => {
  const out = lines(render(h(Box, { justifyContent: 'center', alignItems: 'center', height: 5 }, h(Text, null, 'X')), 11));
  t.equal(out.length, 5, 'the box is 5 rows tall');
  t.equal(out.findIndex((l) => l.includes('X')), 2, 'X sits on the middle row');
  t.equal(out[2].indexOf('X'), 5, 'X sits in the middle column of an 11-column terminal');
});

s.fence(F, 3);
s.fact(F, ['Push content to opposite ends — <Spacer> eats all remaining space'], { kind: 'R' }, async (t) => {
  const out = render(h(Box, null, h(Text, null, 'Left'), h(Spacer), h(Text, null, 'Right')), 20);
  t.equal(out, `Left${' '.repeat(11)}Right`, 'Left at the start, Right at the end, Spacer takes the 11 columns between');
  t.equal(typeof Spacer, 'function', '<Spacer> is a component exported by ink');
});

s.fence(F, 4);
s.fact(F, ['Fill remaining space with flexGrow instead of a fixed width'], { kind: 'R' }, async (t) => {
  const grown = lines(render(h(Box, { width: 30 }, h(Text, null, 'Label:'), h(Box, { flexGrow: 1, borderStyle: 'single' }, h(Text, null, 'x'))), 30));
  t.equal(grown[0].length - 'Label:'.length, 24, 'the grown box takes the 24 columns the 6-column label leaves');
});

// -------------------------------------------------------- measuring at runtime

/**
 * Mount a probe that records measureElement and useBoxMetrics for one bordered, padded box.
 * `apis` swaps in the functions a claim looked up from its quote (measureElement, useBoxMetrics,
 * useEffect, useLayoutEffect), so a changed name in the text changes what the probe calls.
 */
async function measured(extraBoxProps = {}, wrapperProps = {}, apis = {}) {
  const { measureElement: measure = measureElement, useBoxMetrics: useMetrics = useBoxMetrics, useEffect = React.useEffect, useLayoutEffect = React.useLayoutEffect } = apis;
  const seen = { renders: [], effect: null, layoutEffect: null, handler: null };
  const Probe = () => {
    const ref = React.useRef(null);
    const metrics = useMetrics(ref);
    useLayoutEffect(() => {
      seen.layoutEffect = measure(ref.current);
    });
    useEffect(() => {
      seen.effect = measure(ref.current);
      seen.handler = () => measure(ref.current);
    });
    seen.renders.push(metrics);
    return h(Box, { width: 20, ...wrapperProps }, h(Box, { ref, borderStyle: 'single', padding: 1, flexGrow: 1, ...extraBoxProps }, h(Text, null, 'hi')));
  };
  const app = mount(h(Probe), { columns: 40 });
  await app.flush();
  return { seen, app };
}

s.fact(F, ["`measureElement(ref.current)` and the `useBoxMetrics(ref)` hook both return a box's resolved layout:"], { kind: 'R' }, async (t, q) => {
  const measure = q.api(ink, 'measureElement(ref.current)');
  const useMetrics = q.api(ink, 'useBoxMetrics(ref)');
  const { seen } = await measured({}, {}, { measureElement: measure, useBoxMetrics: useMetrics });
  const last = seen.renders.at(-1);
  t.equal(seen.effect.width, 20);
  t.equal(seen.effect.height, 5);
  t.equal(last.width, 20, 'the hook reports the same box');
  t.equal(last.height, 5);
});

s.fact(F, ['`measureElement` → `{x, y, width, height, clientWidth, clientHeight}`'], { kind: 'R' }, async (t, q) => {
  const measure = q.api(ink, 'measureElement');
  const keys = q.tok('{x, y, width, height, clientWidth, clientHeight}').slice(1, -1).split(', ');
  const { seen } = await measured({}, {}, { measureElement: measure });
  t.deepEqual(Object.keys(seen.effect).sort(), [...keys].sort());
});

s.fact(F, ['`useBoxMetrics` → `{width, height, left, top, clientWidth, clientHeight, hasMeasured}`'], { kind: 'R' }, async (t, q) => {
  const useMetrics = q.api(ink, 'useBoxMetrics');
  const keys = q.tok('{width, height, left, top, clientWidth, clientHeight, hasMeasured}').slice(1, -1).split(', ');
  const { seen } = await measured({}, {}, { useBoxMetrics: useMetrics });
  t.deepEqual(Object.keys(seen.renders.at(-1)).sort(), [...keys].sort());
});

s.guidance(F, ['Two differences:'], 'lead-in to the two bullets that follow, each proven separately');

s.fact(F, ['`useBoxMetrics` is a hook that **re-renders your component** when layout changes (resize, content changes); on the first render, before the first layout pass, it returns zeros with `hasMeasured` set to `false`. `measureElement` is an **imperative, point-in-time read** of the layout as it is now — call it from `useEffect`/`useLayoutEffect`, an input handler, or a timer, once the element has mounted.'], { kind: 'R', ctx: ['re-renders your component', 'imperative, point-in-time read'] }, async (t, q) => {
  const apis = {
    useBoxMetrics: q.api(ink, 'useBoxMetrics'),
    measureElement: q.api(ink, 'measureElement'),
    useEffect: q.api(React, 'useEffect'),
    useLayoutEffect: q.api(React, 'useLayoutEffect'),
  };
  const measuredKey = q.tok('hasMeasured');
  const falseValue = q.tok('false');
  const { seen, app } = await measured({}, { width: '50%' }, apis);
  t.deepEqual(
    { ...seen.renders[0], [measuredKey]: String(seen.renders[0][measuredKey]) },
    { width: 0, height: 0, left: 0, top: 0, clientWidth: 0, clientHeight: 0, [measuredKey]: falseValue },
    'first render: zeros and hasMeasured false',
  );
  t.equal(seen.renders.at(-1).hasMeasured, true, 'a later render has real values');
  const widthBefore = seen.renders.at(-1).width;
  t.equal(seen.layoutEffect.width, widthBefore, 'measureElement already sees the layout in useLayoutEffect');
  t.equal(seen.effect.width, widthBefore, 'and in useEffect');
  // the hook re-renders when the layout changes; a handler's read is the current layout
  const rendersBefore = seen.renders.length;
  await app.resize(60, 24);
  t.ok(seen.renders.length > rendersBefore, 'resizing re-rendered the component');
  t.notEqual(seen.renders.at(-1).width, widthBefore, 'with the new width');
  t.equal(seen.handler().width, seen.renders.at(-1).width, 'a read from a handler returns the current layout');
});

s.types(F, ['`measureElement` takes a non-null `DOMElement`, so guard `ref.current` before calling it (a ref is `null` until the element mounts).'], tsx`
import {useRef} from 'react';
import {measureElement, type DOMElement} from 'ink';
export const useIt = () => {
	const ref = useRef<DOMElement | null>(null);
	if (ref.current) measureElement(ref.current);
	return measureElement(ref.current); //! TS2345
};
export const direct = (node: DOMElement) => measureElement(node);
export const nothing = (node: null) => measureElement(node); //! TS2345
`);

s.fact(F, ['`measureElement` takes a non-null `DOMElement`, so guard `ref.current` before calling it (a ref is `null` until the element mounts).'], { kind: 'R' }, async (t, q) => {
  const measure = q.api(ink, 'measureElement');
  const typeName = q.tok('DOMElement');
  const [refProp, currentKey] = q.tok('ref.current').split('.');
  const nothing = JSON.parse(q.tok('null'));
  t.match(readPackageFile('ink', 'build/index.d.ts'), new RegExp(`export type \\{ ${typeName} \\} from`), 'DOMElement is the type Ink exports for the element a ref to a <Box> holds');
  t.throws(() => measure(nothing), TypeError, 'calling it with the null a ref holds before mount throws');
  let first = 'unset';
  let holder;
  const Probe = () => {
    const ref = React.useRef(nothing);
    holder = ref;
    if (first === 'unset') first = ref[currentKey];
    return h(Box, { [refProp]: ref, width: 7 });
  };
  const app = mount(h(Probe));
  await app.flush();
  t.equal(first, nothing, 'during the first render the ref is still null');
  t.equal(measure(holder[currentKey]).width, 7, 'once the element has mounted the ref holds it, and measuring it works');
});

s.fact(F, ['`clientWidth`/`clientHeight` are the size excluding borders but **not** padding.'], { kind: 'R', ctx: ['not'] }, async (t, q) => {
  const [cw, ch] = [q.tok('clientWidth'), q.tok('clientHeight')];
  const { seen } = await measured();
  t.equal(seen.effect.width, 20);
  t.equal(seen.effect[cw], 18, 'two border columns removed, the padding kept');
  t.equal(seen.effect.height, 5);
  t.equal(seen.effect[ch], 3, 'two border rows removed, the padding kept');
});

s.fact(F, ["`left`/`top` are relative to the parent and `x`/`y` accumulate up the layout tree; neither includes an ancestor's `contentOffsetX`/`contentOffsetY`, so subtract the offset when hit-testing inside a scrolled box."], { kind: 'R' }, async (t, q) => {
  const [left, top, x, y] = [q.tok('left'), q.tok('top'), q.tok('x'), q.tok('y')];
  const [offX, offY] = [q.tok('contentOffsetX'), q.tok('contentOffsetY')];
  const scene = async (offsets) => {
    const seen = {};
    const Probe = () => {
      const ref = React.useRef(null);
      const metrics = useBoxMetrics(ref);
      React.useEffect(() => {
        seen.measure = measureElement(ref.current);
      });
      seen.hook = metrics;
      return h(Box, { width: 30, height: 10, paddingLeft: 3, paddingTop: 2 },
        h(Box, { width: 20, height: 6, overflow: 'hidden', ...offsets },
          h(Box, { ref, marginLeft: 4, marginTop: 5, width: 4, height: 2 }, h(Text, null, 'zz'))));
    };
    const app = mount(h(Probe), { columns: 60 });
    await app.flush();
    return { ...seen, screen: app.screen() };
  };
  const still = await scene({});
  t.deepEqual([still.hook[left], still.hook[top], still.measure[x], still.measure[y]], [4, 5, 3 + 4, 2 + 5], 'without an offset: left/top are the margins, x/y add the ancestors (padding 3 + margin 4, padding 2 + margin 5)');
  for (const [axis, offset] of [[offX, 2], [offY, 1]]) {
    const scrolled = await scene({ [axis]: offset });
    t.notEqual(scrolled.screen, still.screen, `${axis} is real: the scrolled box draws its content elsewhere`);
    t.equal(scrolled.hook[left], still.hook[left], `left ignores ${axis}`);
    t.equal(scrolled.hook[top], still.hook[top], `top ignores ${axis}`);
    t.equal(scrolled.measure[x], still.measure[x], `x ignores ${axis}`);
    t.equal(scrolled.measure[y], still.measure[y], `y ignores ${axis}`);
  }
});

s.fence(F, 5);
s.fact(F, ['only reliable here — post-render'], { kind: 'R' }, async (t) => {
  // the fence's component: an outer 100-column box around a flexGrow box, measured in useEffect
  const widths = [];
  const Example = () => {
    const ref = React.useRef(null);
    const [width, setWidth] = React.useState(0);
    React.useEffect(() => {
      if (!ref.current) return;
      setWidth(measureElement(ref.current).width);
    }, []);
    widths.push(width);
    return h(Box, { width: 100 }, h(Box, { ref, flexGrow: 1 }, h(Text, null, `This box grows to 100 columns, measured: ${width}`)));
  };
  const app = mount(h(Example), { columns: 120 });
  await app.flush();
  t.equal(widths[0], 0, 'before the effect nothing has been measured');
  t.equal(widths.at(-1), 100, 'after mount the effect reads the real width');
  t.match(app.screen(), /grows to 100 columns, measured: 100$/);
});

// ------------------------------------------------------------------ scrolling

s.fact(F, ['`<Box>` has `contentOffsetX`/`contentOffsetY` (cells, default `0`) that shift its children left/up.'], { kind: 'R' }, async (t, q) => {
  const [offX, offY] = [q.tok('contentOffsetX'), q.tok('contentOffsetY')];
  const zero = Number(q.tok('0'));
  const BoxEl = q.el(ink, '<Box>');
  const view = (props) => render(h(BoxEl, { width: 4, height: 2, overflow: 'hidden', ...props }, h(Box, { flexDirection: 'column', flexShrink: 0, width: 8 }, h(Text, null, 'abcdefgh'), h(Text, null, 'ijklmnop'))));
  t.equal(view({}), view({ [offX]: zero, [offY]: zero }), 'the default is 0');
  t.equal(view({ [offX]: 2 }), 'cdef\nklmn', 'contentOffsetX shifts the children left');
  t.equal(view({ [offY]: 1 }).trimEnd(), 'ijkl', 'contentOffsetY shifts the children up (the second row is now past the end)');
});

s.fact(F, ['Put the content in a fixed-size `overflow="hidden"` viewport with `flexDirection="column"` and set `contentOffsetY={scrollTop}`; clamp `scrollTop` to `content.height - viewport.clientHeight`, both measured with `useBoxMetrics`.'], { kind: 'R' }, async (t, q) => {
  const [overflowProp, hidden] = propAndValue(q.tok('overflow="hidden"'));
  const [directionProp, column] = propAndValue(q.tok('flexDirection="column"'));
  const [offsetProp, offsetExpression] = propAndExpression(q.tok('contentOffsetY={scrollTop}'));
  const scrollTop = q.tok('scrollTop');
  const formula = q.tok('content.height - viewport.clientHeight');
  const useMetrics = q.api(ink, 'useBoxMetrics');
  t.equal(offsetExpression, scrollTop, 'the offset prop is set from scrollTop');
  // the pattern built from the quote's own props; a footer below it shows whether the viewport clips
  const make = (direction) => scrollView({ rows: 20, height: 5, offsetProp, useBoxMetrics: useMetrics, footer: 'END', viewport: { [overflowProp]: hidden, [directionProp]: direction } });
  const view = await make(column);
  t.equal(view.visible(), [...rows(1, 5), 'END'].join('\n'), 'the viewport shows 5 rows and clips the other 15 (the footer below it is untouched)');
  await press(view, 'down', 40);
  const [minuend, subtrahend] = formula.split(' - ');
  const scope = { content: view.seen.content, viewport: view.seen.viewport };
  const max = resolvePath(scope, minuend) - resolvePath(scope, subtrahend);
  t.equal(max, 15, '20 rows in a 5-row viewport: the largest useful offset is 15');
  t.equal(view.seen[scrollTop], max, 'scrollTop stops at the formula however often the key is pressed');
  t.equal(view.visible(), [...rows(16, 20), 'END'].join('\n'), 'clamped at that offset the last rows are showing');
  // the viewport must be a column: in a row, the content wrapper is stretched to the viewport's
  // height (cross-axis stretch), so its measured height is the viewport's and nothing can scroll
  const heights = { row: 5, column: 20 };
  const wrongWay = await make('row');
  t.equal(wrongWay.contentHeight(), pick(heights, 'row'), 'in a row viewport the wrapper is squeezed to the viewport height');
  const rightWay = await make(column);
  t.equal(rightWay.contentHeight(), pick(heights, column), 'in a column viewport the wrapper keeps its full height');
  const reference = s.fenceOf('references/scrollable-view.md', 0).code;
  t.ok(reference.includes(`${offsetProp}={${scrollTop}}`), 'which is how the reference component sets it');
});

s.fact(F, ['See `references/scrollable-view.md` for a full component.'], { kind: 'D' }, async (t, q) => {
  t.ok(existsSync(join(SKILL_DIR, q.tok('references/scrollable-view.md'))));
});

s.fact(F, ['Everything inside a `contentOffset` viewport is still laid out'], { kind: 'R' }, async (t, q) => {
  const offsetProp = `${q.tok('contentOffset')}Y`;
  const seen = {};
  const Probe = () => {
    const ref = React.useRef(null);
    seen.metrics = useBoxMetrics(ref);
    return h(Box, { width: 10, height: 2, flexDirection: 'column', overflow: 'hidden', [offsetProp]: 8 },
      h(Box, { flexDirection: 'column', flexShrink: 0 },
        ...labels(...Array.from({ length: 12 }, (_, i) => `r${i}`)).slice(0, 11),
        h(Box, { ref, key: 'tail' }, h(Text, null, 'tail'))));
  };
  const app = mount(h(Probe), { columns: 20 });
  await app.flush();
  t.equal(app.screen(), 'r8\nr9', 'the viewport is scrolled: the rows above it are clipped away');
  t.equal(seen.metrics.hasMeasured, true, 'a row entirely above the visible area was laid out and measured');
  t.equal(seen.metrics.top, 11, 'at its natural position, 11 rows down');
});

s.guidance(F, ['so for very large or unbounded lists render only a slice of the items (windowing) instead — that file shows it too.'], 'advice to window long lists; the windowing component it points at is proven in references/scrollable-view.md');

s.fact(F, ['`ink-navigation` covers drop-in libraries (`ink-scroll-view`, `ink-scroll-list`, `ink-virtual-list`).'], { kind: 'X', ctx: ['ink-navigation'] }, async (t, q) => {
  const { packages } = await loadEcosystem();
  for (const name of [q.tok('ink-scroll-view'), q.tok('ink-scroll-list'), q.tok('ink-virtual-list')]) {
    const entry = packages.find((p) => p.name === name);
    t.ok(entry?.version, `${name} is a real npm package (the weekly registry fetch recorded a version)`);
    t.ok(entry.skills.includes('ink-navigation'), `${name} is covered by ink-navigation`);
  }
});
