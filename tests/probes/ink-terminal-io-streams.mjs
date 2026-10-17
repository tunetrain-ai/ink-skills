// Mounts a small app on the process's own stdout/stderr/stdin (no streams passed to render()) and
// reports what the stream hooks hand out. PROBE_SCENARIO picks what the app does:
//   identity  - compare the streams the hooks return with process.stdout/stderr/stdin
//   direct    - update the frame after writing to process.stdout directly
//   hook      - the same, writing through useStdout().write
//   raw       - call setRawMode(true) on a stdin that cannot do raw mode
// PROBE_STDOUT / PROBE_STDERR name the stream the claim expects the hooks to return ('process.stdout'), and
// PROBE_DIRECT the stream the 'direct' scenario writes to.
import React, { useEffect } from 'react';
import { render, Text, useStdin, useStdout, useStderr } from 'ink';

const h = React.createElement;
const scenario = process.env.PROBE_SCENARIO;
const streamOf = (reference) => process[reference.split('.')[1]];
const report = {};
let write;

const App = ({ n = 1 }) => {
	const out = useStdout();
	const err = useStderr();
	const input = useStdin();
	write = out.write;
	report.sameStdout = out.stdout === streamOf(process.env.PROBE_STDOUT ?? 'process.stdout');
	report.sameStderr = err.stderr === streamOf(process.env.PROBE_STDERR ?? 'process.stderr');
	report.sameStdin = input.stdin === process.stdin;
	report.isRawModeSupported = input.isRawModeSupported;
	useEffect(() => {
		if (scenario === 'raw') {
			try {
				input.setRawMode(true);
				report.rawThrew = null;
			} catch (error) {
				report.rawThrew = error.message;
			}
		}
	}, []);
	return h(Text, null, `frame ${n}`);
};

const app = render(h(App), { exitOnCtrlC: false });
await app.waitUntilRenderFlush();
if (scenario === 'direct') streamOf(process.env.PROBE_DIRECT).write('RAW\n');
if (scenario === 'hook') write('HOOK\n');
app.rerender(h(App, { n: 2 }));
await app.waitUntilRenderFlush();
app.unmount();
await app.waitUntilExit();
process.stdout.write(`\n${JSON.stringify(report)}\n`);
