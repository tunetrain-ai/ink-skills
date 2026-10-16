// What useWindowSize() reports on the process's own streams. PROBE_SIZE_STREAM='process.stderr' together with
// PROBE_SIZE='{"columns":50,"rows":9}' gives that stream a size while stdout stays without one (it is a pipe).
import React from 'react';
import { render, Text, useWindowSize } from 'ink';

const h = React.createElement;
if (process.env.PROBE_SIZE) {
	const stream = process[process.env.PROBE_SIZE_STREAM.split('.')[1]];
	const { columns, rows } = JSON.parse(process.env.PROBE_SIZE);
	Object.defineProperty(stream, 'columns', { value: columns, configurable: true });
	Object.defineProperty(stream, 'rows', { value: rows, configurable: true });
}

let size;
const App = () => {
	size = useWindowSize();
	return h(Text, null, 'x');
};
const app = render(h(App), { patchConsole: false });
app.unmount();
process.stdout.write(`${JSON.stringify({ size, stdoutColumns: process.stdout.columns ?? null })}\n`);
