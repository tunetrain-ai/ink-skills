---
name: ink-async-and-suspense
description: Async data fetching in Ink with React Suspense and the concurrent render option, rendering output from a subprocess, and cleaning up timers/listeners/child processes on unmount. Use when the user needs to load data asynchronously, run a subprocess and stream its output, or fix a resource leak / "still running after exit" bug.
metadata:
  ink: "7.1.1"
  category: patterns
---

# Async data and cleanup

## Suspense requires `concurrent: true`

`Suspense` boundaries only work correctly in Ink under React Concurrent Mode
— pass `{concurrent: true}` to `render()` (see
`ink-rendering-and-lifecycle`). Without it, a component that suspends won't
resolve the way it does in a browser React app.

```tsx no-check
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

	useEffect(() => {
		const child = spawn(command, args);
		let buffer = '';

		const onData = (chunk: Buffer) => {
			buffer += chunk.toString();
			const parts = buffer.split('\n');
			buffer = parts.pop() ?? '';
			if (parts.length > 0) {
				setLines((previous) => [...previous, ...parts]);
			}
		};

		child.stdout.on('data', onData);
		child.stderr.on('data', onData);

		return () => {
			child.stdout.off('data', onData);
			child.stderr.off('data', onData);
			child.kill();
		};
	}, [command, args]);

	return (
		<Box flexDirection="column">
			{lines.map((line, index) => (
				<Text key={index}>{line}</Text>
			))}
		</Box>
	);
};
```

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
