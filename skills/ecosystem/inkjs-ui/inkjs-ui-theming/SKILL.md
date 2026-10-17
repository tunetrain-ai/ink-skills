---
name: inkjs-ui-theming
description: "Theme @inkjs/ui components with ThemeProvider and extendTheme — override colors/styles per component without forking them, and read the active theme with useComponentTheme. Use when the user wants to restyle @inkjs/ui components consistently or build a custom design system on top of them."
metadata:
  ink: "8.0.0"
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
`config` **function** (returns non-style behavioral defaults — it is a
function, not a map). Writing one from scratch is rarely worth it — extend
`defaultTheme` instead (below).

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

Component style keys and what they accept aren't documented per-component —
read each component's shipped declaration,
`node_modules/@inkjs/ui/build/components/<name>/theme.d.ts`, for the exact key
names and what each style function receives and returns. They vary per
component: `Spinner` has `container` (`BoxProps`), `frame` and `label`
(`TextProps`); `Badge` has `container` (given `{color}`) and `label`.

## `useComponentTheme` — read the active theme

For a custom component built to match `@inkjs/ui`'s look, read the current
theme the same way its built-in components do:

Define the component's theme with `satisfies ComponentTheme` (the pattern
`@inkjs/ui` uses itself) so its style functions keep their precise types, then
register it with `extendTheme`:

```tsx
import React from 'react';
import {render, Text, type TextProps} from 'ink';
import {
	ThemeProvider,
	defaultTheme,
	extendTheme,
	useComponentTheme,
	type ComponentTheme,
} from '@inkjs/ui';

const bannerTheme = {
	styles: {
		text: (): TextProps => ({color: 'cyan', bold: true}),
	},
} satisfies ComponentTheme;

const Banner = ({children}: {children: string}) => {
	const {styles} = useComponentTheme<typeof bannerTheme>('Banner');
	return <Text {...styles.text()}>{children}</Text>;
};

const theme = extendTheme(defaultTheme, {components: {Banner: bannerTheme}});

render(
	<ThemeProvider theme={theme}>
		<Banner>Hello</Banner>
	</ThemeProvider>,
);
```

`useComponentTheme` just returns `theme.components[name]`: for a name that
isn't in the active theme it returns `undefined`, and destructuring that
throws — so register every custom component in the theme you pass to
`ThemeProvider`. (Without any `ThemeProvider` the context defaults to
`defaultTheme`, so built-in components need no provider to look normal.)

## Nesting providers

`ThemeProvider` is a plain context provider, so a nested one **replaces** the
theme above it for its own subtree — it does not merge with it. Build the inner
theme with `extendTheme(outerTheme, …)` to keep the outer overrides. Useful
for a single section of the UI (e.g. a "danger zone") that should render with
different component colors than the rest of the app.

Related skills: ink-text-styling, inkjs-ui-feedback, inkjs-ui-inputs
