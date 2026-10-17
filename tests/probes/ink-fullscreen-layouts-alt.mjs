// Mounts an app with {alternateScreen: true} on a fake terminal and prints the bytes Ink wrote.
// Whether Ink treats the run as interactive is decided once, at import (is-in-ci), by the environment
// the parent built for this process.
import { h, ink, mount } from '../lib/harness.mjs';

const app = mount(h(ink.Text, null, 'full-screen'), { columns: 40, rows: 10, render: { alternateScreen: true } });
await app.flush();
await app.unmount();
console.log(JSON.stringify({ bytes: app.bytes() }));
process.exit(0);
