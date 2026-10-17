---
name: ink-input-handling
description: Handle keyboard input and pasted text in Ink with useInput and usePaste — the key object (arrows, ctrl, meta, shift, return, tab), isActive to scope multiple handlers, raw mode via useStdin, and the optional kitty keyboard protocol for richer key reporting. Use for "how do I read a keypress / handle Enter / detect paste / support Ctrl+C" questions.
metadata:
  ink: "8.0.0"
  category: core
---

# Keyboard input: `useInput` and `usePaste`

## `useInput(inputHandler, options?)`

The standard way to read keyboard input: Ink reads stdin for you, splits it
into keypresses and calls the handler with the typed text as `input` and a `key`
object for special keys and modifiers (see `ink-terminal-io` for the low-level
`useStdin` escape hatch).

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

The callback fires once **per keypress**. If several characters arrive in one
chunk (a paste, for instance), it still fires only once, with the whole string as
`input` — but prefer `usePaste` (below) when you need to distinguish typed input
from pasted text: a pasted `q` reaches `useInput` exactly like a typed `q`, while
`usePaste` receives every paste as one string, newlines included.

`options.isActive` (`boolean`, default `true`) turns the handler on/off
without removing it — use this when several `useInput` hooks are mounted at
once (e.g. a modal on top of a list) so only one consumes a given keypress.
An active `useInput` also keeps the process alive; with `isActive: false` and
nothing else pending, the process exits once the app has rendered (see
`ink-rendering-and-lifecycle`).

Unrecognized control sequences (mouse reports, focus in/out, cursor-position
reports) are not delivered to `useInput`, and keypad Enter sets `key.return`.

Ctrl+C exits the app before any `useInput` handler runs, unless you pass
`exitOnCtrlC: false` to `render()`: the handler then receives it as
`input === 'c'` with `key.ctrl` set.

See `references/keys.md` for the full `key` object (arrows, modifiers,
navigation, and the kitty-protocol-only fields).

## `usePaste(handler, options?)`

Fires only when the user pastes text, delivering the full string verbatim
(newlines included) — bracketed paste mode is enabled automatically while
the hook is mounted and active. `useInput` and `usePaste` run on **separate
event channels**: pasted text is never forwarded to a `useInput` handler while
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
mounted and active (`isActive !== false`); `usePaste` and `useFocus` do the same
while active. `useInput` and `usePaste` throw when stdin can't do raw mode (for
example piped input), so pass `isActive: isRawModeSupported` (from `useStdin`)
if your app can run without a TTY.

If you need raw mode without `useInput` (rare), use `useStdin`'s
`setRawMode` — **not** `process.stdin.setRawMode` directly: Ink exits on Ctrl+C
only while raw mode was enabled through its own `setRawMode`. Always check
`isRawModeSupported` first; `setRawMode` throws when the current stdin doesn't
support it. See `ink-terminal-io`.

## Kitty keyboard protocol

Opt in by passing a `kittyKeyboard` object to `render()` — omit it and the
protocol is never enabled. `mode` defaults to `'auto'`, which only probes the
terminal in interactive mode with TTY stdin/stdout; `'enabled'` forces it and
requires both stdin/stdout to be TTYs; `'disabled'` never enables it. Enabling
it makes Ink ask the terminal for kitty-style key reports (the `flags` choose how
much detail), and Ink fills `key.super`, `key.hyper`, `key.capsLock`,
`key.numLock` and `key.eventType` (`'press' | 'repeat' | 'release'`) from their
modifier and event-type fields. Ordinary typed characters and the plain arrow,
Return, Tab, Escape and Backspace sequences leave
`super`/`hyper`/`capsLock`/`numLock` `false` and `eventType` `undefined`.

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
automatically enables it) makes Ink ask for every key as an escape code, so
non-printable keys arrive with an empty `input` — see `references/keys.md` for
the full behavior-change list before turning this on for anything beyond
arrow/navigation keys.

Related skills: ink-getting-started, ink-focus-management, ink-terminal-io
