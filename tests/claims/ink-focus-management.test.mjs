// Claims for skills/core/ink-focus-management/SKILL.md.
import { skill, tsx, ink, h, mount, keys, React } from '../lib/index.mjs';
import { pick } from './ink-layout.helpers.mjs';
import { focusFixture } from './ink-focus-management.helpers.mjs';

const { Box, Text } = ink;
const s = skill('ink-focus-management');
const F = 'SKILL.md';

/** `name: value` → ['name', value] with the value parsed as JSON (`isActive: false`). */
const optionOf = (token) => {
  const [name, value] = token.split(': ');
  return [name, JSON.parse(value)];
};
/** `focus(id)` → ['focus', 'id']: the function's name and the name of its argument. */
const callOf = (token) => token.match(/^(\w+)\((\w*)\)$/).slice(1);

// ===================================================================== frontmatter

s.fact(F, ['Manage focus between interactive components in Ink with useFocus and useFocusManager — Tab/Shift+Tab cycling, autoFocus, isActive, focus ids for jumping directly to a component, and reading/setting the active focused component.'], { kind: 'R' }, async (t) => {
  t.equal(typeof ink.useFocus, 'function');
  t.equal(typeof ink.useFocusManager, 'function');
  const f = focusFixture();
  const app = await f.open([f.item('a'), f.item('b', { id: 'b', isActive: false }), f.item('c'), f.item('d', { id: 'd', autoFocus: true })]);
  t.deepEqual(f.focused(app), ['d'], 'autoFocus focuses a component at mount');
  t.deepEqual(await f.tabs(app, 3), [['a'], ['c'], ['d']], 'Tab cycles forward, skipping the component with isActive: false');
  t.deepEqual(await f.tabs(app, 2, keys.shiftTab), [['c'], ['a']], 'Shift+Tab cycles back');
  await f.call(app, 'focus', 'c');
  t.deepEqual(f.focused(app), ['c'], 'an id lets focus jump directly to a component');
  t.equal(f.active(app), 'c', 'and the active focused component can be read back');
});

s.guidance(F, ['Use when building forms, menus, or any UI with multiple selectable/focusable elements.'], 'a routing hint saying when to load the skill; it asserts nothing about Ink');

// ===================================================================== useFocus

s.fact(F, ['Calling `useFocus()` registers the component as "focusable"; when the user presses **Tab**, Ink moves focus through focusable components in registration order (reordering keyed components does not change it).'], { kind: 'R', ctx: ['focusable'] }, async (t, q) => {
  const useFocus = q.api(ink, 'useFocus()');
  const tab = pick(keys, q.tok('Tab').toLowerCase());
  const f = focusFixture({ useFocus });
  const notFocusable = h(Text, { key: 'plain' }, 'plain');
  const app = await f.open([f.item('a'), notFocusable, f.item('b'), f.item('c')]);
  t.deepEqual(f.focused(app), [], 'nothing is focused until the user moves focus');
  t.deepEqual(await f.tabs(app, 4, tab), [['a'], ['b'], ['c'], ['a']], 'Tab moves through the components that call useFocus, in registration order, and skips the one that does not');
  // the same three items, drawn in the opposite order: the keys are unchanged, so nothing is re-registered
  await app.rerender(f.tree([f.item('c'), f.item('b'), f.item('a')]));
  t.deepEqual(app.screen().split('\n').slice(1), ['c', 'b', 'a*'], 'the screen order is reversed, the focus stays where it was');
  t.deepEqual(await f.tabs(app, 3, tab), [['b'], ['c'], ['a']], 'but Tab still goes in registration order');
  // positive control: new keys mean new registrations, in the new order
  const remounted = focusFixture({ useFocus });
  const second = await remounted.open([remounted.item('a'), remounted.item('b'), remounted.item('c')]);
  const fresh = (name) => h(remounted.item(name).type, { key: `${name}-again`, name, options: { id: name } });
  await second.rerender(remounted.tree([fresh('c'), fresh('b'), fresh('a')]));
  t.deepEqual(await remounted.tabs(second, 3, tab), [['c'], ['b'], ['a']], 'when the components are remounted, the order they register in is the new one');
});

s.fact(F, ['Returns `{isFocused}` and `focus(id)` — the same global function as `focus` on `useFocusManager()` below, not scoped to this component.'], { kind: 'R' }, async (t, q) => {
  const focusedKey = q.tok('{isFocused}').slice(1, -1);
  const [focusName] = callOf(q.tok('focus(id)'));
  const useFocusManager = q.api(ink, 'useFocusManager()');
  const f = focusFixture({ useFocusManager, focusedKey });
  const app = await f.open([f.item('a'), f.item('b')]);
  const result = f.live.results.a;
  t.deepEqual(Object.keys(result).sort(), [focusedKey, focusName].sort(), 'it returns exactly isFocused and focus');
  t.equal(result[focusName], f.live.manager[q.tok('focus')], "focus is the very function useFocusManager's focus is");
  t.equal(f.live.results.b[focusName], result[focusName], 'the same one for every component');
  result[focusName]('b');
  await app.flush();
  t.deepEqual(f.focused(app), ['b'], 'and it is not scoped to the component that got it: a can focus b');
});

s.fact(F, ['Pressing **Esc** clears the active focus.'], { kind: 'R' }, async (t, q) => {
  const esc = pick(keys, q.tok('Esc').toLowerCase());
  const f = focusFixture();
  const app = await f.open([f.item('a'), f.item('b')]);
  await f.tabs(app, 2);
  t.deepEqual(f.focused(app), ['b']);
  await app.press('x');
  t.deepEqual(f.focused(app), ['b'], 'another key leaves it alone');
  await app.press(esc);
  t.deepEqual(f.focused(app), [], 'Esc clears it');
  t.equal(f.active(app), 'undefined');
  t.deepEqual(await f.tabs(app, 1), [['a']], 'and Tab starts again from the first component');
});

s.fence(F, 0, {
  run: async (t) => {
    const { apps } = await s.runFence(F, 0);
    const app = apps[0];
    await app.flush();
    t.equal(app.screen(), 'I am not focused');
    await app.press(keys.tab);
    t.equal(app.screen(), 'I am focused', 'Tab focuses the one component that called useFocus');
    await app.press(keys.esc);
    t.equal(app.screen(), 'I am not focused', 'Esc clears it');
  },
});

// ---- options

s.fact(F, ['`autoFocus` | `boolean` | `false` | Focus this component automatically if nothing else is focused yet.'], { kind: 'D' }, async (t, q) => {
  const prop = q.tok('autoFocus');
  const type = q.tok('boolean');
  const dflt = JSON.parse(q.tok('false'));
  t.equal(typeof dflt, type, 'the option is a boolean');
  const f = focusFixture();
  const named = (name, flag) => f.item(name, { id: name, ...(flag === undefined ? {} : { [prop]: flag }) });
  t.deepEqual(f.focused(await f.open([named('a'), named('b')])), [], 'by default nothing takes focus');
  t.deepEqual(f.focused(await f.open([named('a', dflt), named('b', dflt)])), [], 'false is the same as leaving it out');
  t.deepEqual(f.focused(await f.open([named('a'), named('b', true)])), ['b'], 'true focuses the component at mount');
  t.deepEqual(f.focused(await f.open([named('a'), named('b', true), named('c', true)])), ['b'], 'if nothing else is focused yet: with several, only the first is');
  // a component that mounts later
  const app = await f.open([named('a')]);
  await app.rerender(f.tree([named('a'), named('b', true)]));
  t.deepEqual(f.focused(app), ['b'], 'a component that mounts later takes focus when nothing is focused');
  await app.rerender(f.tree([named('a'), named('b', true), named('c', true)]));
  t.deepEqual(f.focused(app), ['b'], 'but not when something already is');
});

s.fact(F, ['`isActive` | `boolean` | `true` | Set `false` to make Tab and `focus(id)` skip this component while it stays registered: it keeps its place in the tab order and takes it again when `true` — for a temporarily-disabled input. A component that is focused when it becomes inactive loses focus.'], { kind: 'D' }, async (t, q) => {
  const prop = q.tok('isActive');
  const type = q.tok('boolean');
  const on = JSON.parse(q.tok('true'));
  const off = JSON.parse(q.tok('false'));
  const [focusName] = callOf(q.tok('focus(id)'));
  t.equal(typeof on, type, 'the option is a boolean');
  const f = focusFixture();
  const named = (name, active) => f.item(name, { id: name, ...(active === undefined ? {} : { [prop]: active }) });
  // default: active
  t.deepEqual(await f.tabs(await f.open([named('a'), named('b')]), 2), [['a'], ['b']], 'by default a component takes part');
  t.deepEqual(await f.tabs(await f.open([named('a', on), named('b', on)]), 2), [['a'], ['b']], 'true is the same as leaving it out');
  // inactive: skipped by Tab and by focus(id)
  const app = await f.open([named('a'), named('b', off), named('c')]);
  t.deepEqual(await f.tabs(app, 3), [['a'], ['c'], ['a']], 'Tab skips an inactive component');
  await f.call(app, focusName, 'b');
  t.deepEqual(f.focused(app), ['a'], 'and so does focus(id): it does nothing');
  // it stays registered: back in its own slot when it is active again
  await app.rerender(f.tree([named('a'), named('b', on), named('c')]));
  t.deepEqual(await f.tabs(app, 3), [['b'], ['c'], ['a']], 'activating it again puts it back in the middle, where it was registered');
  // positive control: a component that was removed instead loses its place
  const gone = await f.open([named('a'), named('b'), named('c')]);
  await gone.rerender(f.tree([named('a'), named('c')]));
  await gone.rerender(f.tree([named('a'), named('b'), named('c')]));
  t.deepEqual(await f.tabs(gone, 3), [['a'], ['c'], ['b']], 'a component that was unmounted and mounted again goes to the end');
  // focused, then inactive
  const focusedOne = await f.open([named('a'), named('b'), named('c')]);
  await f.call(focusedOne, focusName, 'b');
  t.deepEqual(f.focused(focusedOne), ['b']);
  await focusedOne.rerender(f.tree([named('a'), named('b', off), named('c')]));
  t.deepEqual(f.focused(focusedOne), [], 'becoming inactive while focused loses focus');
  await focusedOne.rerender(f.tree([named('a'), named('b', on), named('c')]));
  t.deepEqual(f.focused(focusedOne), [], 'and it is not given back when the component is active again');
});

s.fact(F, ['`id` | `string` | — | A stable id for jumping to this component with `focus(id)` directly, instead of cycling. Must be unique among focusable components (duplicates share one slot in the tab order).'], { kind: 'D' }, async (t, q) => {
  const prop = q.tok('id');
  const type = q.tok('string');
  const [focusName, argName] = callOf(q.tok('focus(id)'));
  t.equal(argName, prop, 'focus takes the id');
  const f = focusFixture();
  const named = (name, id) => f.item(name, { [prop]: id });
  const app = await f.open([named('a', 'first'), named('b', 'second'), named('c', 'third')]);
  await f.call(app, focusName, 'third');
  t.deepEqual(f.focused(app), ['c'], 'focus(id) jumps straight to the component with that id');
  t.equal(typeof f.live.manager.activeId, type, 'ids are strings');
  t.equal(f.active(app), 'third', 'and the id is what the manager reports');
  // a component without an id still has one: it is generated
  const anonymous = await f.open([f.item('a', {}), f.item('b', {})]);
  await anonymous.press(keys.tab);
  t.equal(typeof f.live.manager.activeId, type, 'without an id, one is generated');
  t.ok(f.live.manager.activeId.length > 0);
  // duplicates share one slot
  const dup = await f.open([named('a', 'same'), named('b', 'same'), named('c', 'other')]);
  t.deepEqual(await f.tabs(dup, 3), [['a', 'b'], ['c'], ['a', 'b']], 'two components with one id are focused together, and take a single step of the tab order');
});

s.types(F, ['`autoFocus` | `boolean` | `false` | Focus this component automatically if nothing else is focused yet.', '`isActive` | `boolean` | `true` | Set `false` to make Tab and `focus(id)` skip this component while it stays registered: it keeps its place in the tab order and takes it again when `true` — for a temporarily-disabled input. A component that is focused when it becomes inactive loses focus.', '`id` | `string` | — | A stable id for jumping to this component with `focus(id)` directly, instead of cycling. Must be unique among focusable components (duplicates share one slot in the tab order).'], tsx`
import {useFocus} from 'ink';

type Options = NonNullable<Parameters<typeof useFocus>[0]>;
export const autoFocusType: [Options['autoFocus']] extends [boolean | undefined] ? ([boolean | undefined] extends [Options['autoFocus']] ? true : false) : false = true;
export const isActiveType: [Options['isActive']] extends [boolean | undefined] ? ([boolean | undefined] extends [Options['isActive']] ? true : false) : false = true;
export const idType: [Options['id']] extends [string | undefined] ? ([string | undefined] extends [Options['id']] ? true : false) : false = true;

export const all = () => useFocus({autoFocus: true, isActive: false, id: 'first'});
export const none = () => useFocus();
export const result = () => {
	const {isFocused, focus} = useFocus();
	const focused: boolean = isFocused;
	const id = 'other';
	focus(id);
	return focused;
};
export const autoFocusIsBoolean = () => useFocus({autoFocus: 'yes'}); //! TS2322
export const isActiveIsBoolean = () => useFocus({isActive: 1}); //! TS2322
export const idIsString = () => useFocus({id: 7}); //! TS2322
`, { ctx: ['focus(id)'] });

// ===================================================================== useFocusManager

s.fact(F, ['`enableFocus()` | Re-enable focus management (on by default — only needed after `disableFocus()`).'], { kind: 'R' }, async (t, q) => {
  const f = focusFixture();
  const app = await f.open([f.item('a'), f.item('b')]);
  const enable = q.api(f.live.manager, 'enableFocus()');
  const disable = q.api(f.live.manager, 'disableFocus()');
  t.deepEqual(await f.tabs(app, 1), [['a']], 'on by default: Tab works without enableFocus() being called');
  disable();
  await app.flush();
  t.deepEqual(await f.tabs(app, 1), [[]], 'after disableFocus() Tab does nothing');
  enable();
  await app.flush();
  t.deepEqual(await f.tabs(app, 2), [['a'], ['b']], 'enableFocus() brings it back');
});

s.fact(F, ['`disableFocus()` | Disable focus management for all components: Tab and Shift+Tab stop moving focus and the active component loses focus (`focus(id)`, `focusNext()` and `focusPrevious()` still work).'], { kind: 'R' }, async (t, q) => {
  const f = focusFixture();
  const app = await f.open([f.item('a'), f.item('b'), f.item('c')]);
  const manager = f.live.manager;
  const disable = q.api(manager, 'disableFocus()');
  const [focusName] = callOf(q.tok('focus(id)'));
  const next = q.api(manager, 'focusNext()');
  const previous = q.api(manager, 'focusPrevious()');
  await f.tabs(app, 2);
  t.deepEqual(f.focused(app), ['b']);
  disable();
  await app.flush();
  t.deepEqual(f.focused(app), [], 'the active component loses focus');
  t.equal(f.active(app), 'undefined');
  t.deepEqual(await f.tabs(app, 1), [[]], 'Tab moves nothing');
  t.deepEqual(await f.tabs(app, 1, keys.shiftTab), [[]], 'nor does Shift+Tab');
  await f.call(app, focusName, 'c');
  t.deepEqual(f.focused(app), ['c'], 'focus(id) still works');
  previous();
  await app.flush();
  t.deepEqual(f.focused(app), ['b'], 'focusPrevious() still works');
  next();
  await app.flush();
  t.deepEqual(f.focused(app), ['c'], 'and focusNext()');
});

s.fact(F, ['`focusNext()` | Move to the next focusable component (what Ink calls internally on Tab). Goes to the first if none is active; wraps to the first from the last.'], { kind: 'R' }, async (t, q) => {
  const named = (f, name, active) => f.item(name, { id: name, ...(active === undefined ? {} : { isActive: active }) });
  const viaCall = focusFixture();
  const app = await viaCall.open([named(viaCall, 'a'), named(viaCall, 'b', false), named(viaCall, 'c'), named(viaCall, 'd')]);
  const next = q.api(viaCall.live.manager, 'focusNext()');
  const seen = [];
  for (let i = 0; i < 4; i++) {
    next();
    await app.flush();
    seen.push(viaCall.focused(app));
  }
  t.deepEqual(seen, [['a'], ['c'], ['d'], ['a']], 'from nothing it goes to the first, then on, and wraps from the last to the first');
  const viaTab = focusFixture();
  const other = await viaTab.open([named(viaTab, 'a'), named(viaTab, 'b', false), named(viaTab, 'c'), named(viaTab, 'd')]);
  t.deepEqual(await viaTab.tabs(other, 4), seen, 'pressing Tab does the same');
});

s.fact(F, ['`focusPrevious()` | Move to the previous component (what Ink calls on Shift+Tab). Goes to the last if none is active; wraps to the last from the first.'], { kind: 'R' }, async (t, q) => {
  const named = (f, name, active) => f.item(name, { id: name, ...(active === undefined ? {} : { isActive: active }) });
  const viaCall = focusFixture();
  const app = await viaCall.open([named(viaCall, 'a'), named(viaCall, 'b', false), named(viaCall, 'c'), named(viaCall, 'd')]);
  const previous = q.api(viaCall.live.manager, 'focusPrevious()');
  const seen = [];
  for (let i = 0; i < 4; i++) {
    previous();
    await app.flush();
    seen.push(viaCall.focused(app));
  }
  t.deepEqual(seen, [['d'], ['c'], ['a'], ['d']], 'from nothing it goes to the last, then back, and wraps from the first to the last');
  const viaKey = focusFixture();
  const other = await viaKey.open([named(viaKey, 'a'), named(viaKey, 'b', false), named(viaKey, 'c'), named(viaKey, 'd')]);
  t.deepEqual(await viaKey.tabs(other, 4, keys.shiftTab), seen, 'pressing Shift+Tab does the same');
});

s.fact(F, ['`focus(id)` | Jump directly to the component registered with that `id`. No-op if no component with that id exists or it has `isActive: false`.'], { kind: 'R' }, async (t, q) => {
  const [focusName, argName] = callOf(q.tok('focus(id)'));
  const idProp = q.tok('id');
  t.equal(argName, idProp, 'it takes the id');
  const [activeProp, off] = optionOf(q.tok('isActive: false'));
  const f = focusFixture();
  const app = await f.open([f.item('a', { [idProp]: 'one' }), f.item('b', { [idProp]: 'two', [activeProp]: off }), f.item('c', { [idProp]: 'three' })]);
  const manager = f.live.manager;
  t.equal(typeof manager[focusName], 'function');
  await f.call(app, focusName, 'three');
  t.deepEqual(f.focused(app), ['c'], 'it jumps to the component registered with that id');
  await f.call(app, focusName, 'missing');
  t.deepEqual(f.focused(app), ['c'], 'no component with that id: nothing happens');
  await f.call(app, focusName, 'two');
  t.deepEqual(f.focused(app), ['c'], 'a component that is not active: nothing happens');
  await f.call(app, focusName, 'one');
  t.deepEqual(f.focused(app), ['a'], 'while an active one is reached the same way');
});

s.fact(F, ["`activeId` | `string | undefined` — the focused component's id (auto-generated if it didn't set `id`), or `undefined` if nothing is focused."], { kind: 'R' }, async (t, q) => {
  const activeIdKey = q.tok('activeId');
  const types = q.tok('string | undefined').split(' | ');
  const idProp = q.tok('id');
  const none = pick({ undefined: undefined }, q.tok('undefined'));
  const f = focusFixture({ activeIdKey });
  const app = await f.open([f.item('a', { [idProp]: 'named' }), f.item('b', {})]);
  const read = () => f.live.manager[activeIdKey];
  const observed = [];
  t.equal(read(), none, 'undefined while nothing is focused');
  observed.push(typeof read());
  await app.press(keys.tab);
  t.equal(read(), 'named', "the focused component's id");
  observed.push(typeof read());
  await app.press(keys.tab);
  t.equal(typeof read(), 'string', 'a generated string for a component that set none');
  t.notEqual(read(), 'named');
  t.notEqual(read(), 'b', 'which is not made from the component\'s name');
  t.deepEqual(new Set(observed), new Set(types), 'the value is a string or undefined');
});

s.types(
  F,
  [
    '`enableFocus()` | Re-enable focus management (on by default — only needed after `disableFocus()`).',
    '`disableFocus()` | Disable focus management for all components: Tab and Shift+Tab stop moving focus and the active component loses focus (`focus(id)`, `focusNext()` and `focusPrevious()` still work).',
    '`focusNext()` | Move to the next focusable component (what Ink calls internally on Tab). Goes to the first if none is active; wraps to the first from the last.',
    '`focusPrevious()` | Move to the previous component (what Ink calls on Shift+Tab). Goes to the last if none is active; wraps to the last from the first.',
    '`focus(id)` | Jump directly to the component registered with that `id`. No-op if no component with that id exists or it has `isActive: false`.',
    "`activeId` | `string | undefined` — the focused component's id (auto-generated if it didn't set `id`), or `undefined` if nothing is focused.",
  ],
  tsx`
import {useFocusManager} from 'ink';

type Manager = ReturnType<typeof useFocusManager>;
type Members = 'enableFocus' | 'disableFocus' | 'focusNext' | 'focusPrevious' | 'focus' | 'activeId';
export const exactlyTheseSix: [keyof Manager] extends [Members] ? ([Members] extends [keyof Manager] ? true : false) : false = true;
export const activeIdType: [Manager['activeId']] extends [string | undefined] ? ([string | undefined] extends [Manager['activeId']] ? true : false) : false = true;

export const calls = () => {
	const manager = useFocusManager();
	const id = 'search';
	manager.enableFocus();
	manager.disableFocus();
	manager.focusNext();
	manager.focusPrevious();
	manager.focus(id);
	const active: string | undefined = manager.activeId;
	return active;
};
export const idIsAString = () => useFocusManager().focus(7); //! TS2345
export const noArguments = () => useFocusManager().focusNext('a'); //! TS2554
`,
  { ctx: ['isActive: false', 'id'] },
);

// ---- the example

s.fence(F, 1, {
  run: async (t) => {
    const { mod } = await s.runFence(F, 1);
    const f = focusFixture();
    const app = await f.open([h(mod.JumpToSearch, { key: 'jump' }), f.item('field', { id: 'field' }), f.item('searchBox', { id: 'searchBox' })]);
    await app.press('x');
    t.deepEqual(f.focused(app), [], 'other keys do nothing');
    await app.press('s');
    t.deepEqual(f.focused(app), ['searchBox'], 's focuses the component registered as searchBox');
    t.equal(f.active(app), 'searchBox');
  },
});

// ===================================================================== building a focusable list

s.fact(F, ['Give every list item a stable `id` (an `id` that changes re-registers the item at the end of the tab order and drops its focus) and let Tab/Shift+Tab cycle naturally'], { kind: 'R' }, async (t, q) => {
  const idProp = q.tok('id');
  const f = focusFixture();
  const row = (name, id = name) => f.item(name, { [idProp]: id });
  const stable = await f.open([row('a'), row('b'), row('c')]);
  await f.tabs(stable, 2);
  await stable.rerender(f.tree([row('a'), row('b'), row('c')]));
  t.deepEqual(f.focused(stable), ['b'], 'with ids that stay the same, a re-render keeps the focus');
  t.deepEqual(await f.tabs(stable, 3), [['c'], ['a'], ['b']], 'and the order');
  t.deepEqual(await f.tabs(stable, 3, keys.shiftTab), [['a'], ['c'], ['b']], 'Tab and Shift+Tab cycle through the items');
  const changing = await f.open([row('a'), row('b'), row('c')]);
  await f.tabs(changing, 2);
  t.deepEqual(f.focused(changing), ['b']);
  await changing.rerender(f.tree([row('a'), row('b', 'b-renamed'), row('c')]));
  t.deepEqual(f.focused(changing), [], 'an id that changes drops the focus of its item');
  t.deepEqual(await f.tabs(changing, 3), [['a'], ['c'], ['b']], 'and moves the item to the end of the tab order');
});

s.fact(F, ["or drive selection yourself with arrow keys plus `useInput` and track the selected index in state — the two approaches don't have to be combined."], { kind: 'R' }, async (t, q) => {
  const useInput = q.api(ink, 'useInput');
  const f = focusFixture();
  const labels = ['One', 'Two', 'Three'];
  const { useState } = React;
  const List = () => {
    const [selected, setSelected] = useState(0);
    useInput((_input, key) => {
      if (key.downArrow) setSelected((i) => Math.min(labels.length - 1, i + 1));
      if (key.upArrow) setSelected((i) => Math.max(0, i - 1));
    });
    return h(Box, { flexDirection: 'column' }, ...labels.map((label, i) => h(Text, { key: label }, `${i === selected ? '>' : ' '}${label}`)));
  };
  const app = mount(h(List), { columns: 20 });
  await app.flush();
  t.equal(app.screen(), '>One\n Two\n Three');
  await app.press(keys.down, keys.down);
  t.equal(app.screen(), ' One\n Two\n>Three', 'arrow keys plus useInput and a selected index are enough');
  await app.press(keys.tab);
  t.equal(app.screen(), ' One\n Two\n>Three', 'no focus is involved: Tab changes nothing');
  // and the other way round: with ids and Tab, the arrow keys move nothing
  const tabbed = await f.open([f.item('a'), f.item('b')]);
  await tabbed.press(keys.down);
  t.deepEqual(f.focused(tabbed), [], 'with ids and Tab alone, the arrow keys do nothing');
  t.deepEqual(await f.tabs(tabbed, 1), [['a']]);
});

s.fact(F, ["`@inkjs/ui`'s `Select` and `MultiSelect`", "already implement arrow-key selection so you don't need `useFocus` for a typical single list;"], { kind: 'R' }, async (t, q) => {
  const ui = await import(q.tok('@inkjs/ui'));
  const Select = q.api(ui, 'Select');
  const MultiSelect = q.api(ui, 'MultiSelect');
  const useFocus = q.api(ink, 'useFocus');
  const options = [{ label: 'One', value: '1' }, { label: 'Two', value: '2' }, { label: 'Three', value: '3' }];
  const f = focusFixture({ useFocus });
  const chosen = [];
  const single = mount(f.tree([h(Select, { key: 'select', options, onChange: (value) => chosen.push(value) })]), { columns: 30 });
  await single.flush();
  await single.press(keys.down, keys.enter);
  t.deepEqual(chosen, ['2'], 'Select: the arrow keys move the selection and Enter chooses');
  t.match(single.screen(), /❯ Two ✔/);
  const submitted = [];
  const multi = mount(h(MultiSelect, { options, onSubmit: (values) => submitted.push(values) }), { columns: 30 });
  await multi.flush();
  await multi.press(keys.down, keys.space, keys.down, keys.space, keys.enter);
  t.deepEqual(submitted, [['2', '3']], 'MultiSelect: arrow keys move, Space toggles, Enter submits');
  // none of it needs useFocus: with no component registered, Tab has nothing to do
  const bare = mount(f.tree([h(Select, { key: 'select', options })]), { columns: 30 });
  await bare.flush();
  await bare.press(keys.tab);
  t.equal(f.active(bare), 'undefined', 'Select never registers with the focus manager');
  const control = mount(f.tree([h(Select, { key: 'select', options }), f.item('x')]), { columns: 30 });
  await control.flush();
  await control.press(keys.tab);
  t.equal(f.active(control), 'x', 'while a component that calls useFocus does');
});

s.fact(F, ['reach for `useFocus`/`useFocusManager` when you have'], { kind: 'R' }, async (t, q) => {
  const useFocus = q.api(ink, 'useFocus');
  const useFocusManager = q.api(ink, 'useFocusManager');
  const { Select } = await import('@inkjs/ui');
  const options = [{ label: 'One', value: '1' }, { label: 'Two', value: '2' }];
  // two regions that both listen for the arrow keys
  const both = mount(h(Box, { flexDirection: 'column' }, h(Select, { options }), h(Select, { options })), { columns: 30 });
  await both.flush();
  await both.press(keys.down, keys.enter);
  t.equal(both.screen().split('\n').filter((line) => line.includes('✔')).length, 2, 'without focus management one key press reaches both of them');
  // the same two, each enabled only while it has focus
  const Region = ({ name }) => {
    const { isFocused } = useFocus({ id: name });
    return h(Box, null, h(Text, null, `${name}${isFocused ? '*' : ' '}`), h(Select, { options, isDisabled: !isFocused }));
  };
  const Active = () => h(Text, null, `active=${String(useFocusManager().activeId)}`);
  const gated = mount(h(Box, { flexDirection: 'column' }, h(Active), h(Region, { name: 'A' }), h(Region, { name: 'B' })), { columns: 30 });
  await gated.flush();
  await gated.press(keys.tab, keys.down, keys.enter);
  const lines = gated.screen().split('\n');
  t.ok(lines.slice(1, 3).some((line) => line.includes('✔')), 'with useFocus the focused region reacts');
  t.ok(lines.slice(3, 5).every((line) => !line.includes('✔')) && lines[3].startsWith('B'), 'and the other one does not');
});

s.guidance(F, ['**multiple independently-focusable regions** on screen (e.g. a form with several inputs, or a sidebar plus a main pane).'], 'a recommendation about when to reach for the hooks; the claim above shows what goes wrong without them, the examples in the parentheses are illustrations', { exempt: ['multiple independently-focusable regions'] });
