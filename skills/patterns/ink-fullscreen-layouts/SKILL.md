---
name: ink-fullscreen-layouts
description: Build full-screen, responsive Ink layouts — the alternateScreen render option, sizing to the terminal with useWindowSize, and split-pane layouts using flexGrow. Use when the user wants a full-screen TUI, a resizable/responsive layout, or a multi-pane app.
metadata:
  ink: "8.0.0"
  category: patterns
---

# Full-screen and responsive layouts

## The alternate screen buffer

`render(<App />, {alternateScreen: true})` renders on the terminal's
alternate screen: Ink switches to it (`\x1b[?1049h`) before drawing anything and
back (`\x1b[?1049l`) when the app exits. Everything the app draws lies between
the two, so none of it reaches the normal screen or its scrollback.

```tsx
import React from 'react';
import {render, Text} from 'ink';

const App = () => <Text>Full-screen app</Text>;

render(<App />, {alternateScreen: true});
```

Constraints (see `ink-rendering-and-lifecycle`'s option table): it only works
in interactive mode — ignored under `interactive: false` or in a
non-interactive environment like CI or piped stdout; calling `render()` again
with the same `stdout` before unmounting reuses the first instance, ignores the
second call's options and warns on stderr; text a component writes with
`useStdout().write` while the app unmounts is dropped, not replayed onto the
normal screen.

**Ink writes nothing to the normal screen** while the alternate screen is
active or after it exits, so nothing the app drew is left behind. If your app
needs a persistent log the user can review after exit, write it to a file, not
just the terminal.

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

Setting a `<Box>`'s `height` to `rows` is what makes a layout genuinely
full-screen rather than just as tall as its content — `<Box>` doesn't
implicitly fill the terminal's height on its own (a root `<Box>` already spans
its `columns`).

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

`flexShrink={0}` on the fixed-width sidebar keeps it at its width when the
terminal is narrower than the sidebar plus the main pane's content — without it
both panes shrink and the sidebar is squeezed. See the Flex section of
`ink-layout`'s `references/box-props.md` for the full grow/shrink/basis model.

Related skills: ink-layout, ink-terminal-io, ink-rendering-and-lifecycle
