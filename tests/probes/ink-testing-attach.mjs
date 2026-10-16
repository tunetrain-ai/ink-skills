// Renders one line with either a real Ink render() on this process's own stdout (mode "real") or
// through ink-testing-library (mode "fake"), then prints a JSON line after whatever the render
// itself wrote to stdout.
import React from 'react';
import { Text, render as inkRender } from 'ink';
import { render as itlRender } from 'ink-testing-library';

const h = React.createElement;
const mode = process.argv[2];
const stdoutWrites = [];
const original = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, ...rest) => {
  stdoutWrites.push(String(chunk));
  return original(chunk, ...rest);
};

let frame;
if (mode === 'real') {
  const app = inkRender(h(Text, null, 'drawn on the terminal'), { patchConsole: false, exitOnCtrlC: false });
  app.unmount();
} else {
  const app = itlRender(h(Text, null, 'drawn on the terminal'));
  frame = app.lastFrame();
  app.unmount();
}
process.stdout.write = original;
console.log(JSON.stringify({ mode, stdoutWrites, frame, isTTY: process.stdout.isTTY ?? null, stdinIsTTY: process.stdin.isTTY ?? null }));
process.exit(0);
