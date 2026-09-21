---
name: ink-rendering-and-lifecycle
description: Mount and control an Ink app with render() — its options (stdout/stdin/stderr streams, exitOnCtrlC, patchConsole, maxFps, incrementalRendering, concurrent, interactive, alternateScreen, kittyKeyboard), the returned Instance (rerender, unmount, waitUntilExit, waitUntilRenderFlush, clear), renderToString for non-interactive output, and why an Ink process exits immediately with no async work. Use for "how do I exit/render/test output as a string" questions.
metadata:
  ink: "7.1.1"
  category: core
---

# Rendering and the app lifecycle

## The process model

An Ink app is an ordinary Node.js process. It stays alive only while there's
active work in the event loop — timers, pending promises, or `useInput`
listening on stdin. **A component tree with no async work renders once and
exits immediately.** If a CLI prints its UI and quits before the user can
interact, something that should be keeping the event loop alive (usually
`useInput`, see `ink-input-handling`) is missing.

Exit paths: **Ctrl+C** (enabled by default via `exitOnCtrlC`), calling
`exit()` from `useApp()` inside a component, or calling `unmount()` on the
`Instance` `render()` returns.

```tsx
import React from 'react';
import {render, Text} from 'ink';

const {waitUntilExit} = render(<Text>hi</Text>);

await waitUntilExit();
console.log('App exited');
```

## `render(tree, options?)` → `Instance`

Key options (all optional):

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `stdout` / `stdin` / `stderr` | stream | `process.std*` | Swap streams — essential for testing (see `ink-testing`). |
| `exitOnCtrlC` | `boolean` | `true` | Needed if stdin is in raw mode, since Ctrl+C is then ignored by default. |
| `patchConsole` | `boolean` | `true` | Intercepts `console.*` so it doesn't tear the live output; restored automatically before unmount's React cleanup runs. |
| `onRender` | `({renderTime}) => void` | — | Fires after each commit. Doesn't wait for the stream write — use `waitUntilRenderFlush()` for that. |
| `isScreenReaderEnabled` | `boolean` | `INK_SCREEN_READER` env var | See `ink-accessibility`. |
| `debug` | `boolean` | `false` | Each update prints as separate output instead of overwriting — useful when debugging what actually rendered. |
| `maxFps` | `number` | `30` | Caps update frequency; lower it for very-frequently-updating components to cut CPU. |
| `incrementalRendering` | `boolean` | `false` | Only redraws changed lines instead of the whole frame — reduces flicker. |
| `concurrent` | `boolean` | `false` | React Concurrent Mode — required for `Suspense`/`useTransition`/`useDeferredValue` to work correctly (see `ink-async-and-suspense`). |
| `interactive` | `boolean` | auto (CI/`stdout.isTTY` detection) | Override auto-detection only if you have your own logic. |
| `alternateScreen` | `boolean` | `false` | Full-screen apps — see `ink-fullscreen-layouts`. |
| `kittyKeyboard` | `object` | `undefined` | Enhanced key reporting — see `ink-input-handling`. |

```tsx no-check
render(<MyApp />, {concurrent: true});
```

**Important constraint:** reusing the same `stdout` across multiple `render()`
calls without unmounting first is unsupported — call `unmount()` before
changing `interactive`, `alternateScreen`, or `concurrent` on the same
stream, or create a fresh one.

## `Instance` methods

| Method | Purpose |
| --- | --- |
| `rerender(tree)` | Replace the root node or update its props. |
| `unmount()` | Manually unmount the app. |
| `waitUntilExit()` | Promise settling on unmount — resolves with `exit(value)`'s value, rejects with `exit(error)`'s error. |
| `waitUntilRenderFlush()` | Promise settling once the pending frame is actually flushed to the stream — use this (not `onRender`) to sequence code after output is visible. |
| `cleanup()` | Unmount and delete the internal instance tied to this stdout, also tearing down alt-screen state. Mostly for tests that need a fresh instance on a reused stream. |
| `clear()` | Clear the rendered output. |

```tsx
import React, {useState} from 'react';
import {render, Text} from 'ink';

const Counter = ({count}: {count: number}) => <Text>{count}</Text>;

const {rerender} = render(<Counter count={1} />);
rerender(<Counter count={2} />);
```

## `renderToString(tree, options?)` — render without a terminal

Synchronously renders to a plain string — no stdout writes, no terminal
listeners, no persistent process. Useful for docs generation, writing to a
file, or snapshot-style tests.

```tsx
import {renderToString, Text, Box} from 'ink';

const output = renderToString(
	<Box padding={1}>
		<Text color="green">Hello World</Text>
	</Box>,
);

console.log(output);
```

Only option: `columns` (`number`, default `80`) — the virtual terminal width
text wraps against. Caveats: terminal-only hooks (`useInput`, `useStdin`,
`useStdout`, `useStderr`, `useWindowSize`, `useApp`, `useFocus`,
`useFocusManager`) return no-op defaults rather than throwing. `useEffect`
runs during the synchronous render but its state updates don't show up in the
returned string (it reflects the initial render only); `useLayoutEffect`
updates **do** show up, since it fires synchronously during commit.

## CI behavior

When `CI` is set (Ink's [`is-in-ci`](https://github.com/sindresorhus/is-in-ci)
detection), Ink assumes a non-interactive terminal: only the final frame is
written on exit (no continuous overwriting, since most CI runners can't
render ANSI cursor movement), and resize events aren't listened to. Force
full interactive rendering in CI with `CI=false node my-cli.js`, or pass
`{interactive: true}` to `render()`.

Related skills: ink-getting-started, ink-testing, ink-fullscreen-layouts, ink-async-and-suspense
