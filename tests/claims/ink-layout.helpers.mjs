// A port of the ScrollView component shown in references/scrollable-view.md, instrumented so
// the claims can read the measured numbers. (Claims files are not .tsx, so the JSX is written
// with h(); the structure, props and clamping are identical to the fence.)
import { h, React, ink, mount, keys } from '../lib/index.mjs';

const { Box, Text, useInput, useBoxMetrics } = ink;

/**
 * @param {{rows?: number, height?: number, shrink0?: boolean, viewportProps?: object, contentProps?: object, columns?: number}} [opts]
 */
export async function scrollView({ rows = 20, height = 5, shrink0 = true, viewportProps = {}, contentProps = {}, columns = 40 } = {}) {
  const seen = { content: null, viewport: null, scrollTop: 0 };

  const ScrollView = ({ children }) => {
    const viewportRef = React.useRef(null);
    const contentRef = React.useRef(null);
    const viewport = useBoxMetrics(viewportRef);
    const content = useBoxMetrics(contentRef);
    const [requested, setRequested] = React.useState(0);
    const maxScrollTop = Math.max(0, content.height - viewport.clientHeight);
    // clamp every render — the maximum shrinks as the content or viewport change
    const scrollTop = Math.min(requested, maxScrollTop);
    seen.content = content;
    seen.viewport = viewport;
    seen.scrollTop = scrollTop;

    useInput((_input, key) => {
      if (key.upArrow) setRequested(Math.max(0, scrollTop - 1));
      if (key.downArrow) setRequested(Math.min(maxScrollTop, scrollTop + 1));
    });

    return h(
      Box,
      { ref: viewportRef, height, flexDirection: 'column', overflow: 'hidden', contentOffsetY: scrollTop, ...viewportProps },
      h(Box, { ref: contentRef, flexDirection: 'column', ...(shrink0 ? { flexShrink: 0 } : {}), ...contentProps }, children),
    );
  };

  const makeRows = (count, render = (i) => `Row ${i + 1}`) => Array.from({ length: count }, (_, i) => h(Text, { key: i }, render(i)));
  const app = mount(h(ScrollView, null, makeRows(rows)), { columns });
  await app.flush();
  return {
    app,
    seen,
    /** Re-render the same ScrollView with a different number of rows (state is kept). */
    async setRows(count, render) {
      await app.rerender(h(ScrollView, null, makeRows(count, render)));
    },
    visible: () => app.screen(),
    contentHeight: () => seen.content.height,
    viewportClientHeight: () => seen.viewport.clientHeight,
  };
}

/** Press a named key `times` times. */
export async function press(view, name, times = 1) {
  for (let i = 0; i < times; i++) await view.app.press(keys[name]);
}

/**
 * A port of the windowing component in references/scrollable-view.md: slice the data by a scroll
 * index instead of using contentOffset.
 */
export async function windowedList({ items, height, columns = 40 }) {
  const List = ({ items, height }) => {
    const [scrollTop, setScrollTop] = React.useState(0);
    const maxScrollTop = Math.max(0, items.length - height);
    // clamp every render — the maximum shrinks as `items` or `height` change
    const clampedScrollTop = Math.min(scrollTop, maxScrollTop);
    const visible = items.slice(clampedScrollTop, clampedScrollTop + height);
    useInput((_input, key) => {
      if (key.upArrow) setScrollTop(Math.max(0, clampedScrollTop - 1));
      if (key.downArrow) setScrollTop(Math.min(maxScrollTop, clampedScrollTop + 1));
    });
    List.rendered = visible.length;
    return h(Box, { flexDirection: 'column', height }, visible.map((item, index) => h(Text, { key: clampedScrollTop + index }, item)));
  };
  const app = mount(h(List, { items, height }), { columns });
  await app.flush();
  return { app, List, visible: () => app.screen(), rendered: () => List.rendered, rerender: (next) => app.rerender(h(List, next)) };
}
