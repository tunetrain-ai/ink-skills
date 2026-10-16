---
name: ink-rendering-and-lifecycle
description: Mount and control an Ink app with render() — its options (stdout/stdin/stderr streams, exitOnCtrlC, patchConsole, maxFps, incrementalRendering, concurrent, interactive, alternateScreen, kittyKeyboard), the returned Instance (rerender, unmount, waitUntilExit, waitUntilRenderFlush, clear), renderToString for non-interactive output, and why an Ink process exits immediately with no async work. Use for "how do I exit/render/test output as a string" questions.
metadata:
  ink: "8.0.0"
  category: core
---

# Rendering and the app lifecycle

Requires Node >=22 and `react` / `@types/react` >=19.3.0.

## The process model

An Ink app stays alive only while there's active work in the event loop —
timers, open handles such as sockets or child processes, or `useInput`
listening on stdin; a pending promise on its own does not keep it alive.
**A component tree with no async work renders once and exits immediately.** If
a CLI prints its UI and quits before the user can interact, nothing is keeping
the event loop alive — add what the app is waiting for, for example `useInput`
(see `ink-input-handling`).

Exit paths: **Ctrl+C** (enabled by default via `exitOnCtrlC`), calling
`exit()` from `useApp()` inside a component, or calling `unmount()` on the
`Instance` `render()` returns.

To run an interactive child that needs the terminal itself (an editor, a pager)
without exiting, `useApp()` also returns `suspendTerminal(callback)`: it hands
the terminal over for the callback's duration, then restores Ink's terminal
state and forces a full redraw (see `ink-async-and-suspense` for the spawn
recipe).

```tsx
import React from 'react';
import {render, Text} from 'ink';

const {waitUntilExit} = render(<Text>hi</Text>);

await waitUntilExit();
console.log('App exited');
```

Top-level `await` needs an ES module: an `.mjs` entry point, `"type": "module"`
in `package.json`, or a `.js` file that Node detects as ESM because of the
top-level `await`. In a `.cjs` file, or in CommonJS that uses `require`, wrap it
in an `async` function.

## `render(tree, options?)` → `Instance`

`options` is `Writable | RenderOptions` — passing a writable stream is
shorthand for `{stdout}`. Key options (all optional):

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `stdout` / `stderr` | `NodeJS.WritableStream` | `process.stdout` / `process.stderr` | Swap streams, for example to capture output in tests (see `ink-testing`). Any `Writable` works; no TTY type is required. |
| `stdin` | `NodeJS.ReadableStream` | `process.stdin` | Any `Readable` works for rendering. Raw mode, which `useInput` needs, requires a TTY with `setRawMode` and throws without one. |
| `exitOnCtrlC` | `boolean` | `true` | Exits on Ctrl+C. Needed in raw mode, where the terminal no longer turns Ctrl+C into SIGINT. |
| `patchConsole` | `boolean` | `true` | Intercepts `console.*` so it doesn't tear the live output; restored automatically before unmount's React cleanup runs. |
| `onRender` | `({renderTime}) => void` | — | Fires after each frame Ink renders, with `renderTime` in milliseconds; commits that land within one `maxFps` interval share a frame. Doesn't wait for the stream write — use `waitUntilRenderFlush()` for that. |
| `isScreenReaderEnabled` | `boolean` | `INK_SCREEN_READER=true` in the environment | See `ink-accessibility`. |
| `debug` | `boolean` | `false` | Each update is written as a separate full frame instead of overwriting the previous one. |
| `maxFps` | `number` | `30` | Caps how often frames are written: at most `maxFps` per second. |
| `incrementalRendering` | `boolean` | `false` | Only redraws changed lines, and skips each changed line's unchanged prefix when safe. Lines with unsupported terminal controls fall back to a whole-line redraw. |
| `concurrent` | `boolean` | `false` | React Concurrent Mode — React schedules rendering itself, so `render()` and `rerender()` return before the new output is written; by default they flush it synchronously (see `ink-async-and-suspense`). |
| `interactive` | `boolean` | auto (not in CI and `stdout.isTTY` is true) | Overrides the auto-detection. |
| `alternateScreen` | `boolean` | `false` | Renders on the terminal's alternate screen, for full-screen apps — see `ink-fullscreen-layouts`. |
| `kittyKeyboard` | `KittyKeyboardOptions` | `undefined` | Asks the terminal for the kitty keyboard protocol (enhanced key reporting) — see `ink-input-handling`. Enabling the `reportAssociatedText` flag automatically turns on `reportAllKeysAsEscapeCodes`. |

```tsx
import React from 'react';
import {render, Text} from 'ink';

const MyApp = () => <Text>Hello</Text>;

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
| `cleanup()` | Unmount and delete the internal instance tied to this stdout, also tearing down alt-screen state, so the same stream can be rendered to again with different options. |
| `clear()` | Clear the rendered output. |

```tsx
import React from 'react';
import {render, Text} from 'ink';

const Counter = ({count}: {count: number}) => <Text>{count}</Text>;

const {rerender} = render(<Counter count={1} />);
rerender(<Counter count={2} />);
```

## `renderToString(tree, options?)` — render without a terminal

Synchronously renders to a string — no stdout writes, no terminal
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
`useStdout`, `useStderr`, `useApp`, `useFocus`, `useFocusManager`) return
no-op defaults rather than throwing. `useWindowSize` is not one of them: it
reads the real `process.stdout` size (with the fallbacks described in
`ink-terminal-io`) and ignores the `columns` option, so size a
`renderToString` layout with explicit widths or `columns`, not `useWindowSize`.
`useEffect` runs during the synchronous render but its state updates don't
show up in the returned string (it reflects the initial render only);
`useLayoutEffect` updates **do** show up, since it fires synchronously during
commit.

## CI behavior

When `CI` is set (Ink's [`is-in-ci`](https://github.com/sindresorhus/is-in-ci)
detection), Ink assumes a non-interactive terminal: only the final frame is
written on exit (no continuous overwriting), and resize events aren't listened
to. Force full interactive rendering in CI with `CI=false node my-cli.js`, or
pass `{interactive: true}` to `render()`.

Related skills: ink-getting-started, ink-testing, ink-fullscreen-layouts, ink-async-and-suspense
