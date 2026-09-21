#!/usr/bin/env node
// Pulls the upstream docs this catalog is authored from into .sources/
// (gitignored — authoring aid, not shipped) and prints the resolved
// versions so they can be compared against docs/SOURCES.md.
//
// Used two ways:
//   - locally, by a human authoring or refreshing a skill
//   - by .github/workflows/refresh-upstream.yml, which diffs the resolved
//     versions against docs/SOURCES.md and opens a PR when they've moved
//
// Network access required. Not part of `npm run check`.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './lib/skills.mjs';

const SOURCES_DIR = join(ROOT, '.sources');

const NPM_PACKAGES = [
  'ink',
  '@inkjs/ui',
  'ink-testing-library',
  'ink-text-input',
  'ink-spinner',
  'ink-select-input',
  'ink-multi-select',
  'ink-table',
  'ink-link',
  'ink-gradient',
  'ink-big-text',
  'ink-progress-bar',
  'ink-task-list',
  'ink-form',
  'ink-divider',
  'ink-tab',
  'ink-chart',
  'ink-scroll-view',
  'ink-virtual-list',
  'ink-markdown',
  'ink-syntax-highlight',
];

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

async function main() {
  await mkdir(SOURCES_DIR, { recursive: true });

  const versions = {};
  for (const name of NPM_PACKAGES) {
    try {
      const data = await fetchJson(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`);
      versions[name] = {
        version: data.version,
        peerDependencies: data.peerDependencies ?? {},
      };
    } catch (err) {
      versions[name] = { error: String(err.message ?? err) };
    }
  }

  await writeFile(
    join(SOURCES_DIR, 'versions.json'),
    JSON.stringify(versions, null, 2) + '\n',
    'utf8'
  );

  for (const [filename, url] of Object.entries(READMES)) {
    try {
      const text = await fetchText(url);
      await writeFile(join(SOURCES_DIR, filename), text, 'utf8');
    } catch (err) {
      console.error(`Failed to fetch ${url}: ${err.message ?? err}`);
    }
  }

  console.log(`Wrote ${Object.keys(versions).length} package version(s) to .sources/versions.json`);
  console.log(`ink: ${versions.ink?.version ?? 'ERROR'}`);
  console.log(`@inkjs/ui: ${versions['@inkjs/ui']?.version ?? 'ERROR'}`);
}

await main();
