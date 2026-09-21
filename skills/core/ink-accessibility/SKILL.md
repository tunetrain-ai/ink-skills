---
name: ink-accessibility
description: Make an Ink UI screen-reader friendly — enable screen reader support (isScreenReaderEnabled / INK_SCREEN_READER env var), detect it at runtime with useIsScreenReaderEnabled, and use aria-label/aria-hidden/aria-role/aria-state on <Box> and <Text> to give elements semantic meaning. Use when the user asks about accessibility, screen readers, or ARIA in a terminal app.
metadata:
  ink: "7.1.1"
  category: core
---

# Accessibility

Ink implements a small, deliberately limited subset of the
[ARIA specification](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA)
for terminal screen readers.

## Enabling screen reader support

Either pass `isScreenReaderEnabled: true` to `render()`, or set the
`INK_SCREEN_READER` environment variable to `true` — useful for enabling it
without touching render call sites, e.g. in a launcher script.

```tsx no-check
render(<MyApp />, {isScreenReaderEnabled: true});
```

## `useIsScreenReaderEnabled()`

Detect it at runtime to branch your own render output — not just rely on ARIA
props:

```tsx
import React from 'react';
import {useIsScreenReaderEnabled, Text} from 'ink';

const Example = () => {
	const isScreenReaderEnabled = useIsScreenReaderEnabled();

	return (
		<Text>
			{isScreenReaderEnabled ? 'Screen reader is enabled' : 'Screen reader is disabled'}
		</Text>
	);
};
```

## ARIA props on `<Box>` and `<Text>`

| Prop | Type | Notes |
| --- | --- | --- |
| `aria-label` | `string` | Overrides what's read for this element — use when the visible text alone isn't descriptive enough. |
| `aria-hidden` | `boolean` (default `false`) | Removes the element from the screen-reader tree entirely. |
| `aria-role` | `string` | One of: `button`, `checkbox`, `combobox`, `list`, `listbox`, `listitem`, `menu`, `menuitem`, `option`, `progressbar`, `radio`, `radiogroup`, `tab`, `tablist`, `table`, `textbox`, `timer`, `toolbar`. |
| `aria-state` | `object` | Any of `busy`, `checked`, `disabled`, `expanded`, `multiline`, `multiselectable`, `readonly`, `required`, `selected` (all `boolean`). |

```tsx
import React from 'react';
import {Box, Text} from 'ink';

const Checkbox = () => (
	<Box aria-role="checkbox" aria-state={{checked: true}}>
		<Text>Accept terms and conditions</Text>
	</Box>
);
// screen reader reads: "(checked) checkbox: Accept terms and conditions"
```

`aria-label` is the tool for content that's visually compact but needs a
fuller spoken description — a progress bar rendered as colored blocks with
just "50%" as text:

```tsx
import React from 'react';
import {Box, Text} from 'ink';

const Progress = () => (
	<Box>
		<Box width="50%" height={1} backgroundColor="green" />
		<Text aria-label="Progress: 50%">50%</Text>
	</Box>
);
// screen reader reads "Progress: 50%" instead of "50%"
```

## General principles for custom components

- **Prefer semantic `aria-role`/`aria-state` over visual-only cues.** Color
  and glyphs (✔, ✗) communicate nothing to a screen reader by themselves.
- **Use `useIsScreenReaderEnabled` to render fundamentally different output**
  when the visual layout wouldn't make sense read linearly (e.g. a table —
  see `ink-tables` — probably needs a row-by-row spoken summary rather than
  reading the grid character by character).
- `@inkjs/ui` components (see the `inkjs-ui-*` skills) already wire up
  sensible ARIA roles/state internally — prefer them over hand-rolled
  interactive elements when accessibility matters and the built-in behavior
  fits.

Related skills: ink-text-styling, inkjs-ui-feedback, ink-tables
