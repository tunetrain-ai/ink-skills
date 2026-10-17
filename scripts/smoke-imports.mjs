#!/usr/bin/env node
// Imports every runtime devDependency under real Node ESM. The typecheck proves
// a package's *types* line up with the snippets; this proves the package can
// actually be loaded next to the installed Ink. That is the failure that types
// cannot show: five CommonJS Ink packages type-check fine yet throw
// ERR_REQUIRE_ASYNC_MODULE at import time on Ink 8 (ESM with top-level await).
//
// Uses dynamic import(), never require(), for exactly that reason.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './lib/skills.mjs';

// Build/lint tooling — not something a snippet imports.
const TOOLING = new Set(['typescript', 'prettier', 'yaml', 'semver', 'skills']);

const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
const names = Object.keys(pkg.devDependencies ?? {}).filter(
  (name) => !name.startsWith('@types/') && !TOOLING.has(name)
);

let failures = 0;
for (const name of names) {
  try {
    await import(name);
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures++;
    console.error(`  ✗ ${name}: ${err.code ?? err.name}: ${String(err.message).split('\n')[0]}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} of ${names.length} package(s) failed to import.`);
  process.exit(1);
}
console.log(`✓ All ${names.length} runtime devDependencies import cleanly.`);
