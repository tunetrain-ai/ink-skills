// Shared fixtures for the ink-getting-started claims.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ROOT, extPackageDir, extPkg } from '../lib/index.mjs';

const made = [];
process.on('exit', () => made.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/** Run `command args` with `PATH` set to `path`; resolves `{code, stdout, stderr}`. */
export function run(command, args, { cwd, path = '', env = {} } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { PATH: path, HOME: process.env.HOME ?? '', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => (stdout += data));
    child.stderr.on('data', (data) => (stderr += data));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

/** Every file under `dir` as `{relative/path: content}`. */
export function readTree(dir) {
  const files = {};
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const full = join(entry.parentPath ?? entry.path, entry.name);
    files[full.slice(dir.length + 1)] = readFileSync(full, 'utf8');
  }
  return files;
}

// ---------------------------------------------------------------------------
// create-ink-app, run for real (installed in tests/external)
// ---------------------------------------------------------------------------

const scaffolds = new Map();
/**
 * Run create-ink-app's own CLI with `args` in an empty directory, with no `npm` on the PATH: it copies its template
 * and then stops at the "Install dependencies" step, which is all this needs (no network, nothing installed).
 * @returns {Promise<{code: number, output: string, dir: string, files: Record<string, string>, pkg: any}>}
 */
export function scaffold(...args) {
  const key = args.join(' ');
  if (!scaffolds.has(key)) {
    scaffolds.set(
      key,
      (async () => {
        const cwd = mkdtempSync(join(tmpdir(), 'ink-skills-cia-'));
        made.push(cwd);
        const bin = extPkg('create-ink-app').bin;
        const result = await run(process.execPath, [join(extPackageDir('create-ink-app'), bin), ...args], { cwd });
        const name = args.find((arg) => !arg.startsWith('-'));
        const dir = join(cwd, name);
        const files = existsSync(dir) ? readTree(dir) : {};
        return { code: result.code, output: `${result.stdout}${result.stderr}`, dir, files, pkg: files['package.json'] ? JSON.parse(files['package.json']) : null };
      })(),
    );
  }
  return scaffolds.get(key);
}

// ---------------------------------------------------------------------------
// a TypeScript project built with the repository's tsc
// ---------------------------------------------------------------------------

const TSC_DIR = join(ROOT, 'node_modules', '.bin');

/** compilerOptions that let tsc accept Ink's declarations next to Node's; `jsx` is the setting under test. */
export const baseOptions = { module: 'nodenext', target: 'es2023', lib: ['es2023', 'esnext.disposable'], types: ['node'], skipLibCheck: true, strict: true, rootDir: 'source', outDir: 'dist' };

/**
 * Write `files` into a fresh project inside the repository (so `ink` and `react` resolve), run `tsc` there, and
 * run `command` (`node dist/cli.js`) when the file it names exists. Both programs are looked up by name on a PATH
 * holding only their own directory (tsc also needs node).
 */
export async function build({ files, compilerOptions, tsc = 'tsc', command = 'node dist/cli.js' }) {
  mkdirSync(join(ROOT, 'tests', '.tmp'), { recursive: true });
  const dir = mkdtempSync(join(ROOT, 'tests', '.tmp', 'getting-started-'));
  made.push(dir);
  const all = { 'tsconfig.json': JSON.stringify({ compilerOptions, include: ['source'] }), ...files };
  for (const [name, content] of Object.entries(all)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  const compiled = await run(tsc, [], { cwd: dir, path: `${TSC_DIR}:${dirname(process.execPath)}` });
  const [program, ...args] = command.split(' ');
  const entryFile = join(dir, args[0]);
  const output = existsSync(entryFile) ? readFileSync(entryFile, 'utf8') : null;
  const executed = output === null ? null : await run(program, args, { cwd: dir, path: dirname(process.execPath) });
  return { dir, compiled, output, executed };
}
