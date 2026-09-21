---
name: ink-terminal-io
description: Low-level terminal I/O hooks in Ink — useStdout/useStderr for writing outside the managed render (write-without-tearing), useStdin for the raw stdin stream and setRawMode/isRawModeSupported, useWindowSize for terminal dimensions with resize updates, and useCursor for controlling the terminal cursor position (IME support). Use when useInput/useApp aren't the right fit.
metadata:
  ink: "7.1.1"
  category: core
---

# Terminal I/O: stdout, stderr, stdin, window size, cursor

## `useStdout()` / `useStderr()`

Both return `{stdout, write}` / `{stderr, write}` — the underlying stream
(`process.stdout`/`process.stderr` by default, or whatever was passed to
`render()`) plus a `write(data: string)` helper. `write` is the key part: it
writes a plain string **without tearing Ink's managed output** — similar to
`<Static>`, but for a one-off string instead of a list of components.

```tsx
import React, {useEffect} from 'react';
import {useStdout} from 'ink';

const Example = () => {
	const {write} = useStdout();

	useEffect(() => {
		write('Hello from Ink to stdout\n');
	}, []);

	return null;
};
```

Never write to `process.stdout`/`process.stderr` directly from inside a
mounted Ink app — it will interleave with (and corrupt) Ink's own frame
writes. Use these hooks' `write`, or `console.*` (Ink intercepts console
output by default via `patchConsole`, see `ink-rendering-and-lifecycle`).

## `useStdin()`

Returns `{stdin, isRawModeSupported, setRawMode}`. Reach for this instead of
`useInput` only when you need the raw stream itself (e.g. piping it
somewhere) — for reading keypresses, `useInput`/`usePaste` (see
`ink-input-handling`) are almost always the better fit and already manage raw
mode for you.

```tsx
import React, {useEffect} from 'react';
import {useStdin} from 'ink';

const Example = () => {
	const {isRawModeSupported, setRawMode} = useStdin();

	useEffect(() => {
		if (!isRawModeSupported) return;
		setRawMode(true);
		return () => setRawMode(false);
	});

	return null;
};
```

**Always check `isRawModeSupported` before calling `setRawMode`** — it
throws when the current stdin doesn't support raw mode (piped input, some CI
runners). Use Ink's `setRawMode`, never `process.stdin.setRawMode` directly —
Ink needs to intercept Ctrl+C itself when raw mode is on.

## `useWindowSize()`

Returns `{columns, rows}` and re-renders your component on terminal resize —
the hook to reach for whenever layout needs to react to the terminal size
(see `ink-fullscreen-layouts` for full-screen/responsive layouts built on
top of it).

```tsx
import React from 'react';
import {Text, useWindowSize} from 'ink';

const Example = () => {
	const {columns, rows} = useWindowSize();

	return (
		<Text>
			{columns}x{rows}
		</Text>
	);
};
```

Note: when a terminal is resized narrower, some emulators briefly show ghost
lines depending on their own reflow behavior — not an Ink bug.

## `useCursor()`

Returns `{setCursorPosition}` — controls where the terminal cursor sits
after each render. Mainly needed for **IME (Input Method Editor) support**,
so the composing character appears at the right spot for CJK/emoji input;
most apps that don't build a custom text input never need this (`@inkjs/ui`'s
`TextInput` — see `inkjs-ui-inputs` — handles it internally).

```tsx no-check
import {useCursor} from 'ink';
import stringWidth from 'string-width';

const {setCursorPosition} = useCursor();
const prompt = '> ';
// Use string-width, not .length, so wide characters (CJK, emoji) don't
// throw off the column position.
setCursorPosition({x: stringWidth(prompt + text), y: 1});
```

`position` is `{x, y}` (0-based column, 0-based row from the top of Ink's
output) or `undefined` to hide the cursor entirely.

Related skills: ink-input-handling, ink-rendering-and-lifecycle, ink-fullscreen-layouts
