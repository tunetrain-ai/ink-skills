---
name: ink-testing
description: Test Ink components with ink-testing-library — render(), lastFrame()/frames for asserting on output, stdin.write() to simulate keypresses, unmount/cleanup, and why CI=false matters when a test needs full interactive rendering. Use when the user wants to write or debug tests for an Ink component.
metadata:
  ink: "8.0.0"
  category: patterns
---

# Testing Ink components

[`ink-testing-library`](https://github.com/vadimdemedes/ink-testing-library)
provides its own `render()` that returns fake in-memory streams instead of
attaching to a real terminal — no TTY needed, safe to run in CI. Use
`ink-testing-library@^4.0.0` — it works with Ink 8 (its only peer is
`@types/react`).

```tsx
import React from 'react';
import {Text} from 'ink';
import {render} from 'ink-testing-library';

const Test = () => <Text>Hello World</Text>;
const {lastFrame} = render(<Test />);

lastFrame() === 'Hello World'; // => true
```

## What `render()` returns

| Field | Type | Purpose |
| --- | --- | --- |
| `lastFrame()` | `() => string \| undefined` | The most recent write to stdout — normally the latest frame — as the raw string Ink wrote. `undefined` before the first write. |
| `frames` | `string[]` | Every stdout write so far: the rendered frames plus any `useStdout().write` output — assert on intermediate states, not just the final one. |
| `stdin` | fake stream | Has its own `write(data: string)` — see below. |
| `stdout` | fake stream | Same array and function as the top-level `frames`/`lastFrame()` (`stdout.frames === frames`). |
| `stderr` | fake stream | Own `frames`/`lastFrame()`; captures `useStderr().write` output only. |
| `rerender(tree)` | `(tree) => void` | Update props / replace the root, same as the real `Instance.rerender`. |
| `unmount()` | `() => void` | Unmount the component under test. |
| `cleanup()` | `() => void` | Tear down this fake instance entirely. The standalone `cleanup` export does the same for every instance created so far — call it in an `afterEach`. |

## Simulating keyboard input

Write raw bytes/escape sequences to the fake `stdin` — `useInput` in the
component under test receives them exactly as if a real terminal sent them:

```tsx
import React, {useState} from 'react';
import {Text, useInput} from 'ink';
import {render} from 'ink-testing-library';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const Counter = () => {
	const [count, setCount] = useState(0);
	useInput((input, key) => {
		if (key.upArrow) setCount((c) => c + 1);
	});
	return <Text>{count}</Text>;
};

const {lastFrame, stdin} = render(<Counter />);
stdin.write('\u001B[A'); // up arrow escape sequence
await delay(0); // Ink applies input asynchronously — let it render before asserting

lastFrame() === '1'; // => true
```

For a single printable character, `stdin.write('a')` is enough — no escape
sequence needed. For special keys (arrows, Enter, Tab), write the raw ANSI
escape sequence the terminal would have sent; check `key.*` in your handler
matches what you expect the sequence to produce.

As of Ink 8, unrecognized control sequences (mouse, focus, cursor reports)
are dropped before `useInput`, so writing them via `stdin.write` in tests no
longer reaches the handler.

## Asserting on styled output

`lastFrame()` returns exactly what Ink wrote — colors appear as ANSI codes
(`\x1b[32m…`) when chalk detects color support (a local TTY, `FORCE_COLOR`).
For stable assertions run tests with `FORCE_COLOR=0` or strip ANSI first. If a
test genuinely needs to verify color was applied, that's a sign to test at a
lower level (the component's props) rather than the rendered string.

The fake `stdout` reports `columns` as `100` but has no `rows` or `isTTY`, so
`useWindowSize()` returns 100 columns and a row count taken from the host
terminal (else 24). That makes `rows`-dependent layouts vary across machines —
pass the size into such components as a prop so tests can pin it.

## `CI=false` for tests that need full interactive rendering

Ink detects `CI` and switches to writing only the final frame instead of
continuously overwriting (see `ink-rendering-and-lifecycle`). `frames`
accumulates every render regardless of interactive mode, so this rarely
matters for `ink-testing-library` tests specifically — it matters when
snapshot-testing a real `render()` (not the testing-library one) by spawning
the CLI as a subprocess in CI and expecting to see intermediate frames; set
`CI=false` in that subprocess's environment if the test depends on seeing
more than the final frame.

Related skills: ink-rendering-and-lifecycle, ink-input-handling
