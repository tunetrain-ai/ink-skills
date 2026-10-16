#!/usr/bin/env node
// `npm test`. Ink reads `is-in-ci` once, at import, and chalk/supports-color read the
// environment once too, so the same suite would behave differently on a laptop and on
// GitHub Actions (CI=true, GITHUB_ACTIONS). Run it in an environment built from scratch.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const env = {
  PATH: process.env.PATH ?? '',
  HOME: process.env.HOME ?? '',
  TMPDIR: process.env.TMPDIR ?? '/tmp',
  // CI must be ABSENT, not empty: is-in-ci tests `'CI' in env`, so CI='' still counts as CI
  // (and Ink then writes only a final frame). Same for CONTINUOUS_INTEGRATION and CI_*.
  FORCE_COLOR: '3',
  COLORTERM: 'truecolor', // FORCE_COLOR is only a minimum: TERM=xterm-256color alone yields level 2
  TERM: 'xterm-256color',
  NODE_NO_WARNINGS: '1',
};

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
