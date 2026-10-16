// Shared fixtures for the ink-rendering-and-lifecycle claims.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFence } from '../lib/index.mjs';

/**
 * Run a fence of the skill as written, with a `render()` that behaves like Ink's:
 *   - it returns the Ink `Instance` (`rerender`, `unmount`, `waitUntilExit`, …) instead of the test harness' handle;
 *   - the options a fence passes (`{concurrent: true}`) go to Ink, not to the harness;
 *   - `after(instance)` runs right after the call, for fences that wait for the app (`await waitUntilExit()`).
 * The fence's own console output is returned in `logs`.
 *
 * `runFence` hands the fence a `render` that records a mount; this wraps that function while the fence runs.
 */
export async function runFenceLikeInk(fence, { stubs, mountOptions, after } = {}) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, '__FENCE_RENDER__');
  let record;
  Object.defineProperty(globalThis, '__FENCE_RENDER__', {
    configurable: true,
    get: () => (record ? (element, options) => {
      const app = record(element, options === undefined ? undefined : { render: options });
      if (after) setImmediate(() => after(app.instance, app));
      return app.instance;
    } : undefined),
    set(value) {
      record = value;
    },
  });
  const logs = [];
  const log = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    const result = await runFence(fence, { stubs, mountOptions });
    return { ...result, logs };
  } finally {
    console.log = log;
    if (previous) Object.defineProperty(globalThis, '__FENCE_RENDER__', previous);
    else delete globalThis.__FENCE_RENDER__;
  }
}

/** Run `node <args>` in a temp directory holding `files`; resolves `{code, stdout, stderr}`. */
export function runNode(files, args, { cwd } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ink-skills-node-'));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: cwd ?? dir, env: { PATH: '', HOME: process.env.HOME ?? '' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => (stdout += data));
    child.stderr.on('data', (data) => (stderr += data));
    child.on('error', reject);
    child.on('close', (code) => {
      rmSync(dir, { recursive: true, force: true });
      resolve({ code, stdout, stderr });
    });
  });
}
