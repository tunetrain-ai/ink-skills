import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runFence, projectOf, importedPackages, ROOT, stripAnsi, EXT } from './index.mjs';

const rootFence = {
  code: `import React from 'react';
import {render, Box, Text} from 'ink';

const Greeting = ({name}: {name: string}) => <Box borderStyle="single" width={13}><Text>Hello {name}</Text></Box>;
export const answer = 42;

render(<Greeting name="world" />);
`,
};

test('runFence transpiles a fence, sends render() to the harness and exports its top-level declarations', async () => {
  const { mod, apps, project } = await runFence(rootFence);
  assert.equal(project, 'root');
  assert.equal(mod.answer, 42, 'declared exports are kept');
  assert.equal(typeof mod.Greeting, 'function', 'declarations that were not exported are exported for the test');
  assert.equal(apps.length, 1, 'the fence called render() once');
  await apps[0].flush();
  assert.equal(stripAnsi(apps[0].screen()), '┌───────────┐\n│Hello world│\n└───────────┘');
  apps[0].unmount();
});

test('the packages a fence imports decide which project runs it', () => {
  assert.deepEqual([...importedPackages(`import a from 'ink-link'; import {b} from "@scope/pkg/sub"; import c from './x.js'; import fs from 'node:fs'; const d = await import('react');`)].sort(), ['@scope/pkg', 'ink-link', 'react']);
  assert.equal(projectOf(`import {Box} from 'ink'; import Link from 'ink-link';`), 'root');
  assert.equal(projectOf(`import Image from 'ink-picture';`), 'external');
  assert.equal(projectOf(`import {TitledBox} from '@mishieck/ink-titled-box';`), 'external');
});

test('a fence that needs a package from tests/external is mounted by the Ink installed there', async () => {
  const { mod, apps, project } = await runFence({
    code: `import React from 'react';
import {render, Text} from 'ink';
import {TitledBox} from '@mishieck/ink-titled-box';

render(<TitledBox titles={['Hi']} borderStyle="single" width={12}><Text>x</Text></TitledBox>);
`,
  });
  assert.equal(project, 'external');
  assert.ok(mod);
  await apps[0].flush();
  assert.equal(apps[0].screen().split('\n')[0], '┌ Hi ──────┐');
  apps[0].unmount();
});

test('stubs stand in for the placeholder modules a fence imports', async () => {
  const { mod } = await runFence({ code: `import value from './placeholder.js';\nexport const doubled = value * 2;\n` }, { stubs: { './placeholder.js': 'export default 21;' } });
  assert.equal(mod.doubled, 42);
});

test('a fence that does not transpile is reported, and nothing of it is left on disk', async () => {
  await assert.rejects(runFence({ code: 'const = ;' }), /could not transpile/);
  for (const base of [join(ROOT, 'tests', '.fences'), join(EXT, '.fences')]) {
    // other test files run in parallel and have their own directories here; ours are named by pid
    const mine = existsSync(base) ? readdirSync(base).filter((entry) => entry.startsWith(`${process.pid}-`)) : [];
    assert.deepEqual(mine, [], `${base} holds nothing of this process`);
  }
});
