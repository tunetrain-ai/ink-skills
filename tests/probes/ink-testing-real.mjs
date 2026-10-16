// A real Ink render() (not ink-testing-library) on a TTY-like stream, updated three times and
// unmounted. Prints what was written to stdout. Ink reads CI once, at import, so the parent
// sets the environment.
import React from 'react';
import { Text } from 'ink';
import { mount } from '../lib/harness.mjs';

const h = React.createElement;
const app = mount(h(Text, null, 'frame 1'));
await app.flush();
await app.rerender(h(Text, null, 'frame 2'));
await app.rerender(h(Text, null, 'frame 3'));
await app.unmount();
console.log(JSON.stringify({ writes: app.stdout.writes, screen: app.screen() }));
process.exit(0);
