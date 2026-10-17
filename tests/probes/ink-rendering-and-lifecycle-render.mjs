// An app that updates its state once and unmounts, on the process's own stdout. PROBE_OPTIONS is the JSON of the
// options given to render(); the last JSON line reports what the stream saw while the app was mounted.
// PROBE_MODE=string renders with renderToString instead and reports the same listener count.
import React, { useEffect, useState } from 'react';
import * as ink from 'ink';

const { renderToString, Text } = ink;
const render = ink[process.env.PROBE_RENDER ?? 'render'];

const h = React.createElement;
const options = JSON.parse(process.env.PROBE_OPTIONS ?? '{}');

const App = () => {
	const [count, setCount] = useState(0);
	useEffect(() => setCount(1), []);
	return h(Text, null, `count ${count}`);
};

if (process.env.PROBE_MODE === 'string') {
	const output = renderToString(h(App));
	process.stdout.write(`\n${JSON.stringify({ output, resizeListeners: process.stdout.listenerCount('resize'), stdinListeners: process.stdin.listenerCount('readable') })}\n`);
	process.exit(0);
}

const app = render(h(App), options);
await app.waitUntilRenderFlush();
const resizeListeners = process.stdout.listenerCount('resize');
app.unmount();
await app.waitUntilExit();
process.stdout.write(`\n${JSON.stringify({ resizeListeners })}\n`);
