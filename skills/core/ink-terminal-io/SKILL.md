---
name: ink-terminal-io
description: Low-level terminal I/O hooks in Ink — useStdout/useStderr for writing outside the managed render (write-without-tearing), useStdin for the raw stdin stream and setRawMode/isRawModeSupported, useWindowSize for terminal dimensions with resize updates, and useCursor for controlling the terminal cursor position (IME support). Use when useInput/useApp aren't the right fit.
metadata:
  ink: "8.0.0"
  category: core
---

# Terminal I/O: stdout, stderr, stdin, window size, cursor

## `useStdout()` / `useStderr()`

Both return `{stdout, write}` / `{stderr, write}` — the underlying stream
(`process.stdout`/`process.stderr` by default, or whatever was passed to
`render()`) plus a `write(data: string)` helper. `write` is the key part: it
writes a plain string **without tearing Ink's managed output** — similar to
`<Static>`, but for a one-off string instead of a list of components.

`stdout`/`stderr` are typed `NodeJS.WritableStream`, so `stdout.columns`,
`stdout.rows` and `stdout.isTTY` do not type-check. (`stdout.on('resize', …)`
still compiles, and a TTY stream emits `resize` when its window size changes.)
Use `useWindowSize()` for dimensions and resize — it re-renders on resize and
returns a size even for non-TTY output.

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
`useInput` when you need the raw stream itself (e.g. piping it somewhere) —
`useInput`/`usePaste` (see `ink-input-handling`) read keypresses and already
manage raw mode for you.

`stdin` is typed `NodeJS.ReadableStream`, so `stdin.isTTY` does not type-check:
use `isRawModeSupported` (true only when stdin is a TTY with `setRawMode`)
instead. `useInput` drops unrecognized control sequences (mouse reports, focus
in/out, cursor-position reports), and keypad Enter arrives as `key.return`; if
you need those raw sequences, read `stdin` directly.

```tsx
import React, {useEffect} from 'react';
import {useStdin} from 'ink';

const Example = () => {
	const {isRawModeSupported, setRawMode} = useStdin();

	useEffect(() => {
		if (!isRawModeSupported) return;
		setRawMode(true);
		return () => setRawMode(false);
	}, [isRawModeSupported, setRawMode]);

	return null;
};
```

**Always check `isRawModeSupported` before calling `setRawMode`** — it
throws when the current stdin doesn't support raw mode (for example piped
input). Use Ink's `setRawMode`, never `process.stdin.setRawMode` directly —
Ink needs to intercept Ctrl+C itself when raw mode is on.

## `useWindowSize()`

Returns `{columns, rows}` and re-renders your component on terminal resize.
When the stream reports no size (e.g. piped output) it falls back to the size
of `process.stderr`, then to the `COLUMNS` and `LINES` environment variables
(both must be set), then to the controlling terminal, and finally to 80×24.
Use it whenever layout needs to react to the terminal size (see
`ink-fullscreen-layouts` for full-screen/responsive layouts built on top of
it).

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

Note: when the terminal is resized narrower, Ink erases its previous frame and
redraws it at the new width.

## `useCursor()`

Returns `{setCursorPosition}` — controls where the terminal cursor sits
after each render; Ink keeps the cursor hidden unless a position is set.
Use it in a custom text input that needs the real cursor at its caret, for
example for **IME (Input Method Editor)** support; none of `@inkjs/ui`'s
components call it (see `inkjs-ui-inputs`).

```tsx
import React, {useState} from 'react';
import {Box, Text, useCursor, useInput} from 'ink';
import stringWidth from 'string-width';

const Prompt = () => {
	const [text, setText] = useState('');
	const {setCursorPosition} = useCursor();
	const prompt = '> ';

	useInput((input, key) => {
		if (key.backspace || key.delete) {
			setText((current) => current.slice(0, -1));
		} else if (input && !key.ctrl && !key.meta) {
			setText((current) => current + input);
		}
	});

	// Use string-width, not .length, so wide characters (CJK, emoji) don't
	// throw off the column position.
	setCursorPosition({x: stringWidth(prompt + text), y: 1});

	return (
		<Box flexDirection="column">
			<Text>Type here:</Text>
			<Text>
				{prompt}
				{text}
			</Text>
		</Box>
	);
};
```

`position` is `{x, y}` (0-based column, 0-based row from the top of Ink's
output) or `undefined` to hide the cursor entirely.

Related skills: ink-input-handling, ink-rendering-and-lifecycle, ink-fullscreen-layouts
