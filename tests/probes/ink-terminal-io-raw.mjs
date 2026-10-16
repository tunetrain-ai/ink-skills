// useInput next to a plain listener on the stdin stream. The parent writes terminal sequences after READY;
// a 'z' ends the run. Prints what useInput saw and what the stream itself delivered.
import React, { useEffect } from 'react';
import * as ink from 'ink';

const { render, Text, useApp, useStdin } = ink;
const useInput = ink[process.env.PROBE_HOOK ?? 'useInput'];

const h = React.createElement;
const inputs = [];
const raw = [];

const App = () => {
	const { exit } = useApp();
	const { stdin } = useStdin();
	useInput((input, key) => {
		inputs.push({ input, return: key.return });
	});
	useEffect(() => {
		const onData = (chunk) => {
			raw.push(String(chunk));
			if (String(chunk).includes('z')) exit();
		};
		stdin.on('data', onData);
		return () => stdin.off('data', onData);
	}, []);
	return h(Text, null, 'listening');
};

const app = render(h(App), { patchConsole: false });
await app.waitUntilRenderFlush();
process.stdout.write('READY\n');
await app.waitUntilExit();
process.stdout.write(`\n${JSON.stringify({ inputs, raw })}\n`);
process.exit(0);
