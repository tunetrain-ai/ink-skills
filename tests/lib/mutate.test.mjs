import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('the mutation audit kills a claim bound to its token and reports one that only reads it', () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const res = spawnSync(process.execPath, ['tests/mutate.mjs', '--verbose', '--claims-dir=tests/lib/fixtures/mutate'], { cwd: ROOT, env, encoding: 'utf8' });
  const out = res.stdout.replace(/\x1b\[[0-9;]*m/g, '');
  assert.equal(res.status, 1, `a vacuous token must fail the audit:\n${out}${res.stderr}`);
  assert.match(out, /killed\s+ink-layout\/SKILL#001/, 'the bound claim is killed');
  assert.match(out, /survived\s+ink-layout\/SKILL#002/, 'the claim that only reads its token survives and is reported');
  assert.doesNotMatch(out, /survived\s+ink-layout\/SKILL#001/);
  assert.match(out, /2 fact claim\(s\), 2 bound token\(s\), 1 killed, 1 survived, 0 broken/);
});
