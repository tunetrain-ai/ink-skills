---
name: ink-input-handling
description: Handle keyboard input and pasted text in Ink with useInput and usePaste — the key object (arrows, ctrl, meta, function keys), isActive to scope multiple handlers, raw mode via useStdin, and the optional kitty keyboard protocol for richer key reporting. Use for "how do I read a keypress / handle Enter / detect paste / support Ctrl+C" questions.
metadata:
  ink: "8.0.0"
  category: core
---

# Keyboard input: `useInput` and `usePaste`

## `useInput(inputHandler, options?)`

The standard way to read keyboard input — a thin, convenient wrapper over
listening for `data` events on stdin yourself (see `ink-terminal-io` for the
low-level `useStdin` escape hatch).

```tsx
import React from 'react';
import {Text, useInput} from 'ink';

const UserInput = () => {
	useInput((input, key) => {
		if (input === 'q') {
			// exit program
		}

		if (key.leftArrow) {
			// left arrow key pressed
		}
	});

	return <Text>Press q to quit</Text>;
};
```

The callback fires once **per character**. If the user pastes multi-character
text, the callback still fires only once, with the whole pasted string as
`input` — but prefer `usePaste` (below) when you need to distinguish typed
input from pasted text, since `usePaste` gets the string verbatim including
newlines.

`options.isActive` (`boolean`, default `true`) turns the handler on/off
without removing it — use this when several `useInput` hooks are mounted at
once (e.g. a modal on top of a list) so only one consumes a given keypress.
This is also **why an Ink process stays alive**: an active `useInput` keeps
the event loop occupied (see `ink-rendering-and-lifecycle`).

As of Ink 8, unrecognized control sequences (mouse reports, focus in/out,
cursor-position reports) are no longer delivered to `useInput`, and keypad
Enter now sets `key.return`.

See `references/keys.md` for the full `key` object (arrows, modifiers,
navigation, and the kitty-protocol-only fields).

## `usePaste(handler, options?)`

Fires only when the user pastes text, delivering the full string verbatim
(newlines included) — bracketed paste mode is enabled automatically while
the hook is mounted. `useInput` and `usePaste` run on **separate event
channels**: pasted text is never forwarded to a `useInput` handler while
`usePaste` is active, so you don't need to filter it out yourself.

```tsx
import React from 'react';
import {useInput, usePaste} from 'ink';

const MyInput = () => {
	useInput((input, key) => {
		// only typed characters and key events — never pasted text
		if (key.return) {
			// submit
		}
	});

	usePaste((text) => {
		// the full pasted string, verbatim
		console.log('Pasted:', text);
	});

	return null;
};
```

`options.isActive` works the same as on `useInput`.

## Raw mode

Ink automatically puts stdin in raw mode while any `useInput` hook is
mounted and active (`isActive !== false`), so keys arrive one at a time
instead of buffered per line (`usePaste` and `useFocus` do the same while
active). `useInput` and `usePaste` throw when stdin can't do raw mode (piped
input, some CI environments), so pass `isActive: isRawModeSupported` (from
`useStdin`) if your app can run without a TTY.

If you need raw mode without `useInput` (rare), use `useStdin`'s
`setRawMode` — **not** `process.stdin.setRawMode` directly, since Ink needs to
intercept Ctrl+C itself. Always check `isRawModeSupported` first; `setRawMode`
throws when the current stdin doesn't support it. See `ink-terminal-io`.

## Kitty keyboard protocol

Opt in by passing a `kittyKeyboard` object to `render()` — omit it and the
protocol is never enabled. `mode` defaults to `'auto'`, which only probes the
terminal in interactive mode with TTY stdin/stdout; `'enabled'` forces it and
requires both stdin/stdout to be TTYs; `'disabled'` never enables it. It
unlocks modifier keys and event types the base protocol can't report:
`key.super`, `key.hyper`, `key.capsLock`, `key.numLock`, and `key.eventType`
(`'press' | 'repeat' | 'release'`). Without it `super`/`hyper`/`capsLock`/
`numLock` are always `false` and `eventType` is `undefined`.

```tsx
import React from 'react';
import {render, Text} from 'ink';

const MyApp = () => <Text>Press a key</Text>;

render(<MyApp />, {
	kittyKeyboard: {
		mode: 'enabled',
		flags: ['disambiguateEscapeCodes', 'reportEventTypes'],
	},
});
```

Enabling `reportAllKeysAsEscapeCodes` (or `reportAssociatedText`, which
automatically enables it) changes what `input` contains for non-printable
keys — see `references/keys.md` for the full behavior-change list before
turning this on for anything beyond arrow/navigation keys.

Related skills: ink-getting-started, ink-focus-management, ink-terminal-io
