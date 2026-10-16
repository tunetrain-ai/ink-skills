---
name: ink-async-and-suspense
description: Async data fetching in Ink with React Suspense and the concurrent render option, rendering output from a subprocess, and cleaning up timers/listeners/child processes on unmount. Use when the user needs to load data asynchronously, run a subprocess and stream its output, or fix a resource leak / "still running after exit" bug.
metadata:
  ink: "8.0.0"
  category: patterns
---

# Async data and cleanup

## Suspense requires `concurrent: true`

`Suspense` boundaries only work correctly in Ink under React Concurrent Mode
— pass `{concurrent: true}` to `render()` (see
`ink-rendering-and-lifecycle`). Without it, a component that suspends won't
resolve the way it does in a browser React app.

```tsx
import React from 'react';
import {render, Text} from 'ink';

const App = () => <Text>Hello</Text>;

render(<App />, {concurrent: true});
```

React 19's `use()` hook is the straightforward way to read a promise inside
a component that's wrapped in `<Suspense>` — pass a **cached** promise (not
a freshly created one on every render, or it'll suspend forever):

```tsx
import React, {Suspense, use} from 'react';
import {Text} from 'ink';

const fetchData = (() => {
	let cached: Promise<string> | undefined;
	return () => (cached ??= Promise.resolve('loaded data'));
})();

const Content = () => {
	const data = use(fetchData());
	return <Text>{data}</Text>;
};

const Screen = () => (
	<Suspense fallback={<Text>Loading…</Text>}>
		<Content />
	</Suspense>
);
```

For data-fetching patterns beyond a single cached promise (request
deduplication, caching across renders, request cancellation), reach for a
data-fetching library rather than hand-rolling a cache — the pattern above
is the minimum needed to see `Suspense` actually work, not a caching
strategy in itself.

## Streaming subprocess output

`child_process.spawn`'s stdout/stderr are Node readable streams — write
their chunks into component state to render them as they arrive, same as
any other async data source:

```tsx
import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import {spawn} from 'node:child_process';

const CommandOutput = ({command, args}: {command: string; args: string[]}) => {
	const [lines, setLines] = useState<string[]>([]);
	// `args` is usually an inline array literal — a new identity every render — so
	// key the effect on its contents, or the process is killed and re-spawned on
	// every render.
	const argsKey = args.join('\0');

	useEffect(() => {
		const child = spawn(command, args);
		// One buffer per stream so partial lines from stdout and stderr don't interleave.
		const pending = {stdout: '', stderr: ''};

		const append = (newLines: string[]) => {
			if (newLines.length > 0) {
				setLines((previous) => [...previous, ...newLines]);
			}
		};

		const onData = (stream: 'stdout' | 'stderr') => (chunk: Buffer) => {
			const parts = (pending[stream] + chunk.toString()).split(/\r?\n/);
			pending[stream] = parts.pop() ?? '';
			append(parts);
		};

		const onStdout = onData('stdout');
		const onStderr = onData('stderr');

		// Flush each stream's trailing unterminated line once the process is done.
		const onClose = () => {
			append([pending.stdout, pending.stderr].filter(Boolean));
			pending.stdout = '';
			pending.stderr = '';
		};

		// Without an `error` listener, a failed spawn (e.g. ENOENT) crashes the app.
		const onError = (error: Error) => {
			append([error.message]);
		};

		child.stdout.on('data', onStdout);
		child.stderr.on('data', onStderr);
		child.once('close', onClose);
		child.on('error', onError);

		return () => {
			child.stdout.off('data', onStdout);
			child.stderr.off('data', onStderr);
			child.off('close', onClose);
			child.off('error', onError);
			child.kill();
		};
	}, [command, argsKey]);

	return (
		<Box flexDirection="column">
			{lines.map((line, index) => (
				<Text key={index}>{line}</Text>
			))}
		</Box>
	);
};
```

Interactive children that need the terminal itself (`$EDITOR`, `less`, `fzf`)
are different: spawn them with `stdio: 'inherit'` inside
`useApp().suspendTerminal(async () => {…})`, which hands the terminal over and
then restores Ink's terminal state with a full redraw.

For output that's genuinely append-only and never revisited (most command
output fits this), consider `<Static>` (see `ink-static-output`) instead of
plain state — it avoids re-rendering already-printed lines as the list
grows.

## Cleanup on unmount

The `useEffect` return function above (`child.kill()`, removing listeners) is
the general pattern for anything that outlives a single render: timers,
subscriptions, child processes, open file handles. **Skipping this is the
most common cause of an Ink CLI that doesn't exit** — a live subprocess or an
active timer keeps the Node event loop occupied even after the component
tree unmounts (see `ink-rendering-and-lifecycle`'s process model). If a
`useInput` handler's cleanup isn't the culprit, check for exactly this.

Related skills: ink-rendering-and-lifecycle, ink-animation-and-performance, ink-static-output
