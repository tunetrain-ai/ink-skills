// An app on a real terminal (run it through ink-terminal-io-pty.py): it prints a line per event so a
// claim can wait for it. PROBE_SCENARIO:
//   size   - a component showing useWindowSize(); also logs every 'resize' event of process.stdout
//   keys   - useInput logging each key; 'q' exits
//   idle   - no input handling at all, just a timer that keeps the process alive
//   direct - puts the terminal into raw mode with process.stdin.setRawMode itself (Ink knows nothing about it)
// PROBE_EVENT is the stream event the 'size' scenario listens for; PROBE_OPTIONS is the JSON of the options for render().
import React from 'react';
import { render, Text, useApp, useInput, useWindowSize } from 'ink';

const h = React.createElement;
const scenario = process.env.PROBE_SCENARIO;
const log = (line) => process.stderr.write(`@@ ${line}\n`);

const Size = () => {
	const { columns, rows } = useWindowSize();
	return h(Text, null, `size ${columns}x${rows}`);
};
const Keys = () => {
	const { exit } = useApp();
	useInput((input, key) => {
		if (input === 'q') exit();
		else log(`key ${key.ctrl ? 'ctrl-' : ''}${input}`);
	});
	return h(Text, null, 'keys');
};
const Idle = () => h(Text, null, 'idle');

const tree = { size: Size, keys: Keys, idle: Idle, direct: Idle }[scenario];
if (scenario === 'size') process.stdout.on(process.env.PROBE_EVENT ?? 'resize', () => log(`resize ${process.stdout.columns}x${process.stdout.rows}`));
if (scenario === 'direct') {
	process.stdin.setRawMode(true);
	process.stdin.on('data', (chunk) => {
		log(`data ${[...String(chunk)].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ')}`);
		if (String(chunk) === 'q') process.exit(0);
	});
}
const app = render(h(tree), { patchConsole: false, ...JSON.parse(process.env.PROBE_OPTIONS ?? '{}') });
if (scenario === 'idle' || scenario === 'direct') setInterval(() => {}, 1000);
log(`ready tty=${process.stdout.isTTY === true} raw=${process.stdin.isRaw === true}`);
await app.waitUntilExit();
log('exited');
