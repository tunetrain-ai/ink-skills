// Evidence about packages that cannot be installed next to Ink 8 with strict peer
// dependencies (or are broken CommonJS builds), plus react-router, meow and create-ink-app.
// They live in tests/external (own package.json + lockfile, installed with
// --legacy-peer-deps --ignore-scripts). Network is needed once, at install.
//
// RULE: a component from here must be mounted by the ink and React installed THERE, or its
// hooks bind to a different context object and silently see no provider. `externalHarness()`
// loads that pair and returns mount() & friends built on it.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { ROOT, makeHarness, pkg, packageDir, readPackageFile } from './harness.mjs';

export const EXT = join(ROOT, 'tests', 'external');

export const externalInstalled = () => existsSync(join(EXT, 'node_modules', 'ink', 'package.json'));

export function requireExternal() {
  if (!externalInstalled()) throw new Error('tests/external is not installed — run `npm run test:setup`');
}

/** package.json of something installed in tests/external (`from` resolves a nested dependency). */
export const extPkg = (name, opts = {}) => pkg(name, { ...opts, base: EXT });
export const extPackageDir = (name, startDir = EXT) => packageDir(name, startDir);
export const extReadFile = (name, relPath, opts = {}) => readPackageFile(name, relPath, { ...opts, base: EXT });

// --- ESM entry resolution (import.meta.resolve with a parent needs an experimental flag) ---

function pickCondition(target, conditions = ['import', 'node', 'default']) {
  if (typeof target === 'string') return target;
  if (Array.isArray(target)) {
    for (const t of target) {
      const hit = pickCondition(t, conditions);
      if (hit) return hit;
    }
    return null;
  }
  if (target && typeof target === 'object') {
    for (const [key, value] of Object.entries(target)) {
      if (key === 'types') continue;
      if (conditions.includes(key)) {
        const hit = pickCondition(value, conditions);
        if (hit) return hit;
      }
    }
  }
  return null;
}

/** Absolute path of the ESM entry point of a package installed in tests/external. */
export function resolveEntry(name, startDir = EXT) {
  const dir = packageDir(name, startDir);
  const meta = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  let entry = null;
  if (meta.exports) entry = pickCondition(meta.exports['.'] ?? meta.exports);
  entry ??= meta.module ?? meta.main ?? 'index.js';
  return join(dir, entry);
}

/** import() a package installed in tests/external. */
export async function extImport(name, startDir = EXT) {
  requireExternal();
  return import(pathToFileURL(resolveEntry(name, startDir)).href);
}

/** mount() & friends built on the external project's own ink and react. */
export async function externalHarness() {
  requireExternal();
  const ink = await extImport('ink');
  const react = await extImport('react');
  return makeHarness(ink, react);
}

/**
 * Run code in a fresh Node process whose working directory is tests/external, so bare imports
 * resolve against its node_modules exactly as a user's project would (ERR_REQUIRE_ASYNC_MODULE
 * and friends only show up in a real process). Clean environment; no CI, no colour.
 * @param {{code:string, env?:object, timeout?:number, esm?:boolean}} opts
 */
export function runExternal({ code, env = {}, timeout = 20_000, esm = true }) {
  requireExternal();
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [...(esm ? ['--input-type=module'] : []), '-e', code], {
      cwd: EXT,
      env: { PATH: '', HOME: process.env.HOME ?? '', TMPDIR: process.env.TMPDIR ?? '/tmp', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`external process timed out after ${timeout}ms\nstdout: ${stdout}\nstderr: ${stderr}`));
    }, timeout);
    child.on('error', reject);
    child.on('close', (status) => {
      clearTimeout(timer);
      let json = null;
      const last = stdout.split('\n').reverse().find((l) => /^[{[]/.test(l.trim()));
      try {
        json = last ? JSON.parse(last) : null;
      } catch {
        /* leave null */
      }
      resolve({ status, stdout, stderr, json });
    });
  });
}
