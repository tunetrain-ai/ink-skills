// Does a process end by itself once its Ink app has unmounted? One scenario per run (argv[2]),
// a real Ink app on the child's own stdout. Prints one JSON line after the app has unmounted
// then simply lets the event loop run out: a process that is still there when the parent stops
// waiting was held by a leak.
//
//   <kind>-<cleanup>   kind: timer | subprocess | input   cleanup: leak | clean
//
// `clean` scenarios also mount a useInput handler, which Ink has to release on its own; the leaking
// ones do not, so that nothing but the leak can be what keeps the process alive.
import { writeSync } from 'node:fs';
import { spawn } from 'node:child_process';
import React from 'react';
import { render, Text, useApp, useInput } from 'ink';

const h = React.createElement;
const [kind, cleanup] = process.argv[2].split('-');

// the leaked child outlives its parent being killed, so it ends on its own
const SLEEPER = 'setTimeout(() => {}, 6000)';

function acquire() {
  if (kind === 'timer') {
    const timer = setInterval(() => {}, 1000);
    return () => clearInterval(timer);
  }
  if (kind === 'subprocess') {
    const child = spawn(process.execPath, ['-e', SLEEPER], { stdio: 'ignore' });
    return () => child.kill();
  }
  return () => {};
}

const Input = () => {
  useInput(() => {});
  return null;
};

const App = () => {
  const { exit } = useApp();
  React.useEffect(() => {
    const release = acquire();
    exit();
    return cleanup === 'clean' ? release : undefined;
  }, []);
  return h(Text, null, 'running', cleanup === 'clean' ? h(Input) : null);
};

await render(h(App)).waitUntilExit();
// let the unmount (and the cleanups it runs) finish before looking
await new Promise((resolve) => setImmediate(resolve));
writeSync(1, `\n${JSON.stringify({ scenario: process.argv[2], unmounted: true })}\n`);
