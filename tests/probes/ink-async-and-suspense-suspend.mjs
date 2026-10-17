// What useApp().suspendTerminal() does around a child process. argv[2] is the child's stdio
// (`inherit` or `pipe`). A real Ink app on the child's own stdout (a fake TTY, so Ink draws
// frames and moves the cursor); the grandchild writes one line. Prints one JSON line with the
// raw bytes the process wrote to stdout and, from the app's side, what the child delivered.
import { writeSync } from 'node:fs';
import { spawn } from 'node:child_process';
import React from 'react';
import { render, Text, useApp, useInput } from 'ink';

const h = React.createElement;
const stdio = process.argv[2];
const events = [];

const App = () => {
  const { exit, suspendTerminal } = useApp();
  const [phase, setPhase] = React.useState('before');
  useInput(() => {});
  React.useEffect(() => {
    void (async () => {
      await suspendTerminal(async () => {
        const child = spawn(process.execPath, ['-e', "console.log('FROM CHILD')"], { stdio });
        let piped = '';
        child.stdout?.on('data', (chunk) => (piped += chunk));
        await new Promise((resolve) => child.on('close', resolve));
        events.push({ piped });
        // an update while the terminal belongs to the child
        setPhase('after');
      });
      exit();
    })();
  }, []);
  return h(Text, null, `phase ${phase}`);
};

await render(h(App)).waitUntilExit();
writeSync(1, `\n${JSON.stringify({ stdio, ...events[0] })}\n`);
