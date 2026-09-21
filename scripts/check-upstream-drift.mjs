#!/usr/bin/env node
// Compares the versions pinned in docs/SOURCES.md against what
// `npm run fetch-sources` just resolved from the npm registry, and — when
// they've moved — rewrites the version cells in docs/SOURCES.md in place, so
// the refresh-upstream workflow has an actual, committable diff to open a PR
// with (docs/SOURCES.md is tracked; .sources/ is gitignored and can't be).
// It deliberately does NOT touch any skill content or "Current for Ink
// 7/React 19?" status column — those need a human to re-read the actual
// .d.ts files, not just a version-number diff. See docs/SOURCES.md's own
// note on why the readme alone isn't trustworthy for that.
//
// Exits 0 either way; writes `changed=true|false` to $GITHUB_OUTPUT (if set)
// and a markdown PR-body summary to .sources/drift-summary.md.

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './lib/skills.mjs';

const SOURCES_MD = join(ROOT, 'docs', 'SOURCES.md');
const VERSIONS_JSON = join(ROOT, '.sources', 'versions.json');

const sourcesMd = await readFile(SOURCES_MD, 'utf8');
const resolved = JSON.parse(await readFile(VERSIONS_JSON, 'utf8'));

// Match table rows like: | `ink` | 7.1.1 | ... |  or  | [`ink`](url) | 7.1.1 | ... |
const rowRe = /\|\s*(?:\[)?`([^`]+)`(?:\]\([^)]*\))?\s*\|\s*([0-9][\w.-]*)\s*\|/g;

const pinned = new Map();
let m;
while ((m = rowRe.exec(sourcesMd))) {
  pinned.set(m[1], m[2]);
}

const changes = [];
for (const [name, pinnedVersion] of pinned) {
  const current = resolved[name];
  if (!current || current.error) continue; // fetch failed for this one — don't report drift on bad data
  if (current.version && current.version !== pinnedVersion) {
    changes.push({ name, pinnedVersion, currentVersion: current.version });
  }
}

const changed = changes.length > 0;

if (process.env.GITHUB_OUTPUT) {
  await writeFile(process.env.GITHUB_OUTPUT, `changed=${changed}\n`, { flag: 'a' });
}

const lines = [];
if (changed) {
  lines.push('The following packages have moved since docs/SOURCES.md was last updated:', '');
  lines.push('| Package | Pinned | Latest |', '| --- | --- | --- |');
  for (const c of changes) {
    lines.push(`| \`${c.name}\` | ${c.pinnedVersion} | ${c.currentVersion} |`);
  }
  lines.push(
    '',
    'This PR only bumps the version numbers in `docs/SOURCES.md` (a mechanical,',
    're-derivable change). It does **not** touch any skill content, `metadata.ink`',
    'stamps, or the "current for Ink 7 / React 19?" status column — those need a',
    'human to re-read the affected package\'s actual published `.d.ts` files, not',
    'just diff version numbers (see the note already in docs/SOURCES.md on why the',
    'readme alone isn\'t trustworthy for that). Update the relevant skill(s), fix up',
    'the status column, then run `npm run check` before merging.'
  );

  // Rewrite each drifted package's version cell in place — table rows are
  // `| `name` | OLDVERSION | ... |` (optionally with a markdown link around
  // the name); replace only the first number-looking cell after the name.
  let updated = sourcesMd;
  for (const c of changes) {
    const cellRe = new RegExp(
      `(\\|\\s*(?:\\[)?\`${c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\`(?:\\][^|]*)?\\s*\\|\\s*)${c.pinnedVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s*\\|)`
    );
    updated = updated.replace(cellRe, `$1${c.currentVersion}$2`);
  }
  updated = updated.replace(
    /^Resolved \d{4}-\d{2}-\d{2} via `npm run fetch-sources`\.$/m,
    `Resolved ${new Date().toISOString().slice(0, 10)} via \`npm run fetch-sources\`.`
  );
  await writeFile(SOURCES_MD, updated, 'utf8');
} else {
  lines.push('No drift detected — every pinned version in docs/SOURCES.md still matches latest.');
}

const summary = lines.join('\n') + '\n';
await writeFile(join(ROOT, '.sources', 'drift-summary.md'), summary, 'utf8');
console.log(summary);
