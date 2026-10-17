// What <InkPictureProvider> does with stdin while it detects the terminal. Runs on a fake TTY
// (the provider only queries when process.stdin and process.stdout are TTYs).
// Prints one JSON line: when each key reached the app (the terminal queries it wrote go to the
// child's raw stdout, which the parent reads).
import React from 'react';
import { render, Text, useInput } from 'ink';
import { InkPictureProvider } from 'ink-picture';

const h = React.createElement;
let mountedAt = Date.now();
const keys = [];

const App = () => {
  useInput((input) => keys.push({ input, at: Date.now() - mountedAt }));
  return h(Text, null, 'app');
};

const instance = render(h(InkPictureProvider, { terminalInfo: {} }, h(App)), { exitOnCtrlC: false, patchConsole: false });
mountedAt = Date.now();
process.stdout.write('READY\n');

setTimeout(() => {
  instance.unmount();
  console.log('\n' + JSON.stringify({ keys, leaked: keys.some((k) => k.input.includes('\x1b')) }));
  process.exit(0);
}, 1700);
