---
name: ink-testing
description: Test Ink components with ink-testing-library — render(), lastFrame()/frames for asserting on output, stdin.write() to simulate keypresses, unmount/cleanup, and why CI=false matters when a test needs full interactive rendering. Use when the user wants to write or debug tests for an Ink component.
metadata:
  ink: "7.1.1"
  category: patterns
---

# Testing Ink components

[`ink-testing-library`](https://github.com/vadimdemedes/ink-testing-library)
provides its own `render()` that returns fake in-memory streams instead of
attaching to a real terminal — no TTY needed, safe to run in CI.

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
| `lastFrame()` | `() => string \| undefined` | The most recently rendered frame as a plain string. `undefined` before the first render commits. |
| `frames` | `string[]` | Every frame rendered so far — assert on intermediate states, not just the final one. |
| `stdin` | fake stream | Has its own `write(data: string)` — see below. |
| `stdout` / `stderr` | fake streams | Each also has `frames`/`lastFrame()` for output written via `useStdout`/`useStderr`. |
| `rerender(tree)` | `(tree) => void` | Update props / replace the root, same as the real `Instance.rerender`. |
| `unmount()` | `() => void` | Unmount the component under test. |
| `cleanup()` | `() => void` | Tear down the fake instance entirely — also exported standalone as `cleanup` for an `afterEach`. |

## Simulating keyboard input

Write raw bytes/escape sequences to the fake `stdin` — `useInput` in the
component under test receives them exactly as if a real terminal sent them:

```tsx
import React, {useState} from 'react';
import {Text, useInput} from 'ink';
import {render} from 'ink-testing-library';

const Counter = () => {
	const [count, setCount] = useState(0);
	useInput((input, key) => {
		if (key.upArrow) setCount((c) => c + 1);
	});
	return <Text>{count}</Text>;
};

const {lastFrame, stdin} = render(<Counter />);
stdin.write('[A'); // up arrow escape sequence
```

For a single printable character, `stdin.write('a')` is enough — no escape
sequence needed. For special keys (arrows, Enter, Tab), write the raw ANSI
escape sequence the terminal would have sent; check `key.*` in your handler
matches what you expect the sequence to produce.

## Asserting on styled output

`lastFrame()` returns the output **with ANSI escape codes stripped** for
color/style props — assert on plain text content, not on `\x1b[32m` color
codes. If a test genuinely needs to verify color was applied, that's a sign
to test at a lower level (the component's props) rather than the rendered
string.

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
