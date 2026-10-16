// Shared fixtures for the ink-static-output claims.
import { h, React, ink, mount } from '../lib/index.mjs';

/** Mode switches (synchronized output, cursor visibility) that frame every write; they say nothing about content. */
export const withoutModes = (bytes) => bytes.replace(/\x1b\[\?(?:2026[hl]|25[lh])/g, '');

/** Lines of a screen that are not the live line, i.e. what <Static> has printed above it. */
export const printedLines = (screen) => screen.split('\n').filter((line) => !line.startsWith('live '));

/**
 * A <Static> list above one live line (`live <tick>`).
 *
 * `calls` collects every ([item, index]) the render function is called with, `events` the mounts and
 * unmounts of the component each item renders. The names of the props are parameters, so a claim can
 * pass in the ones its quote names.
 *
 * @param {{Static?: Function, itemsProp?: string, childrenProp?: string, keyProp?: string, style?: object,
 *   items?: unknown[], label?: (item: unknown) => string, columns?: number, staticLast?: boolean}} [opts]
 */
export async function staticList({ Static = ink.Static, itemsProp = 'items', childrenProp = 'children', keyProp = 'key', style, items = [], label = String, columns = 40, staticLast = false } = {}) {
  const { Box, Text } = ink;
  const calls = [];
  const events = [];

  const Line = ({ text }) => {
    React.useEffect(() => {
      events.push(`mount ${text}`);
      return () => events.push(`unmount ${text}`);
    }, []);
    return h(Text, null, text);
  };

  const element = (nextItems, tick = 0) => {
    const list = h(Static, {
      [itemsProp]: nextItems,
      ...(style ? { style } : {}),
      [childrenProp]: (item, index) => {
        calls.push([item, index]);
        return h(Line, { [keyProp]: index, text: label(item) });
      },
    });
    const live = h(Text, null, `live ${tick}`);
    return h(Box, { flexDirection: 'column' }, ...(staticLast ? [live, list] : [list, live]));
  };

  const app = mount(element(items), { columns });
  await app.flush();
  return {
    app,
    calls,
    events,
    element,
    /** Re-render with `nextItems` (and a live line showing `tick`); resolves to the lines printed so far. */
    async show(nextItems, tick = 0) {
      await app.rerender(element(nextItems, tick));
      return printedLines(app.screen());
    },
    printed: () => printedLines(app.screen()),
    /** The render function's calls since the last time this was asked. */
    newCalls() {
      return calls.splice(0);
    },
  };
}
