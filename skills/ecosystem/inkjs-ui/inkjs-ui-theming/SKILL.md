---
name: inkjs-ui-theming
description: "Theme @inkjs/ui components with ThemeProvider and extendTheme — override colors/styles per component without forking them, and read the active theme with useComponentTheme. Use when the user wants to restyle @inkjs/ui components consistently or build a custom design system on top of them."
metadata:
  ink: "7.1.1"
  category: ecosystem
---

# `@inkjs/ui` theming

Every `@inkjs/ui` component reads its styles from a shared `Theme` via
React context — you don't pass style props to individual components, you
override the theme they all read from.

## `ThemeProvider`

Wrap a subtree to apply a theme to every `@inkjs/ui` component inside it:

```tsx
import React from 'react';
import {ThemeProvider, defaultTheme, Badge} from '@inkjs/ui';

const App = () => (
	<ThemeProvider theme={defaultTheme}>
		<Badge color="cyan">Themed</Badge>
	</ThemeProvider>
);
```

A `Theme` is `{components: Record<string, ComponentTheme>}` — keyed by
component name, each with an optional `styles` map (functions returning
style objects, given the component's current props/state) and an optional
`config` map (non-style behavioral defaults). Writing one from scratch is
rarely worth it — extend `defaultTheme` instead (below).

## `extendTheme` — override just what you need

`extendTheme(originalTheme, newTheme)` deep-merges a partial theme onto an
existing one — the standard way to tweak a couple of colors without
redefining every component's full style function:

```tsx
import React from 'react';
import {ThemeProvider, defaultTheme, extendTheme, Spinner} from '@inkjs/ui';

const customTheme = extendTheme(defaultTheme, {
	components: {
		Spinner: {
			styles: {
				frame: () => ({color: 'magenta'}),
			},
		},
	},
});

const App = () => (
	<ThemeProvider theme={customTheme}>
		<Spinner label="Loading" />
	</ThemeProvider>
);
```

Component style keys and what they accept aren't part of the public
top-level API surface documented per-component — inspect
`@inkjs/ui`'s own `components/<name>/theme.ts` source (or your editor's
type info on `ComponentTheme['styles']`) for the exact key names a given
component reads, since they vary per component (e.g. `Spinner`'s `frame`
vs. `Badge`'s `container`/`label`).

## `useComponentTheme` — read the active theme

For a custom component built to match `@inkjs/ui`'s look, read the current
theme the same way its built-in components do:

```tsx no-check
import {useComponentTheme} from '@inkjs/ui';

const theme = useComponentTheme('Badge');
```

## Nesting providers

`ThemeProvider`s nest normally — a `ThemeProvider` deeper in the tree
overrides the one above it for its own subtree only. Useful for a single
section of the UI (e.g. a "danger zone") that should render with different
component colors than the rest of the app.

Related skills: ink-text-styling, inkjs-ui-feedback, inkjs-ui-inputs
