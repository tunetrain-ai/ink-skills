// Renders a <Static> whose render function puts the prop named by argv[2] on its root element,
// and prints what React reported (React warns about a missing key once per process, so every
// variant needs a process of its own).
import { h, ink, mount } from '../lib/harness.mjs';

const keyProp = process.argv[2];
const warnings = [];
console.error = (...args) => warnings.push(args.map(String).join(' '));

const app = mount(h(ink.Static, { items: ['a', 'b'] }, (item) => h(ink.Text, { [keyProp]: item }, item)));
await app.flush();
console.log(JSON.stringify({ warnings, screen: app.screen() }));
await app.unmount();
process.exit(0);
