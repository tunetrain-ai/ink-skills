// A port of the ScrollView component shown in references/scrollable-view.md, instrumented so
// the claims can read the measured numbers. (Claims files are not .tsx, so the JSX is written
// with h(); the structure, props and clamping are identical to the fence, which the
// scrollable-view claims run side by side with this port.)
//
// Every name the skill text uses (a prop, a hook, a state variable) is handed in by the claim from
// the quote it proves, so that changing a name in the text changes what is rendered or looked up.
import { h, React, ink, mount, keys } from '../lib/index.mjs';

const { Box, Text, useInput } = ink;

/**
 * The value a table or a quote names, looked up in a table of expected outcomes. A value that is not
 * in the table (a token whose text changed, an unknown member of a union) throws, so the claim
 * fails instead of passing on whatever the unknown value happens to render.
 */
export function pick(table, value) {
  if (!Object.hasOwn(table, value)) throw new Error(`"${value}" is not one of ${Object.keys(table).map((k) => `"${k}"`).join(', ')}`);
  return table[value];
}

/** `scope.a.b` for the path "a.b"; a missing step throws. */
export function resolvePath(scope, path) {
  return path.split('.').reduce((node, key) => {
    if (node === null || typeof node !== 'object' || !(key in node)) throw new Error(`"${path}": no "${key}" to read`);
    return node[key];
  }, scope);
}

/** `name="value"` → ['name', 'value']; anything else throws. */
export function propAndValue(token) {
  const m = token.match(/^(\w+)="([^"]*)"$/);
  if (!m) throw new Error(`not a name="value" prop: ${token}`);
  return [m[1], m[2]];
}

/** `name={expression}` → ['name', 'expression']; anything else throws. */
export function propAndExpression(token) {
  const m = token.match(/^(\w+)=\{([^{}]*)\}$/);
  if (!m) throw new Error(`not a name={expression} prop: ${token}`);
  return [m[1], m[2]];
}

/** `flexShrink={0}` → {flexShrink: 0}: the prop with its literal value. */
export function numericProp(token) {
  const [name, expression] = propAndExpression(token);
  const value = Number(expression);
  if (!Number.isFinite(value)) throw new Error(`not a numeric literal: ${token}`);
  return { [name]: value };
}

const DEFAULT_VIEWPORT = { overflow: 'hidden', flexDirection: 'column' };
const DEFAULT_CONTENT = { flexDirection: 'column', flexShrink: 0 };

/**
 * @param {{rows?: number, height?: number, columns?: number, step?: number, shrink0?: boolean,
 *   viewport?: object, content?: object, viewportProps?: object, contentProps?: object,
 *   offsetProp?: string, useBoxMetrics?: Function, footer?: string}} [opts]
 *   viewport / content: replace the pattern's own props (overflow + column for the viewport, column +
 *   flexShrink 0 for the content wrapper); viewportProps / contentProps: added on top.
 *   offsetProp: the viewport prop that carries scrollTop. useBoxMetrics: the hook that measures both.
 *   footer: a line of text rendered below the viewport, so that content leaking out of it is visible.
 */
export async function scrollView({
  rows = 20,
  height = 5,
  columns = 40,
  step = 1,
  shrink0 = true,
  viewport = DEFAULT_VIEWPORT,
  content = DEFAULT_CONTENT,
  viewportProps = {},
  contentProps = {},
  offsetProp = 'contentOffsetY',
  useBoxMetrics = ink.useBoxMetrics,
  footer,
} = {}) {
  // `renders` keeps what each render computed, in order; `scrollTop`, `maxScrollTop`, `content`
  // and `viewport` mirror the latest one under the names the component uses for them
  const seen = { content: null, viewport: null, scrollTop: 0, maxScrollTop: 0, renders: [] };
  const contentStyle = shrink0 ? content : Object.fromEntries(Object.entries(content).filter(([name]) => name !== 'flexShrink'));

  const ScrollView = ({ children }) => {
    const viewportRef = React.useRef(null);
    const contentRef = React.useRef(null);
    const viewportMetrics = useBoxMetrics(viewportRef);
    const contentMetrics = useBoxMetrics(contentRef);
    const [requested, setRequested] = React.useState(0);
    const maxScrollTop = Math.max(0, contentMetrics.height - viewportMetrics.clientHeight);
    // clamp every render — the maximum shrinks as the content or viewport change
    const scrollTop = Math.min(requested, maxScrollTop);
    seen.content = contentMetrics;
    seen.viewport = viewportMetrics;
    seen.scrollTop = scrollTop;
    seen.maxScrollTop = maxScrollTop;
    seen.renders.push({ content: contentMetrics, viewport: viewportMetrics, scrollTop, maxScrollTop });

    useInput((_input, key) => {
      if (key.upArrow) setRequested(Math.max(0, scrollTop - step));
      if (key.downArrow) setRequested(Math.min(maxScrollTop, scrollTop + step));
    });

    return h(
      Box,
      { ref: viewportRef, height, ...viewport, [offsetProp]: scrollTop, ...viewportProps },
      h(Box, { ref: contentRef, ...contentStyle, ...contentProps }, children),
    );
  };

  const makeRows = (count, render = (i) => `Row ${i + 1}`) => Array.from({ length: count }, (_, i) => h(Text, { key: i }, render(i)));
  const tree = (count, render) => {
    const view = h(ScrollView, null, makeRows(count, render));
    return footer === undefined ? view : h(Box, { flexDirection: 'column' }, view, h(Text, null, footer));
  };
  const app = mount(tree(rows), { columns });
  await app.flush();
  return {
    app,
    seen,
    /** Re-render the same ScrollView with a different number of rows (state is kept). */
    async setRows(count, render) {
      await app.rerender(tree(count, render));
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
