// A <Spawn> in a process whose stdin the parent chose (a pipe, /dev/null or a file). Prints what
// kind of stream process.stdin is, and "finished" if the app got through the command's run.
import { writeSync } from 'node:fs';
import React from 'react';
import { render, useApp } from 'ink';
import { Spawn } from 'ink-spawn';

const h = React.createElement;
writeSync(1, `stdin is a ${process.stdin.constructor.name}\n`);

const App = () => {
  const { exit } = useApp();
  return h(Spawn, { command: process.execPath, args: ['-e', ''], onCompletion: () => setTimeout(exit, 100) });
};

await render(h(App)).waitUntilExit();
writeSync(1, 'finished\n');
