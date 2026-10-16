#!/usr/bin/env node
// Compares data/ecosystem.json against what `npm run fetch-sources` just
// resolved from the npm registry. When a package's version, peer range,
// engines, or deprecation flag has moved it rewrites those registry-derived
// fields in place, so the refresh-upstream workflow has an actual, committable
// diff to push (.sources/ is gitignored and can't carry one).
//
// It deliberately does NOT touch `status`, `note`, or any skill content. Those
// need a human to re-probe the package against the current Ink (install with
// strict peers, import, render) and re-read its published .d.ts — see
// docs/SOURCES.md. What it does do is say *which* packages need that attention:
// a status that now contradicts the declared peer range, a deprecation, or a
// newer Ink than the one the catalog targets.
//
// Exits 0 either way; writes `changed=true|false` to $GITHUB_OUTPUT (if set)
// and a markdown summary (used as the tracking issue's body) to
// .sources/drift-summary.md.

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import semver from 'semver';
import { ROOT } from './lib/skills.mjs';
import { loadEcosystem, saveEcosystem, installedInkVersion, statusProblems } from './lib/ecosystem.mjs';

const VERSIONS_JSON = join(ROOT, '.sources', 'versions.json');
const FIELDS = ['version', 'peers', 'engines', 'published', 'deprecated'];

const data = await loadEcosystem();
const resolved = JSON.parse(await readFile(VERSIONS_JSON, 'utf8'));
const targetInk = await installedInkVersion();
const latestInk = resolved.ink?.version ?? targetInk;

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const show = (v) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? `\`${JSON.stringify(v)}\`` : `\`${v}\``);

const changes = [];
for (const pkg of data.packages) {
  const current = resolved[pkg.name];
  if (!current || current.error) continue; // fetch failed for this one — don't report drift on bad data
  const moved = FIELDS.filter((f) => f !== 'published' && !same(pkg[f], current[f]));
  for (const f of moved) changes.push({ name: pkg.name, field: f, was: pkg[f], now: current[f] });
  for (const f of FIELDS) pkg[f] = current[f] ?? (f === 'peers' || f === 'engines' ? {} : null);
}

// Things a human has to act on, beyond the mechanical refresh.
const attention = [];
if (semver.major(latestInk) !== semver.major(targetInk) || semver.minor(latestInk) !== semver.minor(targetInk)) {
  attention.push(
    `**ink ${latestInk} is out; the catalog targets ${targetInk}.** Re-read the release notes and the published ` +
      `.d.ts diff, update the skills and every \`metadata.ink\` stamp, then bump the \`ink\` devDependency.`
  );
}
for (const pkg of data.packages) {
  for (const problem of statusProblems(pkg, latestInk)) attention.push(`\`${pkg.name}\`: ${problem}`);
  if (pkg.deprecated && resolved[pkg.name]?.deprecated) {
    attention.push(`\`${pkg.name}\` is deprecated on npm: ${pkg.deprecated}`);
  }
}

const changed = changes.length > 0;
if (changed) await saveEcosystem(data);

if (process.env.GITHUB_OUTPUT) {
  await writeFile(process.env.GITHUB_OUTPUT, `changed=${changed}\n`, { flag: 'a' });
}

const lines = [];
if (changed) {
  lines.push('Registry data for these packages has moved since `data/ecosystem.json` was last refreshed:', '');
  lines.push('| Package | Field | Was | Now |', '| --- | --- | --- | --- |');
  for (const c of changes) lines.push(`| \`${c.name}\` | ${c.field} | ${show(c.was)} | ${show(c.now)} |`);
} else {
  lines.push('No drift detected — every package in `data/ecosystem.json` still matches the registry.');
}
if (attention.length > 0) {
  lines.push('', '### Needs a human', '');
  for (const a of attention) lines.push(`- ${a}`);
}
lines.push(
  '',
  'The refresh only updates the registry-derived fields (`version`, `peers`, `engines`,',
  '`published`, `deprecated`) and the tables generated from them. It does **not** change',
  '`status`, `note`, any skill text, or any `metadata.ink` stamp — re-probe the affected',
  'package against the current Ink (strict-peer install, import, render; see',
  '`docs/SOURCES.md`), update the data file and skills, then run `npm run check`.'
);

const summary = lines.join('\n') + '\n';
await writeFile(join(ROOT, '.sources', 'drift-summary.md'), summary, 'utf8');
console.log(summary);
