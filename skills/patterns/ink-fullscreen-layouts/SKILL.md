---
name: ink-fullscreen-layouts
description: Build full-screen, responsive Ink layouts — the alternateScreen render option for vim/htop-style apps, sizing to the terminal with useWindowSize, and split-pane layouts using flexGrow. Use when the user wants a full-screen TUI, a resizable/responsive layout, or a multi-pane app.
metadata:
  ink: "8.0.0"
  category: patterns
---

# Full-screen and responsive layouts

## The alternate screen buffer

`render(<App />, {alternateScreen: true})` renders on the terminal's
alternate screen — the same mechanism vim, htop, and less use. On exit, the
original terminal content is restored exactly as it was, and while active
the app's output never touches the user's normal scrollback.

```tsx
import React from 'react';
import {render, Text} from 'ink';

const App = () => <Text>Full-screen app</Text>;

render(<App />, {alternateScreen: true});
```

Constraints (all from `ink-rendering-and-lifecycle`'s option table, worth
repeating here since they matter most for full-screen apps): only works in
interactive mode — ignored under `interactive: false` or in a non-interactive
environment like CI or piped stdout; reusing the same `stdout` across
multiple `render()` calls without unmounting first is unsupported; teardown
output on exit is treated as disposable (not preserved or replayed).

**No scrollback while alternate screen is active** — that's the entire point
(same reason vim doesn't pollute your scrollback), but it also means a user
can't scroll up to see something that already went off the top of a
long-running full-screen app's output. If your app needs a persistent log the
user can review after exit, write it to a file, not just the terminal.

## Sizing to the terminal

`useWindowSize()` (see `ink-terminal-io`) returns `{columns, rows}` and
re-renders on resize — the building block for anything that should fill the
terminal or react to its size:

```tsx
import React from 'react';
import {Box, Text, useWindowSize} from 'ink';

const FullScreenApp = () => {
	const {rows} = useWindowSize();

	return (
		<Box flexDirection="column" height={rows}>
			<Text>Header</Text>
			<Box flexGrow={1}>
				<Text>Content fills remaining height</Text>
			</Box>
			<Text>Footer</Text>
		</Box>
	);
};
```

Setting a `<Box>`'s `height` to `rows` (or `columns` for width) is what makes
a layout genuinely full-screen rather than just as tall as its content —
`<Box>` doesn't implicitly fill the terminal on its own.

For a scrollable pane, give a fixed-height `<Box overflow="hidden">` a
`contentOffsetY` (Ink 8) and clamp it to `content.height - viewport.clientHeight`,
reading both from `useBoxMetrics()` / `measureElement()` — `clientHeight` from
the viewport, `height` from an inner content wrapper. `clientHeight` excludes
borders but not padding, so put padding on the wrapper, not the viewport. See
`ink-layout`'s scrollable-view reference.

## Split panes

A row (or column) of boxes with `flexGrow`/fixed `width` on each pane is the
whole pattern — no special "pane" component exists:

```tsx
import React from 'react';
import {Box, Text, useWindowSize} from 'ink';

const SplitPane = () => {
	const {rows} = useWindowSize();

	return (
		<Box height={rows}>
			<Box width={20} borderStyle="single" flexShrink={0}>
				<Text>Sidebar</Text>
			</Box>
			<Box flexGrow={1} borderStyle="single">
				<Text>Main content</Text>
			</Box>
		</Box>
	);
};
```

`flexShrink={0}` on the fixed-width sidebar keeps it from being squeezed if
the terminal is narrower than `sidebar width + main content's minimum` — see
`ink-layout`'s flex section for the full grow/shrink/basis model.

Related skills: ink-layout, ink-terminal-io, ink-rendering-and-lifecycle
