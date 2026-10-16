// Does an Ink app keep the process alive? Mounts one component and sets a timer that does not
// keep the process alive itself: if the timer fires, something else was holding the event loop.
//   node ink-input-handling-alive.mjs <none | JSON options for useInput>
import React from 'react';
import { render, Text, useInput } from 'ink';

const arg = process.argv[2];
const h = React.createElement;

const Input = ({ options }) => {
  useInput(() => {}, options);
  return h(Text, null, arg);
};

render(arg === 'none' ? h(Text, null, arg) : h(Input, { options: JSON.parse(arg) }), { patchConsole: false });

setTimeout(() => {
  console.log('\n' + JSON.stringify({ arg, alive: true }));
  process.exit(0);
}, 600).unref();
