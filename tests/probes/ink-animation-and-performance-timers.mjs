// How many timers does the animation scheduler hold? Runs in a process of its own so that no other
// test leaves timers behind. Debug mode, so that Ink's render throttle holds no timer either.
//   node ink-animation-and-performance-timers.mjs static '[{"interval":100},{"interval":50}]'
//   node ink-animation-and-performance-timers.mjs toggle '{"interval":20}' isActive
import React from 'react';
import { render, Box, Text, useAnimation } from 'ink';
import { PassThrough } from 'node:stream';

const h = React.createElement;
const [mode, spec, option] = process.argv.slice(2);
const timers = () => process.getActiveResourcesInfo().filter((resource) => resource === 'Timeout').length;
const settle = () => new Promise((resolve) => setImmediate(resolve));

const stdout = new PassThrough();
stdout.columns = 80;
stdout.rows = 24;
stdout.isTTY = true;
stdout.resume();

const Animated = ({ options }) => (useAnimation(options), h(Text, null, 'x'));
const tree = (list) => h(Box, null, ...list.map((options, i) => h(Animated, { key: i, options })));
const app = render(tree(mode === 'static' ? JSON.parse(spec) : [JSON.parse(spec)]), { stdout, debug: true, patchConsole: false, exitOnCtrlC: false });
await app.waitUntilRenderFlush();
await settle();
const result = { mounted: timers() };

if (mode === 'toggle') {
  const options = JSON.parse(spec);
  result.sequence = [timers()];
  for (const value of [false, true]) {
    app.rerender(tree([{ ...options, [option]: value }]));
    await app.waitUntilRenderFlush();
    await settle();
    result.sequence.push(timers());
  }
}

app.unmount();
await settle();
result.afterUnmount = timers();
console.log(JSON.stringify(result));
process.exit(0);
