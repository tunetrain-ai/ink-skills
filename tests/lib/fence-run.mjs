// Run a code fence from a skill, as written.
//
// The fence's text is transpiled with the tsc binary (types are NOT checked here —
// `npm run typecheck` compiles every fence), its `from 'ink'` import is pointed at a shim that
// re-exports Ink but sends `render()` to the recording harness, and the emitted module is
// imported. Top-level declarations that the fence does not export are exported for the test.
//
//   const { mod, apps } = await runFence(fence);
//   mod.Divider                      // a component declared in the fence
//   apps[0].screen()                 // what the fence's top-level render(...) drew
//
// A fence that imports a package that exists only in tests/external is emitted there and
// mounted with that project's own ink and React (a component must be mounted by the Ink and
// React it was installed next to — see external.mjs).

import { builtinModules } from 'node:module';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ROOT, mount as rootMount } from './harness.mjs';
import { EXT, externalHarness, requireExternal } from './external.mjs';

const TSC = join(ROOT, 'node_modules', '.bin', 'tsc');
const SHIMS = { root: join(dirname(fileURLToPath(import.meta.url)), 'fence-shim.mjs'), external: join(EXT, 'fence-shim.mjs') };
const BASES = { root: join(ROOT, 'tests', '.fences'), external: join(EXT, '.fences') };

const builtins = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const rootPkg = readJson(join(ROOT, 'package.json'));
const extPkg = readJson(join(EXT, 'package.json'));
const rootDeps = new Set([...Object.keys(rootPkg.dependencies ?? {}), ...Object.keys(rootPkg.devDependencies ?? {})]);
const externalOnly = new Set(Object.keys(extPkg.dependencies ?? {}).filter((name) => !rootDeps.has(name)));

const packageName = (specifier) => {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
};

/** Bare package names a piece of code imports. */
export function importedPackages(code) {
  const names = new Set();
  for (const m of code.matchAll(/(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/g)) {
    if (m[1].startsWith('.') || builtins.has(m[1])) continue;
    names.add(packageName(m[1]));
  }
  return names;
}

/** 'external' when the code imports a package that only tests/external has, else 'root'. */
export const projectOf = (code) => ([...importedPackages(code)].some((n) => externalOnly.has(n)) ? 'external' : 'root');

/** Names declared at the top level of emitted JS and not already exported. */
function unexportedDeclarations(js) {
  const names = [];
  for (const m of js.matchAll(/^(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm)) names.push(m[1]);
  return names;
}

/**
 * @param {{code: string, lang?: string}} fence      a fence from loadFile(...).fences
 * @param {{project?: 'root'|'external', mountOptions?: object, stubs?: Record<string,string>, replace?: [string|RegExp, string][]}} [opts]
 *   stubs:   placeholder modules the fence imports ({'./app.js': 'export default () => null'})
 *   replace: textual replacements on the emitted JS, for fences that need a fixture (a fixed
 *            file name, say). Prefer stubs; every replacement is a place the test can drift from the text.
 * @returns {Promise<{mod: any, apps: any[], project: string}>}
 */
export async function runFence(fence, opts = {}) {
  const project = opts.project ?? projectOf(fence.code);
  if (project === 'external') requireExternal();

  const hash = createHash('sha1').update(fence.code).digest('hex').slice(0, 10);
  const dir = join(BASES[project], `${process.pid}-${hash}-${Date.now()}`);
  mkdirSync(join(dir, 'out'), { recursive: true });
  try {
    writeFileSync(join(dir, 'fence.tsx'), fence.code);
    const emit = spawnSync(
      TSC,
      ['--ignoreConfig', '--jsx', 'react-jsx', '--module', 'nodenext', '--moduleResolution', 'nodenext', '--target', 'es2022', '--skipLibCheck', '--noCheck', '--outDir', join(dir, 'out'), join(dir, 'fence.tsx')],
      { encoding: 'utf8', env: { PATH: process.env.PATH } },
    );
    if (emit.status !== 0) throw new Error(`could not transpile the fence:\n${emit.stdout}${emit.stderr}`);

    let js = readFileSync(join(dir, 'out', 'fence.js'), 'utf8');
    js = js.replace(/from\s+(['"])ink\1/g, `from '${pathToFileURL(SHIMS[project]).href}'`);
    for (const [from, to] of opts.replace ?? []) js = js.replace(from, to);
    const extra = unexportedDeclarations(js).filter((n) => !new RegExp(`export\\s+(?:async\\s+)?(?:const|let|var|function\\*?|class)\\s+${n}\\b`).test(js));
    if (extra.length) js += `\nexport {${extra.join(', ')}};\n`;
    writeFileSync(join(dir, 'out', 'fence.js'), js);
    for (const [specifier, source] of Object.entries(opts.stubs ?? {})) writeFileSync(join(dir, 'out', specifier), source);

    const harness = project === 'external' ? await externalHarness() : { mount: rootMount };
    const apps = [];
    globalThis.__FENCE_RENDER__ = (element, options) => {
      const app = harness.mount(element, { ...opts.mountOptions, ...options });
      apps.push(app);
      return app;
    };
    const mod = await import(pathToFileURL(join(dir, 'out', 'fence.js')).href);
    return { mod, apps, project };
  } finally {
    // only our own directory: others run in parallel in the same base directory
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Synchronous guard used by the fence claims: the fence has no unresolved relative imports. */
export const relativeImports = (code) => [...code.matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]*)['"]/g)].map((m) => m[1]);
