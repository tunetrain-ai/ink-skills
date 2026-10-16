// What the <CommandOutput> fence of ink-async-and-suspense/SKILL.md does when the command cannot
// be spawned (ENOENT): as written (`with-listener`), and with its `error` listener removed
// (`without-listener`). Prints one JSON line when the error message reached the screen; a crash
// kills the process first, and the parent reads its exit status and stderr.
import { writeSync } from 'node:fs';
import React from 'react';
import { loadFile } from '../lib/claims.mjs';
import { runFence } from '../lib/fence-run.mjs';
import { mount, waitFor } from '../lib/harness.mjs';

const scenario = process.argv[2];
const fence = loadFile('ink-async-and-suspense', 'SKILL.md').fences[2];
const listener = /^[ \t]*child\.on\('error', onError\);\n/m;
const { mod } = await runFence(fence, scenario === 'without-listener' ? { replace: [[listener, '']] } : {});

const app = mount(React.createElement(mod.CommandOutput, { command: 'ink-skills-no-such-command', args: [] }), { columns: 80 });
await waitFor(() => /ENOENT/.test(app.screen()), { timeout: 5000, message: 'the ENOENT line' });
writeSync(1, `\n${JSON.stringify({ scenario, screen: app.screen() })}\n`);
process.exit(0);
