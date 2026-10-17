#!/usr/bin/env node
// Resolves the current registry state of every package in data/ecosystem.json
// and pulls the upstream readmes this catalog is authored from into .sources/
// (gitignored — authoring aid, not shipped).
//
// Used two ways:
//   - locally, by a human authoring or refreshing a skill
//   - by .github/workflows/refresh-upstream.yml, which feeds the result to
//     check-upstream-drift.mjs and opens a PR when anything has moved
//
// Network access required. Not part of `npm run check`.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './lib/skills.mjs';
import { loadEcosystem } from './lib/ecosystem.mjs';

const SOURCES_DIR = join(ROOT, '.sources');

const READMES = {
  'ink.md': 'https://raw.githubusercontent.com/vadimdemedes/ink/master/readme.md',
  'ink-ui.md': 'https://raw.githubusercontent.com/vadimdemedes/ink-ui/main/readme.md',
};

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

/** Latest version's registry fields. The full packument is needed for `time`. */
async function resolvePackage(name) {
  const packument = await fetchJson(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
  const version = packument['dist-tags']?.latest;
  const manifest = packument.versions?.[version];
  if (!version || !manifest) throw new Error(`${name}: no "latest" dist-tag`);
  return {
    version,
    peers: manifest.peerDependencies ?? {},
    engines: manifest.engines ?? {},
    published: packument.time?.[version] ?? null,
    deprecated: manifest.deprecated ?? null,
  };
}

async function main() {
  await mkdir(SOURCES_DIR, { recursive: true });
  const { packages } = await loadEcosystem();

  const versions = {};
  for (const { name } of packages) {
    try {
      versions[name] = await resolvePackage(name);
    } catch (err) {
      versions[name] = { error: String(err.message ?? err) };
    }
  }

  const failed = Object.entries(versions).filter(([, v]) => v.error);
  await writeFile(join(SOURCES_DIR, 'versions.json'), JSON.stringify(versions, null, 2) + '\n', 'utf8');

  for (const [filename, url] of Object.entries(READMES)) {
    try {
      await writeFile(join(SOURCES_DIR, filename), await fetchText(url), 'utf8');
    } catch (err) {
      console.error(`Failed to fetch ${url}: ${err.message ?? err}`);
    }
  }

  console.log(`Resolved ${packages.length - failed.length}/${packages.length} package(s) to .sources/versions.json`);
  for (const [name, v] of failed) console.error(`  ✗ ${name}: ${v.error}`);
  console.log(`ink: ${versions.ink?.version ?? 'ERROR'}`);
  console.log(`@inkjs/ui: ${versions['@inkjs/ui']?.version ?? 'ERROR'}`);

  // A registry outage must not look like "no drift" to the weekly workflow.
  if (failed.length === packages.length) {
    console.error('Every lookup failed — refusing to report this as an up-to-date result.');
    process.exit(1);
  }
}

await main();
