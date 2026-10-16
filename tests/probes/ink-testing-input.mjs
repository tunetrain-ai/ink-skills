// What a component's useInput handler receives for a list of raw byte sequences: once through
// ink-testing-library's fake stdin, once through a real Ink render() reading a real stdin stream
// (the pipe the parent writes to). The parent passes the sequences as JSON in argv[2] and writes
// them to this process's stdin after the READY line.
import React from 'react';
import { Text, useInput, render as inkRender } from 'ink';
import { render as itlRender } from 'ink-testing-library';
import { fakeStdout } from '../lib/harness.mjs';

const h = React.createElement;
const sequences = JSON.parse(process.argv[2]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const entry = (input, key) => ({ input, key: Object.keys(key).filter((name) => key[name] === true).sort() });

// ---- through ink-testing-library --------------------------------------------------------
const viaLibrary = [];
const Listener = ({ log }) => {
  useInput((input, key) => log.push(entry(input, key)));
  return h(Text, null, 'listening');
};
const fake = itlRender(h(Listener, { log: viaLibrary }));
for (const sequence of sequences) {
  fake.stdin.write(sequence);
  await sleep(15);
}
fake.unmount();

// ---- through a real stream ----------------------------------------------------------------
const viaStream = [];
const real = inkRender(h(Listener, { log: viaStream }), { stdout: fakeStdout(), stdin: process.stdin, exitOnCtrlC: false, patchConsole: false });
console.log('READY');
const deadline = Date.now() + 8000;
while (viaStream.length < sequences.length && Date.now() < deadline) await sleep(10);
real.unmount();
console.log(JSON.stringify({ viaLibrary, viaStream }));
process.exit(0);
