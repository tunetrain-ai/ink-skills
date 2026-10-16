---
name: ink-focus-management
description: Manage focus between interactive components in Ink with useFocus and useFocusManager — Tab/Shift+Tab cycling, autoFocus, isActive, focus ids for jumping directly to a component, and reading/setting the active focused component. Use when building forms, menus, or any UI with multiple selectable/focusable elements.
metadata:
  ink: "8.0.0"
  category: core
---

# Focus management

## `useFocus(options?)` — make a component focusable

Calling `useFocus()` registers the component as "focusable"; when the user
presses **Tab**, Ink moves focus through focusable components in registration
order (reordering keyed components does not change it). Returns `{isFocused}`
and `focus(id)` — the same global function as `focus` on `useFocusManager()`
below, not scoped to this component. Pressing **Esc** clears the active focus.

```tsx
import React from 'react';
import {render, useFocus, Text} from 'ink';

const Example = () => {
	const {isFocused} = useFocus();

	return <Text>{isFocused ? 'I am focused' : 'I am not focused'}</Text>;
};

render(<Example />);
```

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `autoFocus` | `boolean` | `false` | Focus this component automatically if nothing else is focused yet. |
| `isActive` | `boolean` | `true` | Set `false` to disable focus *without* removing the component from the tab order — for a temporarily-disabled input. |
| `id` | `string` | — | A stable id for jumping to this component with `focus(id)` directly, instead of cycling. Must be unique among focusable components (duplicates share one slot in the tab order). |

## `useFocusManager()` — control focus programmatically

| Method | Purpose |
| --- | --- |
| `enableFocus()` | Re-enable focus management (on by default — only needed after `disableFocus()`). |
| `disableFocus()` | Disable focus management for all components; the active component loses focus. |
| `focusNext()` | Move to the next focusable component (what Ink calls internally on Tab). Goes to the first if none is active; wraps to the first from the last. |
| `focusPrevious()` | Move to the previous component (what Ink calls on Shift+Tab). Goes to the last if none is active; wraps to the last from the first. |
| `focus(id)` | Jump directly to the component registered with that `id`. No-op if no component with that id exists or it has `isActive: false`. |
| `activeId` | `string \| undefined` — the focused component's id (auto-generated if it didn't set `id`), or `undefined` if nothing is focused. |

```tsx
import React from 'react';
import {useFocusManager, useInput} from 'ink';

const JumpToSearch = () => {
	const {focus} = useFocusManager();

	useInput((input) => {
		if (input === 's') {
			focus('searchBox');
		}
	});

	return null;
};
```

## Building a focusable list

Give every list item a stable `id` and let Tab/Shift+Tab cycle naturally, or
drive selection yourself with arrow keys plus `useInput` and track the
selected index in state — the two approaches don't have to be combined.
`@inkjs/ui`'s `Select` and `MultiSelect` (see `inkjs-ui-inputs`) already
implement arrow-key selection so you don't need `useFocus` for a typical
single list; reach for `useFocus`/`useFocusManager` when you have **multiple
independently-focusable regions** on screen (e.g. a form with several
inputs, or a sidebar plus a main pane).

Related skills: ink-input-handling, inkjs-ui-inputs, ink-forms, ink-navigation
