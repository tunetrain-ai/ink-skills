// Shared fixtures for the ink-navigation claims (also imported by the ink-markdown-and-code,
// ink-tables and ink-charts claims, which make the same "what does npm do" statements).
import { mkdtempSync, writeFileSync, rmSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ROOT, EXT } from '../lib/index.mjs';

// ---------------------------------------------------------------------------
// npm against a registry that exists only on 127.0.0.1
// ---------------------------------------------------------------------------
// "npm install fails with ERESOLVE unless ..." is a statement about npm's resolver, so it is run
// through npm itself. The registry serves every package installed in the root and external
// projects (the exact versions in their node_modules trees, with their real package.json
// metadata: peerDependencies, peerDependenciesMeta, dependencies), so the resolver sees what it
// would see on the public registry for those versions. `--package-lock-only` resolves without
// fetching tarballs; nothing leaves the machine.

const tmpDirs = [];
process.on('exit', () => tmpDirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/** name -> version -> package.json for every package under `dir/node_modules`, nested trees included. */
function scan(dir, into) {
  const modules = join(dir, 'node_modules');
  if (!existsSync(modules)) return into;
  for (const entry of readdirSync(modules)) {
    if (entry.startsWith('.')) continue;
    const full = join(modules, entry);
    const packages = entry.startsWith('@') ? readdirSync(full).map((name) => join(full, name)) : [full];
    for (const packageDir of packages) {
      const file = join(packageDir, 'package.json');
      if (!existsSync(file)) continue;
      let meta;
      try {
        meta = JSON.parse(readFileSync(file, 'utf8'));
      } catch {
        continue;
      }
      if (!meta.name || !meta.version) continue;
      if (!into.has(meta.name)) into.set(meta.name, new Map());
      into.get(meta.name).set(meta.version, meta);
      scan(packageDir, into);
    }
  }
  return into;
}

let registry;
function startRegistry() {
  registry ??= (async () => {
    const manifests = scan(EXT, scan(ROOT, new Map()));
    const server = createServer((req, res) => {
      const name = decodeURIComponent(req.url.slice(1).split('?')[0]);
      const versions = manifests.get(name);
      if (!versions) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end('{"error":"not found"}');
        return;
      }
      const latest = [...versions.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
      const body = { name, 'dist-tags': { latest }, versions: {} };
      for (const [version, meta] of versions) {
        body.versions[version] = { ...meta, dist: { tarball: `http://127.0.0.1:${server.address().port}/${name}/-/${name.split('/').pop()}-${version}.tgz` } };
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    });
    server.unref();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${server.address().port}/`;
  })();
  return registry;
}

const npmRuns = new Map();

/**
 * Run `npm <command> <install...>` (resolution only) in an empty project whose package.json holds
 * `dependencies` plus whatever `manifest` adds (`overrides`, say), against the local registry,
 * with strict peer dependencies unless `args` says otherwise. Resolves `{status, stderr, code,
 * lock}`: `code` is npm's error code (`ERESOLVE`, ...) and `lock` the package-lock.json it wrote.
 * Results are cached: several claims read the same run.
 */
export function npmInstall({ dependencies = {}, manifest = {}, command = 'install', install = [], args = [] } = {}) {
  const key = JSON.stringify({ dependencies, manifest, command, install, args });
  if (!npmRuns.has(key)) {
    npmRuns.set(
      key,
      (async () => {
        const url = await startRegistry();
        const dir = mkdtempSync(join(tmpdir(), 'ink-skills-npm-'));
        tmpDirs.push(dir);
        writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'resolve-probe', version: '1.0.0', dependencies, ...manifest }));
        writeFileSync(join(dir, 'user-npmrc'), '');
        writeFileSync(join(dir, 'global-npmrc'), '');
        const argv = [command, ...install, '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund', '--no-update-notifier', '--registry', url, '--userconfig', join(dir, 'user-npmrc'), '--globalconfig', join(dir, 'global-npmrc'), '--cache', join(dir, 'cache'), ...args];
        const run = await new Promise((resolve, reject) => {
          const child = spawn('npm', argv, { cwd: dir, env: { PATH: process.env.PATH ?? '', HOME: dir } });
          let stderr = '';
          child.stderr.on('data', (chunk) => (stderr += chunk));
          child.stdout.resume();
          child.on('error', reject);
          child.on('close', (status) => resolve({ status, stderr }));
        });
        const lockFile = join(dir, 'package-lock.json');
        return {
          ...run,
          code: run.stderr.match(/npm error code (\w+)/)?.[1] ?? null,
          lock: existsSync(lockFile) ? JSON.parse(readFileSync(lockFile, 'utf8')) : null,
        };
      })(),
    );
  }
  return npmRuns.get(key);
}
