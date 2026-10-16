// Does an Ink app keep the process alive? PROBE_SCENARIO names what runs next to a rendered <Text>:
//   none     - nothing
//   timer    - a pending timer
//   server   - a listening TCP server (a socket handle)
//   child    - a running child process
//   promise  - a promise nobody will ever settle
//   input    - useInput on a TTY stdin (PROBE_HOOK names the hook)
//   string   - renderToString instead of render()
// A timer that does not keep the loop alive (unref'd) fires after PROBE_ALIVE_MS only if something else did;
// the last JSON line says whether it did.
import net from 'node:net';
import { spawn } from 'node:child_process';
import React from 'react';
import * as ink from 'ink';

const { render, renderToString, Text } = ink;
const h = React.createElement;
const scenario = process.env.PROBE_SCENARIO;
const useInput = ink[process.env.PROBE_HOOK ?? 'useInput'];
let alive = false;
let child;

const App = () => {
	if (scenario === 'input') useInput(() => {});
	return h(Text, null, 'frame');
};

if (scenario === 'string') renderToString(h(App));
else render(h(App));

if (scenario === 'timer') setInterval(() => {}, 100_000);
if (scenario === 'server') net.createServer().listen(0, '127.0.0.1');
if (scenario === 'child') child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 100_000)'], { stdio: 'ignore' });
if (scenario === 'promise') void new Promise(() => {});

setTimeout(() => {
	alive = true;
	child?.kill();
	process.exit(0);
}, Number(process.env.PROBE_ALIVE_MS ?? 1500)).unref();

process.on('exit', () => {
	process.stdout.write(`\n${JSON.stringify({ scenario, alive })}\n`);
});
