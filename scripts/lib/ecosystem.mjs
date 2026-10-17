// Shared access to data/ecosystem.json — the single source of truth for the
// Ink ecosystem compatibility table. Used by generate-index.mjs (renders the
// table), validate.mjs (cross-checks status against peer ranges),
// fetch-sources.mjs / check-upstream-drift.mjs (refresh registry fields) and
// smoke-imports.mjs.

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import semver from 'semver';
import { ROOT } from './skills.mjs';

export const ECOSYSTEM_PATH = join(ROOT, 'data', 'ecosystem.json');

/** Statuses whose claim depends on the declared peer range. */
const PEER_CHECKED = new Set(['works', 'peer-excluded']);

export async function loadEcosystem() {
  return JSON.parse(await readFile(ECOSYSTEM_PATH, 'utf8'));
}

export async function saveEcosystem(data) {
  await writeFile(ECOSYSTEM_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/** The ink version the catalog is currently authored against (package.json range floor). */
export async function installedInkVersion() {
  const pkg = JSON.parse(await readFile(join(ROOT, 'node_modules', 'ink', 'package.json'), 'utf8'));
  return pkg.version;
}

/**
 * Does the package's declared `ink` peer range accept `inkVersion`?
 * `null` when it declares no `ink` peer (nothing excludes anything).
 */
export function peerCoversInk(peers, inkVersion) {
  const range = peers?.ink;
  if (!range) return null;
  return semver.satisfies(inkVersion, range, { includePrerelease: false });
}

/**
 * Inconsistencies between a curated `status` and the registry-derived peer range.
 * @returns {string[]} human-readable problems (empty when consistent)
 */
export function statusProblems(pkg, inkVersion) {
  if (!PEER_CHECKED.has(pkg.status)) return [];
  const covers = peerCoversInk(pkg.peers, inkVersion);
  if (covers === null) return [];
  if (pkg.status === 'works' && !covers) {
    return [
      `status is "works" but its peer range "${pkg.peers.ink}" excludes ink ${inkVersion} — ` +
        `re-probe it and set status to "peer-excluded" (or "broken")`,
    ];
  }
  if (pkg.status === 'peer-excluded' && covers) {
    return [
      `status is "peer-excluded" but its peer range "${pkg.peers.ink}" now covers ink ${inkVersion} — ` +
        `re-probe it and set status to "works" (or "untested"/"broken")`,
    ];
  }
  return [];
}

const statusLabel = (status, inkMajor) =>
  ({
    core: 'core',
    works: 'works',
    'peer-excluded': `**peer excludes Ink ${inkMajor}**`,
    untested: 'untested',
    broken: '**broken**',
    avoid: '**avoid**',
  })[status] ?? status;

function peerCell(pkg) {
  const parts = Object.entries(pkg.peers ?? {})
    .filter(([name]) => name !== 'react-devtools-core')
    .map(([name, range]) => `${name} \`${range}\``);
  if (pkg.engines?.node) parts.push(`node \`${pkg.engines.node}\``);
  return parts.length ? parts.join(', ').replace(/\|/g, '\\|') : '—';
}

/**
 * Render the compatibility table. `withRegistry` adds the Latest / Last release
 * columns (docs/SOURCES.md); the agent-facing skill table omits them so it does
 * not change on every upstream release.
 */
export function renderTable(data, { group, withRegistry }) {
  const pkgs = data.packages.filter((p) => group === null || p.group === group);
  const inkMajor = semver.major(data.verifiedWith.ink); // the Ink the statuses were probed against
  const inkCol = `Ink ${inkMajor}`;
  const head = withRegistry
    ? ['Package', 'Latest', 'Last release', 'Peers', inkCol, 'Note']
    : ['Package', 'Peers', inkCol, 'Note'];
  const lines = [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`];
  for (const p of pkgs) {
    const cells = [`\`${p.name}\``];
    if (withRegistry) {
      cells.push(p.version ?? '—', p.published ? p.published.slice(0, 7) : '—');
    }
    cells.push(peerCell(p), statusLabel(p.status, inkMajor), (p.note ?? '').replace(/\|/g, '\\|'));
    lines.push(`| ${cells.join(' | ')} |`);
  }
  return lines.join('\n');
}

/** Replace the text between two marker comments (markers themselves are kept). */
export function injectBetweenMarkers(text, start, end, body, label) {
  const s = text.indexOf(start);
  const e = text.indexOf(end);
  if (s === -1 || e === -1 || e < s) {
    throw new Error(`${label}: missing the ${start} / ${end} marker pair`);
  }
  return `${text.slice(0, s + start.length)}\n\n${body}\n\n${text.slice(e)}`;
}
