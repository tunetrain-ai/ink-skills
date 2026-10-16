// What <Spawn> does with the signals its Node process gets. argv[2] is a marker file, argv[3] the
// mode. The command it runs is a node process that writes `<marker>.ready` once it listens, and
// writes the name of the first SIGINT or SIGTERM it receives into the marker (then exits).
//
//   wait   the parent sends this process a signal once `<marker>.ready` exists
//   exit   this process calls process.exit() as soon as `<marker>.ready` exists
//
// The child gives up by itself after 20 s, so a failed run leaves nothing behind.
import { existsSync } from 'node:fs';
import React from 'react';
import { render, useApp } from 'ink';
import { Spawn } from 'ink-spawn';

const [marker, mode] = process.argv.slice(2);
const h = React.createElement;

const command = `
  const fs = require('node:fs');
  const marker = process.argv[1];
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { fs.writeFileSync(marker, signal); process.exit(0); });
  setTimeout(() => process.exit(1), 20000);
  fs.writeFileSync(marker + '.ready', '');
  setInterval(() => {}, 1000);
`;

const App = () => {
  const { exit } = useApp();
  return h(Spawn, { command: process.execPath, args: ['-e', command, marker], onCompletion: () => exit() });
};

if (mode === 'exit') {
  const poll = setInterval(() => {
    if (existsSync(`${marker}.ready`)) process.exit(0);
  }, 10);
  poll.unref?.();
}

await render(h(App)).waitUntilExit();
