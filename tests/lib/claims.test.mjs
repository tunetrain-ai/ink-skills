import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { anchor, loadFile, skill } from './claims.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

test('anchor finds a real quote across a hard line wrap', () => {
  const { units } = loadFile('ink-layout', 'SKILL.md');
  const sentence = units.find((u) => u.kind === 'sentence' && u.text.split(' ').length > 8);
  const { ranges, problems } = anchor('ink-layout', 'SKILL.md', [{ q: sentence.text }]);
  assert.deepEqual(problems, []);
  assert.equal(ranges.length, 1);
});

test('anchor reports stale, ambiguous and too-short quotes', () => {
  const stale = anchor('ink-layout', 'SKILL.md', [{ q: 'a sentence that is certainly not in the file' }]);
  assert.match(stale.problems[0], /stale quote/);
  const ambiguous = anchor('ink-layout', 'SKILL.md', [{ q: '`<Box>`' }]);
  assert.match(ambiguous.problems[0], /ambiguous quote/);
  const short = anchor('ink-layout', 'SKILL.md', [{ q: 'the' }]);
  assert.match(short.problems[0], /too short/);
  const nth = anchor('ink-layout', 'SKILL.md', [{ q: '`<Box>`', nth: 0 }]);
  assert.deepEqual(nth.problems, []);
});

test('guidance() refuses to be registered without a real reason', () => {
  assert.throws(() => skill('ink-layout').guidance('SKILL.md', ['whatever text here'], ''), /real reason/);
});

test('safeguards fail loudly: zero assertions, unread tokens, stale and ambiguous quotes', () => {
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR ?? '/tmp', FORCE_COLOR: '0', TERM: 'xterm-256color' };
  // a nested `node --test` must not think it is a child of the outer one
  delete env.NODE_TEST_CONTEXT;
  const res = spawnSync(process.execPath, ['--test', '--test-reporter=spec', join(HERE, 'fixtures', 'claims-behaviour.fixture.mjs')], { cwd: ROOT, env, encoding: 'utf8' });
  const out = `${res.stdout}\n${res.stderr}`;
  assert.notEqual(res.status, 0, 'the deliberately bad claims must make the run fail');
  assert.match(out, /without a single assertion/);
  assert.match(out, /never read with q\.tok\(\)/);
  assert.match(out, /stale quote/);
  assert.match(out, /ambiguous quote/);
  assert.match(out, /✔ ink-layout\/SKILL#\d+ \[D\]/, 'the well-formed claim still passes');
});
