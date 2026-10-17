// Shared fixtures for the ink-task-runners claims.
import { spawn } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { chmodSync, closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, runIsolated, waitFor } from '../lib/index.mjs';

const tmpDirs = [];
process.on('exit', () => tmpDirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
const scratch = (prefix) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
};

/**
 * A fake `npm` first on PATH, so a fence that runs `npm run lint` can run for real without
 * running anything of this project. `npm run <name>` writes `<name>.started` into a state
 * directory, then waits until the test writes `<name>.go`, writes `<name>.done` and exits 0.
 * The test thereby decides when each command finishes. restore() puts PATH back.
 */
export function fakeNpm() {
  const dir = scratch('ink-skills-npm-');
  const state = join(dir, 'state');
  mkdirSync(state);
  writeFileSync(
    join(dir, 'npm'),
    `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const [, name] = process.argv.slice(2);
const state = ${JSON.stringify(state)};
fs.writeFileSync(path.join(state, name + '.started'), '');
console.log('output of ' + name);
const wait = () => {
  if (!fs.existsSync(path.join(state, name + '.go'))) return setTimeout(wait, 5);
  fs.writeFileSync(path.join(state, name + '.done'), '');
};
wait();
// a run that is never released ends by itself
setTimeout(() => process.exit(1), 30000).unref();
`,
  );
  chmodSync(join(dir, 'npm'), 0o755);
  const path = process.env.PATH;
  process.env.PATH = `${dir}:${path}`;
  return {
    started: (name) => existsSync(join(state, `${name}.started`)),
    done: (name) => existsSync(join(state, `${name}.done`)),
    release: (name) => writeFileSync(join(state, `${name}.go`), ''),
    restore: () => {
      process.env.PATH = path;
    },
  };
}

// The glyphs ink-task-list draws depend on TERM, read when it is imported: one process per TERM.
const glyphRuns = new Map();
export function glyphs(env, labels = []) {
  const key = JSON.stringify([env, labels]);
  if (!glyphRuns.has(key)) {
    glyphRuns.set(
      key,
      runIsolated({ probe: 'ink-task-runners-glyphs', args: labels, env: { FORCE_COLOR: '0', ...env }, tty: { isTTY: true, columns: 80 } }).then((run) => {
        if (!run.json) throw new Error(`glyph probe failed:\n${run.stdout}\n${run.stderr}`);
        return run.json;
      }),
    );
  }
  return glyphRuns.get(key);
}

/**
 * Run tests/probes/ink-task-runners-spawn-signal.mjs, wait until the command it runs listens, send
 * `signal` to the probe itself (or, with no signal, let the probe call process.exit()), and report
 * what the command received.
 */
export async function signalRun(mode, signal) {
  const marker = join(scratch('ink-skills-signal-'), 'marker');
  const child = spawn(process.execPath, ['--import', join(ROOT, 'tests', 'lib', 'fake-tty.mjs'), join(ROOT, 'tests', 'probes', 'ink-task-runners-spawn-signal.mjs'), marker, mode], {
    env: { PATH: process.env.PATH, HOME: process.env.HOME ?? '', TMPDIR: process.env.TMPDIR ?? '/tmp', FORCE_COLOR: '0', INK_TEST_TTY: JSON.stringify({ isTTY: true, columns: 80 }) },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  child.stdout.resume();
  let stderr = '';
  child.stderr.on('data', (chunk) => (stderr += chunk));
  const closed = new Promise((resolve) => child.on('close', (code, by) => resolve({ code, by })));
  try {
    await waitFor(() => existsSync(`${marker}.ready`), { timeout: 20_000, message: 'the command to listen for signals' });
    if (signal) child.kill(signal);
    const { code, by } = await closed;
    await waitFor(() => existsSync(marker), { timeout: 10_000, message: 'the signal to reach the command' });
    return { code, signal: by, received: readFileSync(marker, 'utf8'), stderr };
  } finally {
    child.kill('SIGKILL');
  }
}

/**
 * Run tests/probes/ink-task-runners-spawn-stdin.mjs with the given stdin: a path to open (a file or
 * /dev/null) or 'pipe'. Resolves { code, stdout, stderr }.
 */
export function stdinRun(stdin) {
  const fd = stdin === 'pipe' ? undefined : openSync(stdin, 'r');
  const child = spawn(process.execPath, [join(ROOT, 'tests', 'probes', 'ink-task-runners-spawn-stdin.mjs')], {
    cwd: ROOT,
    env: { PATH: process.env.PATH, HOME: process.env.HOME ?? '', TMPDIR: process.env.TMPDIR ?? '/tmp', FORCE_COLOR: '0' },
    stdio: [fd ?? 'pipe', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (fd !== undefined) closeSync(fd);
      resolve({ code, stdout, stderr });
    });
    if (stdin === 'pipe') child.stdin.end();
  });
}

/** A file to hand a process as its stdin. */
export function emptyFile() {
  const file = join(scratch('ink-skills-stdin-'), 'stdin.txt');
  writeFileSync(file, '');
  return file;
}

/**
 * <Spawn> pipes its command's stdin into process.stdin, which breaks the process when that is a
 * file or /dev/null (see the claim that says so). Where this process's stdin is one, the claims
 * that run a <Spawn> in-process get an ordinary stream in its place for the duration of `work`.
 */
export async function withEndableStdin(work) {
  if (typeof process.stdin.end === 'function') return work();
  const original = Object.getOwnPropertyDescriptor(process, 'stdin');
  Object.defineProperty(process, 'stdin', { value: new PassThrough(), configurable: true });
  try {
    return await work();
  } finally {
    Object.defineProperty(process, 'stdin', original);
  }
}
