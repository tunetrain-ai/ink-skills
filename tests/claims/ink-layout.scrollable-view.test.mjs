// Claims for skills/core/ink-layout/references/scrollable-view.md.
import { skill, ink, h, React, mount, stripAnsi, loadEcosystem } from '../lib/index.mjs';
import { scrollView, windowedList, press } from './ink-layout.helpers.mjs';

const { Box, Text, renderToString, useBoxMetrics, measureElement } = ink;
const s = skill('ink-layout');
const F = 'references/scrollable-view.md';

const render = (element, columns = 40) => renderToString(element, { columns });
const rows = (n, from = 1) => Array.from({ length: n }, (_, i) => `Row ${i + from}`);

// ------------------------------------------------------------------ the idea

s.fact(F, ['`<Box>` can scroll its children: `contentOffsetX`/`contentOffsetY` shift them left/up (in cells), and `overflow="hidden"` clips whatever falls outside the box.'], { kind: 'R' }, async (t, q) => {
  q.tok('<Box>');
  const [offX, offY] = [q.tok('contentOffsetX'), q.tok('contentOffsetY')];
  const hidden = q.tok('overflow="hidden"').match(/"(.+)"/)[1];
  const view = (props) => render(h(Box, { width: 4, height: 2, overflow: hidden, flexDirection: 'column', ...props }, h(Box, { flexDirection: 'column', flexShrink: 0, width: 8 }, h(Text, null, 'abcdefgh'), h(Text, null, 'ijklmnop'), h(Text, null, 'qrstuvwx'))));
  t.equal(view({}), 'abcd\nefgh'.replace('efgh', 'ijkl'), 'the box clips to its 4×2 size');
  t.equal(view({ [offX]: 2 }).split('\n')[0], 'cdef', 'shifted left by 2 cells');
  t.equal(view({ [offY]: 1 }).split('\n')[0], 'ijkl', 'shifted up by 1 row');
});

s.fact(F, ['Ink does not track the offset, read input, or clamp it — you keep `scrollTop` in state, bound it to the measured content, and wire it to keys.'], { kind: 'R' }, async (t, q) => {
  q.tok('scrollTop');
  const holder = (offset) => h(Box, { width: 6, height: 2, flexDirection: 'column', overflow: 'hidden', contentOffsetY: offset }, h(Box, { flexDirection: 'column', flexShrink: 0 }, ...rows(4).map((r, i) => h(Text, { key: i }, r))));
  const app = mount(holder(1), { columns: 20 });
  await app.flush();
  t.equal(app.screen(), 'Row 2\nRow 3');
  await app.press('\x1b[B', '\x1b[B', '\x1b[A');
  t.equal(app.screen(), 'Row 2\nRow 3', 'arrow keys do not move it: Ink reads no input for you');
  await app.rerender(holder(undefined));
  t.equal(app.screen(), 'Row 1\nRow 2', 'it is only the prop: remove it and the view is back at the top');
  await app.rerender(holder(40));
  t.equal(app.screen().trim(), '', 'an offset past the end is not clamped: the view just shows nothing');
});

s.fact(F, ['The pattern: a fixed-size `overflow="hidden"` **viewport** with `flexDirection="column"` and `contentOffsetY={scrollTop}`, wrapping a **content** box that holds everything.'], { kind: 'R', ctx: ['viewport', 'content'] }, async (t, q) => {
  q.tok('overflow="hidden"');
  q.tok('flexDirection="column"');
  q.tok('contentOffsetY={scrollTop}');
  const view = await scrollView({ rows: 20, height: 5 });
  t.equal(view.visible(), rows(5).join('\n'));
  await press(view, 'down', 3);
  t.equal(view.visible(), rows(5, 4).join('\n'), 'driving scrollTop from state scrolls the content box');
  t.equal(view.viewportClientHeight(), 5, 'the viewport is fixed-size');
  t.equal(view.contentHeight(), 20, 'the content box holds all 20 rows');
});

s.fact(F, ['Measure both with `useBoxMetrics` and clamp `scrollTop` to `content.height - viewport.clientHeight`.'], { kind: 'R' }, async (t, q) => {
  q.tok('useBoxMetrics');
  q.tok('scrollTop');
  const formula = q.tok('content.height - viewport.clientHeight');
  const view = await scrollView({ rows: 20, height: 5 });
  await press(view, 'down', 60);
  t.equal(view.seen.scrollTop, view.contentHeight() - view.viewportClientHeight(), formula);
  t.equal(view.seen.scrollTop, 15);
  await press(view, 'up', 60);
  t.equal(view.seen.scrollTop, 0, 'and it never goes below 0');
});

s.fence(F, 0);
s.fact(F, ['Clamp every render — the maximum shrinks as the content or viewport change.'], { kind: 'R' }, async (t) => {
  const view = await scrollView({ rows: 20, height: 5 });
  await press(view, 'down', 60);
  t.equal(view.seen.scrollTop, 15);
  await view.setRows(8);
  t.equal(view.seen.scrollTop, 3, 'with 8 rows the largest offset is 3; the stored request of 15 is clamped on render');
  t.equal(view.visible(), rows(5, 4).join('\n'), 'so the view shows the last rows, not blank space');
});

s.fact(F, ['`useBoxMetrics` returns zeros until the first layout pass, so on the first render the view shows the top of the content (`maxScrollTop` is `0`) and it settles on the next render.'], { kind: 'R' }, async (t, q) => {
  q.tok('useBoxMetrics');
  q.tok('maxScrollTop');
  const zero = Number(q.tok('0'));
  const view = await scrollView({ rows: 20, height: 5 });
  t.equal(view.seen.content.hasMeasured, true, 'after settling the content is measured');
  t.equal(view.contentHeight(), 20);
  const first = [];
  const Probe = () => {
    const ref = React.useRef(null);
    const m = useBoxMetrics(ref);
    first.push(Math.max(zero, m.height - 0));
    return h(Box, { ref, height: 3 });
  };
  const app = mount(h(Probe));
  await app.flush();
  t.equal(first[0], zero, 'the very first render sees zeros, so maxScrollTop (content − viewport) is 0 and the view is at the top');
  t.equal(first.at(-1), 3, 'then the measured height arrives on the next render');
});

// ------------------------------------------------------------------ gotchas

s.fact(F, ['**Keep `flexShrink={0}` on the content wrapper.**'], { kind: 'R', ctx: ['Keep `flexShrink={0}` on the content wrapper.'] }, async (t, q) => {
  q.tok('flexShrink={0}');
  const kept = await scrollView({ rows: 20, height: 5, shrink0: true });
  t.equal(kept.contentHeight(), 20);
  const squeezed = await scrollView({ rows: 20, height: 5, shrink0: false });
  t.notEqual(squeezed.contentHeight(), 20, 'without it the wrapper does not keep its full height');
});

s.fact(F, ['Boxes shrink by default, so without it Yoga squeezes the wrapper down to the viewport height and shrinks the rows inside it to fit.'], { kind: 'R' }, async (t) => {
  const measure = async (shrinkable) => {
    const els = [];
    let wrapper;
    const Probe = () =>
      h(Box, { height: 5, flexDirection: 'column', overflow: 'hidden' },
        h(Box, { ref: (el) => { wrapper = el; }, flexDirection: 'column', ...(shrinkable ? {} : { flexShrink: 0 }) },
          ...rows(20).map((r, i) => h(Box, { key: i, ref: (el) => { els[i] = el; } }, h(Text, null, r)))));
    const app = mount(h(Probe), { columns: 20 });
    await app.flush();
    return { wrapper: measureElement(wrapper).height, rows: els.map((el) => measureElement(el).height) };
  };
  const kept = await measure(false);
  t.equal(kept.wrapper, 20, 'with flexShrink 0 the wrapper keeps all 20 rows');
  t.ok(kept.rows.every((height) => height === 1), 'and every row keeps its one row');
  const squeezed = await measure(true);
  t.equal(squeezed.wrapper, 5, 'without it the wrapper is squeezed to the 5-row viewport');
  t.equal(squeezed.rows.reduce((a, b) => a + b, 0), 5, 'and the rows shrink so that together they fit it');
  t.ok(squeezed.rows.some((height) => height === 0), 'some of them down to nothing, which is why they overlap');
});

s.fact(F, ['The rows then overlap (20 rows in a 5-row viewport rendered `Row 4`, `Row 8`, `Row 12`, `Row 16`, `Row 20`), `content.height` equals the viewport height, `maxScrollTop` is `0`, and nothing scrolls.'], { kind: 'R' }, async (t, q) => {
  const shown = ['Row 4', 'Row 8', 'Row 12', 'Row 16', 'Row 20'].map((_, i) => q.tok(['`Row 4`', '`Row 8`', '`Row 12`', '`Row 16`', '`Row 20`'][i].replace(/`/g, '')));
  q.tok('content.height');
  q.tok('maxScrollTop');
  q.tok('0');
  const [total, viewportRows] = [Number(q.tok('20')), Number(q.tok('5'))];
  const view = await scrollView({ rows: total, height: viewportRows, shrink0: false });
  t.deepEqual(view.visible().split('\n'), shown, 'exactly these rows are visible');
  t.equal(view.contentHeight(), view.viewportClientHeight(), 'content.height equals the viewport height');
  await press(view, 'down', 10);
  t.equal(view.seen.scrollTop, 0, 'maxScrollTop is 0, so scrollTop stays 0');
  t.deepEqual(view.visible().split('\n'), shown, 'nothing scrolls');
});

s.fact(F, ['**The viewport must be a column** (`flexDirection="column"`).'], { kind: 'R', ctx: ['The viewport must be a column'] }, async (t, q) => {
  const direction = q.tok('flexDirection="column"').match(/"(.+)"/)[1];
  const column = await scrollView({ rows: 20, height: 5, viewportProps: { flexDirection: direction } });
  t.equal(column.contentHeight(), 20);
  const row = await scrollView({ rows: 20, height: 5, viewportProps: { flexDirection: 'row' } });
  t.notEqual(row.contentHeight(), 20, 'a row viewport breaks it');
});

s.fact(F, ["In the default row direction the content wrapper is stretched across the cross axis to the viewport's height, so its measured height equals the viewport's and nothing can scroll."], { kind: 'R' }, async (t) => {
  const row = await scrollView({ rows: 20, height: 5, viewportProps: { flexDirection: 'row' } });
  t.equal(row.contentHeight(), row.viewportClientHeight(), "the wrapper's measured height equals the viewport's");
  await press(row, 'down', 10);
  t.equal(row.seen.scrollTop, 0, 'so there is nothing to scroll');
});

s.fact(F, ['**Padding goes on the content wrapper, not the viewport.**'], { kind: 'R', ctx: ['Padding goes on the content wrapper, not the viewport.'] }, async (t) => {
  const onViewport = await scrollView({ rows: 20, height: 7, viewportProps: { paddingY: 1 } });
  await press(onViewport, 'down', 60);
  t.notEqual(onViewport.visible().split('\n').at(-1), 'Row 20', 'with padding on the viewport the last row can never be reached');
  const onWrapper = await scrollView({ rows: 20, height: 7, contentProps: { paddingY: 1 } });
  await press(onWrapper, 'down', 60);
  t.ok(onWrapper.visible().includes('Row 20'), 'with the padding on the content wrapper the last row is reachable');
});

s.fact(F, ["`clientWidth`/`clientHeight` exclude borders but not padding, and padding does not clip, so `content.height - clientHeight` is only exact for an unpadded viewport."], { kind: 'R' }, async (t, q) => {
  q.tok('clientWidth');
  q.tok('clientHeight');
  q.tok('content.height - clientHeight');
  const plain = await scrollView({ rows: 20, height: 7 });
  const padded = await scrollView({ rows: 20, height: 7, viewportProps: { paddingY: 1 } });
  t.equal(padded.viewportClientHeight(), plain.viewportClientHeight(), 'padding is counted in clientHeight (only borders are excluded)');
  await press(plain, 'down', 60);
  await press(padded, 'down', 60);
  t.equal(plain.visible().split('\n').at(-1), 'Row 20', 'unpadded: the formula is exact, the last row is the last row');
  t.notEqual(padded.visible().split('\n').at(-1), 'Row 20', 'padded: the formula stops short');
  t.equal(padded.visible().split('\n').length, 7, 'and the content shows through the padding: it does not clip');
});

s.fact(F, ['A border on the viewport is fine.'], { kind: 'R' }, async (t) => {
  const view = await scrollView({ rows: 20, height: 7, viewportProps: { borderStyle: 'single' } });
  await press(view, 'down', 60);
  t.ok(view.visible().includes('Row 20'), 'the last row is reachable behind a border');
  t.equal(view.viewportClientHeight(), 5, 'clientHeight excludes the two border rows, so the formula stays exact');
});

s.fact(F, ['**Variable item heights work for free** — wrapped multi-line text, nested boxes — because the content height is measured, not computed from an item count.'], { kind: 'R', ctx: ['Variable item heights work for free'] }, async (t) => {
  const view = await scrollView({
    rows: 6,
    height: 4,
    columns: 12,
    // items that wrap onto several lines
    contentProps: {},
  });
  await view.setRows(6, (i) => (i % 2 ? `item ${i + 1} wraps over lines` : `item ${i + 1}`));
  t.ok(view.contentHeight() > 6, 'wrapped items make the content taller than the item count');
  await press(view, 'down', 60);
  t.equal(view.seen.scrollTop, view.contentHeight() - view.viewportClientHeight(), 'the clamp uses the measured height');
  t.ok(view.visible().includes('item 6'), 'so the last item is reachable despite the varying heights');
});

s.fact(F, ["**Hit-testing:** a child's `left`/`top` (`useBoxMetrics`) and `x`/`y` (`measureElement`) are layout coordinates and ignore an ancestor's `contentOffset`."], { kind: 'R', ctx: ['Hit-testing:'] }, async (t, q) => {
  for (const name of ['left', 'top', 'useBoxMetrics', 'x', 'y', 'measureElement', 'contentOffset']) q.tok(name);
  const seen = {};
  const Probe = ({ offset }) => {
    const ref = React.useRef(null);
    seen.hook = useBoxMetrics(ref);
    React.useEffect(() => {
      seen.measure = measureElement(ref.current);
    });
    return h(Box, { width: 10, height: 3, overflow: 'hidden', flexDirection: 'column', contentOffsetY: offset },
      h(Box, { flexDirection: 'column', flexShrink: 0 }, h(Text, null, 'a'), h(Text, null, 'b'), h(Box, { ref }, h(Text, null, 'target'))));
  };
  const app = mount(h(Probe, { offset: 0 }));
  await app.flush();
  const atZero = { top: seen.hook.top, y: seen.measure.y };
  await app.rerender(h(Probe, { offset: 2 }));
  t.deepEqual({ top: seen.hook.top, y: seen.measure.y }, atZero, 'scrolling by 2 rows does not change top or y');
  t.equal(atZero.top, 2);
});

s.fact(F, ['Subtract the offset (`scrollTop` here) to get where it is drawn.'], { kind: 'R' }, async (t, q) => {
  q.tok('scrollTop');
  const view = await scrollView({ rows: 20, height: 5 });
  await press(view, 'down', 7);
  const drawn = view.visible().split('\n').indexOf('Row 9');
  t.equal(drawn, 8 - view.seen.scrollTop, "Row 9's layout top is 8; layout top minus scrollTop is the row it is drawn on");
});

s.fact(F, ['**Offsets are whole cells.**'], { kind: 'R', ctx: ['Offsets are whole cells.'] }, async (t) => {
  const view = (offset) => render(h(Box, { width: 4, height: 1, overflow: 'hidden', contentOffsetX: offset }, h(Box, { flexShrink: 0, width: 8 }, h(Text, null, 'abcdefgh'))));
  t.equal(view(2), 'cdef');
  t.equal(view(2.5), view(2), 'there is no half-cell scroll');
});

s.fact(F, ['Fractional values truncate toward zero and non-finite values become `0`; round `scrollTop` yourself if you animate it.'], { kind: 'R' }, async (t, q) => {
  const zero = Number(q.tok('0'));
  q.tok('scrollTop');
  const view = (offset) => render(h(Box, { width: 4, height: 1, overflow: 'hidden', contentOffsetX: offset }, h(Box, { flexShrink: 0, width: 8 }, h(Text, null, 'abcdefgh'))));
  t.equal(view(2.9), view(2), 'positive fractions truncate down');
  t.equal(view(-1.9), view(-1), 'negative fractions truncate toward zero, not down');
  t.equal(view(Number.NaN), view(zero));
  t.equal(view(Infinity), view(zero));
  t.equal(view(-Infinity), view(zero));
});

s.fact(F, ["**Wide characters:** when the viewport edge splits a wide character (CJK), Ink draws a space (keeping the cell's styles) instead of half a glyph."], { kind: 'R', ctx: ['Wide characters:'] }, async (t) => {
  const out = render(h(Box, { width: 4, overflow: 'hidden', contentOffsetX: 1 }, h(Box, { flexShrink: 0, width: 8 }, h(Text, { backgroundColor: 'red' }, '漢字ab'))));
  t.equal(stripAnsi(out), ' 字a', 'the half of 漢 that remains is drawn as a space');
  t.match(out, /\x1b\[41m \x1b\[49m|\x1b\[41m {1}/, 'and that space keeps the red background');
});

s.fact(F, ['**Horizontal scrolling** works the same with `contentOffsetX`, but give the content wrapper an explicit `width` wider than the viewport (plus `flexShrink={0}`).'], { kind: 'R', ctx: ['Horizontal scrolling'] }, async (t, q) => {
  const offX = q.tok('contentOffsetX');
  q.tok('width');
  q.tok('flexShrink={0}');
  const alpha = 'abcdefghijklmnopqrstuvwxyz';
  const view = (wrapperProps) => render(h(Box, { width: 8, overflow: 'hidden', [offX]: 5 }, h(Box, wrapperProps, h(Text, null, alpha))));
  t.equal(view({ flexShrink: 0, width: 30 }), 'fghijklm', 'with an explicit wider width the offset scrolls the line');
});

s.fact(F, ['Without it, text wraps to the viewport width instead of running off the edge.'], { kind: 'R' }, async (t) => {
  const alpha = 'abcdefghijklmnopqrstuvwxyz';
  const unsized = render(h(Box, { width: 8, overflow: 'hidden', contentOffsetX: 5 }, h(Box, { flexShrink: 0 }, h(Text, null, alpha))));
  t.ok(unsized.split('\n').length > 1, 'without the explicit width the text wraps onto several lines');
  t.ok(unsized.split('\n').every((l) => l.length <= 8), 'each at most the viewport width');
});

s.fact(F, ['Clamp to `content.width - clientWidth`.'], { kind: 'R' }, async (t, q) => {
  q.tok('content.width - clientWidth');
  const alpha = 'abcdefghijklmnopqrstuvwxyz';
  const view = (offset) => render(h(Box, { width: 8, overflow: 'hidden', contentOffsetX: offset }, h(Box, { flexShrink: 0, width: 26 }, h(Text, null, alpha))));
  t.equal(view(26 - 8), 'stuvwxyz', 'at content.width − clientWidth the last 8 columns are showing');
  t.equal(view(26 - 8 + 4), 'wxyz', 'past that Ink does not stop you — the view runs off the end, so you must clamp');
});

// ------------------------------------------------------------------ windowing

s.fact(F, ['Everything inside a `contentOffset` viewport is laid out and measured, even the rows that are clipped.'], { kind: 'R' }, async (t, q) => {
  q.tok('contentOffset');
  const seen = {};
  const Probe = () => {
    const ref = React.useRef(null);
    seen.metrics = useBoxMetrics(ref);
    return h(Box, { width: 10, height: 2, flexDirection: 'column', overflow: 'hidden', contentOffsetY: 8 },
      h(Box, { flexDirection: 'column', flexShrink: 0 }, ...rows(11).map((r, i) => h(Text, { key: i }, r)), h(Box, { ref, key: 'tail' }, h(Text, null, 'tail'))));
  };
  const app = mount(h(Probe), { columns: 20 });
  await app.flush();
  t.equal(seen.metrics.hasMeasured, true, 'a row above the visible area was still laid out and measured');
  t.equal(seen.metrics.top, 11, 'at its natural position, 11 rows down');
});

s.fact(F, ['For very large or unbounded lists, render only the slice that fits instead — **windowing**: keep a scroll index in state and slice the data before rendering.'], { kind: 'R', ctx: ['windowing'] }, async (t) => {
  const list = await windowedList({ items: Array.from({ length: 1000 }, (_, i) => `item ${i}`), height: 5 });
  t.equal(list.rendered(), 5, 'only the 5 rows that fit are rendered, not the 1000 items');
  t.equal(list.visible(), 'item 0\nitem 1\nitem 2\nitem 3\nitem 4');
  await list.app.press('\x1b[B', '\x1b[B');
  t.equal(list.visible(), 'item 2\nitem 3\nitem 4\nitem 5\nitem 6', 'the scroll index slices the data');
  t.equal(list.rendered(), 5);
});

s.fact(F, ['This version assumes one item per row.'], { kind: 'R' }, async (t) => {
  const list = await windowedList({ items: ['aa', 'bb', 'cc', 'dd', 'ee', 'ff'], height: 3 });
  t.equal(list.visible(), 'aa\nbb\ncc', 'with one-row items the slice of `height` items exactly fills the box');
});

s.fence(F, 1);
s.fact(F, ['Clamp every render — the maximum shrinks as `items` or `height` change.'], { kind: 'R' }, async (t, q) => {
  const [items, height] = [q.tok('items'), q.tok('height')];
  const all = Array.from({ length: 20 }, (_, i) => `item ${i}`);
  const list = await windowedList({ items: all, height: 5 });
  for (let i = 0; i < 40; i++) await list.app.press('\x1b[B');
  t.equal(list.visible().split('\n').at(-1), 'item 19', 'scrolled to the end');
  await list.rerender({ [items]: all.slice(0, 8), [height]: 5 });
  t.equal(list.visible(), 'item 3\nitem 4\nitem 5\nitem 6\nitem 7', 'with fewer items the offset is clamped on render, not left past the end');
  await list.rerender({ [items]: all.slice(0, 8), [height]: 7 });
  t.equal(list.visible(), 'item 1\nitem 2\nitem 3\nitem 4\nitem 5\nitem 6\nitem 7', 'and a taller window lowers the maximum the same way');
});

s.fact(F, ['Slicing by item **count** stops being exact once items have different heights (wrapped text, nested boxes): rows overlap and an item can be overwritten.'], { kind: 'R', ctx: ['count'] }, async (t) => {
  const list = await windowedList({ items: ['one', 'two words that wrap onto a second line here', 'three', 'four', 'five'], height: 4, columns: 14 });
  t.ok(!list.visible().split('\n').includes('three'), "the third item is overwritten by the wrapped item's second line, not shown on its own row");
  t.ok(list.visible().includes('d line'), 'its text is garbled with the wrapped remainder');
});

s.fact(F, ['Either keep items one row tall, or use `contentOffset`, which handles variable heights on its own, or one of `ink-scroll-view`, `ink-scroll-list` and `ink-virtual-list` (see `ink-navigation`).'], { kind: 'X', ctx: ['ink-navigation'] }, async (t, q) => {
  q.tok('contentOffset');
  const view = await scrollView({ rows: 4, height: 3, columns: 12 });
  await view.setRows(4, (i) => `item ${i + 1} wraps over lines`);
  t.ok(view.contentHeight() > 4, 'variable heights are measured by contentOffset scrolling');
  const { packages } = await loadEcosystem();
  for (const name of [q.tok('ink-scroll-view'), q.tok('ink-scroll-list'), q.tok('ink-virtual-list')]) {
    t.ok(packages.find((p) => p.name === name)?.version, `${name} is a real package`);
  }
});
