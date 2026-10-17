---
name: ink-accessibility
description: Make an Ink UI screen-reader friendly — enable screen reader support (isScreenReaderEnabled / INK_SCREEN_READER env var), detect it at runtime with useIsScreenReaderEnabled, and use aria-label/aria-hidden (on <Box> and <Text>) and aria-role/aria-state (on <Box> only) to give elements semantic meaning. Use when the user asks about accessibility, screen readers, or ARIA in a terminal app.
metadata:
  ink: "8.0.0"
  category: core
---

# Accessibility

Ink supports screen readers through ARIA-style props (`aria-label`, `aria-hidden`,
`aria-role`, `aria-state`) and the `useIsScreenReaderEnabled` hook.

## Enabling screen reader support

Either pass `isScreenReaderEnabled: true` to `render()`, or set the
`INK_SCREEN_READER` environment variable to `true` — useful for enabling it
without touching render call sites, e.g. in a launcher script.

```tsx
import React from 'react';
import {render, Text} from 'ink';

const MyApp = () => <Text>Hello</Text>;

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

## ARIA props

`aria-label` and `aria-hidden` work on both `<Box>` and `<Text>`; `aria-role`
and `aria-state` are `<Box>`-only — `<Text>` silently ignores them, and
TypeScript won't flag it (hyphenated JSX attributes skip excess-property
checks). All four only change output while screen reader support is enabled.

| Prop | On | Type | Notes |
| --- | --- | --- | --- |
| `aria-label` | `<Box>`, `<Text>` | `string` | Overrides what's read for this element — use when the visible text alone isn't descriptive enough. |
| `aria-hidden` | `<Box>`, `<Text>` | `boolean` (default `false`) | Removes the element from the screen-reader tree entirely. |
| `aria-role` | `<Box>` | one of the roles listed | Spoken before the element's text, unless the parent `<Box>` has the same role. One of: `button`, `checkbox`, `combobox`, `list`, `listbox`, `listitem`, `menu`, `menuitem`, `option`, `progressbar`, `radio`, `radiogroup`, `tab`, `tablist`, `table`, `textbox`, `timer`, `toolbar`. |
| `aria-state` | `<Box>` | `object` | Any of `busy`, `checked`, `disabled`, `expanded`, `multiline`, `multiselectable`, `readonly`, `required`, `selected` (all `boolean`). |

```tsx
import React from 'react';
import {Box, Text} from 'ink';

const Checkbox = () => (
	<Box aria-role="checkbox" aria-state={{checked: true}}>
		<Text>Accept terms and conditions</Text>
	</Box>
);
// screen reader reads: "checkbox: (checked) Accept terms and conditions"
```

`aria-label` replaces an element's text with a fuller spoken description — for
example a progress bar rendered as colored blocks with just "50%" as text:

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

- **Prefer semantic `aria-role`/`aria-state` over visual-only cues.** Screen
  reader output carries no color, and a glyph (✔, ✗) is just a character in the
  text; `aria-role` and `aria-state` add the role and state as words.
- **Use `useIsScreenReaderEnabled` to render different output** when the visual
  layout doesn't read well in order: screen reader output has no borders or
  column padding and joins the children of a row with a single space (e.g. a
  table — see `ink-tables` — can render a row-by-row summary instead).
- `@inkjs/ui` components (see the `inkjs-ui-*` skills) don't set ARIA props
  themselves — wrap them in a `<Box>` with `aria-role` and `aria-state` yourself.

Related skills: ink-text-styling, inkjs-ui-feedback, ink-tables
