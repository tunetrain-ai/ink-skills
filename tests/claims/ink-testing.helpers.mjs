// Fixtures for the ink-testing claims: probes run in their own process (Ink reads CI, chalk reads
// FORCE_COLOR, and the host terminal is looked at, once, at import) and are kept because several
// claims read the same one.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { runIsolated, ROOT } from '../lib/index.mjs';

const runs = new Map();
const cached = (key, make) => {
  if (!runs.has(key)) runs.set(key, make());
  return runs.get(key);
};
const parsed = (name, run) => {
  if (!run.json) throw new Error(`${name} probe failed (exit ${run.code}):\n${run.stdout}\n${run.stderr}`);
  return run.json;
};

/** What ink-testing-library showed in a process with the given environment and terminal. */
export const itlProbe = ({ env = {}, tty = {} } = {}) =>
  cached(`itl:${JSON.stringify({ env, tty })}`, () => runIsolated({ probe: 'ink-testing-itl', env, tty }).then((run) => parsed('ink-testing-itl', run)));

/** The same probe in a process with no controlling terminal at all (its own session), so no host terminal can be found. */
export const itlProbeWithoutTerminal = (env = {}) =>
  cached(`itl-detached:${JSON.stringify(env)}`, () =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--import', join(ROOT, 'tests', 'lib', 'fake-tty.mjs'), join(ROOT, 'tests', 'probes', 'ink-testing-itl.mjs')], {
        cwd: ROOT,
        env: { PATH: '', HOME: process.env.HOME ?? '', TMPDIR: process.env.TMPDIR ?? '/tmp', INK_TEST_TTY: '{}', ...env },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => (stdout += chunk));
      child.stderr.on('data', (chunk) => (stderr += chunk));
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`itl probe timed out\n${stdout}\n${stderr}`));
      }, 15_000);
      child.on('close', (code) => {
        clearTimeout(timer);
        const line = stdout.split('\n').reverse().find((l) => l.trim().startsWith('{'));
        if (!line) reject(new Error(`itl probe failed (exit ${code}):\n${stdout}\n${stderr}`));
        else resolve(JSON.parse(line));
      });
    }),
  );

/** A real Ink render() (not ink-testing-library) updated three times, in a process with the given environment. */
export const realProbe = (env = {}) => cached(`real:${JSON.stringify(env)}`, () => runIsolated({ probe: 'ink-testing-real', env }).then((run) => parsed('ink-testing-real', run)));

/** What a `useInput` handler received for each sequence: through ink-testing-library's stdin and through a real stream. */
export const inputProbe = (sequences) =>
  cached(`input:${JSON.stringify(sequences)}`, () =>
    runIsolated({ probe: 'ink-testing-input', args: [JSON.stringify(sequences)], stdin: sequences.map((sequence, i) => [40 * (i + 1), sequence]), tty: { stdin: true } }).then((run) => parsed('ink-testing-input', run)),
  );

/** One render, either `real` (Ink on this process's stdout) or `fake` (ink-testing-library). */
export const attachProbe = (mode) =>
  cached(`attach:${mode}`, () =>
    runIsolated({ probe: 'ink-testing-attach', args: [mode], tty: {} }).then((run) => {
      const json = parsed('ink-testing-attach', run);
      return { ...json, stdout: run.stdout };
    }),
  );
