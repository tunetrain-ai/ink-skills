#!/usr/bin/env node
// `npm test`: every test file in its own process, in the environment built by lib/test-env.mjs.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testEnv } from './lib/test-env.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const list = (dir) =>
  readdirSync(join(ROOT, 'tests', dir))
    .filter((f) => f.endsWith('.test.mjs'))
    .map((f) => join('tests', dir, f));
let files = [...list('lib'), ...list('claims')];
if (only.length) files = files.filter((f) => only.some((o) => f.includes(o)));
if (!files.length) {
  console.error('no test files matched');
  process.exit(1);
}

mkdirSync(join(ROOT, 'tests', '.tmp'), { recursive: true });
const env = testEnv();

const res = spawnSync(
  process.execPath,
  [
    '--test',
    '--test-force-exit',
    '--test-concurrency=4',
    '--test-reporter=spec',
    '--test-reporter-destination=stdout',
    '--test-reporter=./tests/lib/reporter.mjs',
    '--test-reporter-destination=tests/.tmp/results.json',
    ...files,
  ],
  { cwd: ROOT, env, stdio: 'inherit' },
);
process.exit(res.status ?? 1);
