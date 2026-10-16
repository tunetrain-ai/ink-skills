// Shared fixtures for the ink-focus-management claims.
import { h, ink, mount, keys } from '../lib/index.mjs';

const { Box, Text } = ink;

/**
 * A screen of focusable items under a line that shows the focus manager's `activeId`:
 *
 *   active=<id | undefined>
 *   a*          ← an item shows `*` while it is focused
 *   b
 *
 * The names the quotes use (the hooks, the key that carries "is focused", the one that carries the
 * active id) are parameters, so a claim can pass in the tokens it proves and a changed token changes what
 * is rendered or looked up.
 *
 * @param {{useFocus?: Function, useFocusManager?: Function, focusedKey?: string, activeIdKey?: string, columns?: number}} [opts]
 */
export function focusFixture({ useFocus = ink.useFocus, useFocusManager = ink.useFocusManager, focusedKey = 'isFocused', activeIdKey = 'activeId', columns = 40 } = {}) {
  /** What the hooks returned at the latest render: `results[name]` is useFocus' return value, `manager` is useFocusManager's. */
  const live = { results: {}, manager: null };

  const Item = ({ name, options }) => {
    const result = useFocus(options);
    live.results[name] = result;
    return h(Text, null, `${name}${result[focusedKey] ? '*' : ''}`);
  };
  const Manager = () => {
    live.manager = useFocusManager();
    return h(Text, null, `active=${String(live.manager[activeIdKey])}`);
  };

  /** An item named `name`; its useFocus options default to just `{id: name}`. */
  const item = (name, options = { id: name }) => h(Item, { key: name, name, options });
  const tree = (items) => h(Box, { flexDirection: 'column' }, h(Manager), ...items);

  const lines = (app) => app.screen().split('\n');
  const api = {
    live,
    item,
    tree,
    /** Mount `items` and let the first render settle. */
    async open(items, options = {}) {
      const app = mount(tree(items), { columns, ...options });
      await app.flush();
      return app;
    },
    /** The manager's `activeId` line: the text after `active=`. */
    active: (app) => lines(app)[0].slice('active='.length),
    /** Names of the items that show as focused, in screen order. */
    focused: (app) => lines(app).slice(1).filter((line) => line.endsWith('*')).map((line) => line.slice(0, -1)),
    /** Call a manager function the way application code would, then let React settle. */
    async call(app, name, ...args) {
      live.manager[name](...args);
      await app.flush();
    },
    /** Press Tab `n` times and report the focused names after each press. */
    async tabs(app, n, key = keys.tab) {
      const seen = [];
      for (let i = 0; i < n; i++) {
        await app.press(key);
        seen.push(api.focused(app));
      }
      return seen;
    },
  };
  return api;
}
