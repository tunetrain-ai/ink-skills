// Type-level evidence. TypeScript 7 is driven through its `tsc` binary (the JS API under
// typescript/unstable/* is explicitly unstable). All fixtures registered by one claims
// file are written to tests/.tsc/<skill>/ and compiled in ONE `tsc --noEmit` run.
//
// Not @ts-expect-error: it hides *any* error, including a typo in the fixture. Instead a
// line that must fail ends with `//! TS2322` (several codes allowed), and the exact set of
// (line, code) pairs tsc reports must equal the set the fixture declares.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TSC = join(ROOT, 'node_modules', '.bin', 'tsc');

/** @type {Map<string, {skill:string, project:string, dir:string, handles:any[], run?:Promise<any>}>} */
const batches = new Map();

const MARKER = /\/\/!\s*((?:TS\d+\s*)+)\s*$/;

/** Expected diagnostics declared in a fixture: Set of "line:TSxxxx". */
export function expectedDiagnostics(source) {
  const expected = new Set();
  source.split('\n').forEach((line, i) => {
    const m = line.match(MARKER);
    if (m) for (const code of m[1].trim().split(/\s+/)) expected.add(`${i + 1}:${code}`);
  });
  return expected;
}

export function registerFixture(skill, claimId, source, opts = {}) {
  const project = opts.project ?? 'root';
  // One directory per claims FILE (node --test runs each file in its own process): two files for
  // the same skill (SKILL.md and a reference) must not delete each other's fixtures.
  const owner = (process.argv[1] ?? skill).split('/').pop().replace(/\.(test\.)?mjs$/, '');
  const key = `${project}:${owner}`;
  if (!batches.has(key)) {
    const base = project === 'external' ? join(ROOT, 'tests', 'external', '.tsc') : join(ROOT, 'tests', '.tsc');
    batches.set(key, { skill, project, dir: join(base, owner), handles: [] });
  }
  const batch = batches.get(key);
  const handle = { claimId, source, file: `f${String(batch.handles.length).padStart(3, '0')}.tsx`, batch, diagnostics: null };
  batch.handles.push(handle);
  return handle;
}

function runBatch(batch) {
  rmSync(batch.dir, { recursive: true, force: true });
  mkdirSync(batch.dir, { recursive: true });
  const extendsPath = batch.project === 'external' ? '../../tsconfig.json' : '../../../tsconfig.json';
  writeFileSync(
    join(batch.dir, 'tsconfig.json'),
    JSON.stringify({ extends: extendsPath, compilerOptions: { noEmit: true, pretty: false }, include: ['*.tsx'] }, null, 2),
  );
  for (const h of batch.handles) writeFileSync(join(batch.dir, h.file), h.source);

  const res = spawnSync(TSC, ['--noEmit', '--pretty', 'false', '-p', join(batch.dir, 'tsconfig.json')], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: process.env.HOME },
  });
  if (res.error) throw res.error;
  const out = `${res.stdout}\n${res.stderr}`;
  const byFile = new Map(batch.handles.map((h) => [h.file, []]));
  let parsed = 0;
  for (const line of out.split('\n')) {
    const m = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/);
    if (!m) continue;
    parsed++;
    const file = m[1].split('/').pop();
    if (byFile.has(file)) byFile.get(file).push({ line: Number(m[2]), code: m[4], message: m[5] });
    else byFile.set(`other:${m[1]}`, [{ line: Number(m[2]), code: m[4], message: m[5], path: m[1] }]);
  }
  // The exit code for "diagnostics present" differs between TypeScript versions (7 uses 1, 5 used 2),
  // so key on what we parsed: a non-zero exit with no parseable diagnostic is a harness problem
  // (bad tsconfig, crash), and a zero exit must not have produced any.
  if ((res.status !== 0 && parsed === 0) || (res.status === 0 && parsed > 0)) {
    throw new Error(`tsc did not run as expected (exit ${res.status}, ${parsed} diagnostics parsed):\n${out.slice(0, 2000)}`);
  }
  for (const h of batch.handles) h.diagnostics = byFile.get(h.file);
  batch.otherErrors = [...byFile.entries()].filter(([k]) => k.startsWith('other:')).flatMap(([, v]) => v);
  return batch;
}

/** Assert that this fixture produced exactly the diagnostics it declares. */
export async function checkFixture(handle) {
  const batch = handle.batch;
  batch.run ??= Promise.resolve().then(() => runBatch(batch));
  await batch.run;
  const expected = expectedDiagnostics(handle.source);
  const actual = new Set(handle.diagnostics.map((d) => `${d.line}:${d.code}`));
  const missing = [...expected].filter((e) => !actual.has(e));
  const unexpected = handle.diagnostics.filter((d) => !expected.has(`${d.line}:${d.code}`));
  const lines = handle.source.split('\n');
  const problems = [];
  for (const e of missing) {
    const [line, code] = e.split(':');
    problems.push(`line ${line} should fail with ${code} but compiled (or failed differently): ${lines[line - 1]?.trim()}`);
  }
  for (const d of unexpected) problems.push(`line ${d.line} unexpected ${d.code}: ${d.message}\n      ${lines[d.line - 1]?.trim()}`);
  assert.equal(problems.length, 0, `${handle.claimId}: type fixture does not match tsc\n  ${problems.join('\n  ')}`);
  assert.ok(handle.source.split('\n').some((l) => l.trim() && !/^\s*(import|\/\/)/.test(l)), 'fixture contains no code');
}

/** For self-tests: forget all batches. */
export function resetBatches() {
  batches.clear();
}

export { relative };
