#!/usr/bin/env node
// Single source of truth is the skills/ directory tree. This script derives
// every other index of it: the README's skill table, skills.sh.json's
// repo-page groupings, and the Claude Code plugin manifests. Run `npm run
// index` after adding/moving/removing a skill; CI fails if this script's
// output doesn't match what's committed (`git diff --exit-code`).

import { readFile, writeFile } from 'node:fs/promises';
import { join, relative, dirname, sep } from 'node:path';
import { ROOT, SKILLS_DIR, discoverSkillFiles } from './lib/skills.mjs';
import { loadEcosystem, renderTable, injectBetweenMarkers } from './lib/ecosystem.mjs';

const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));

// Human-curated titles/descriptions for each category folder. Keyed by path
// relative to skills/. This is the one place that isn't purely mechanical —
// everything else below is derived from the tree + this map.
const CATEGORY_META = {
  core: {
    title: 'Core',
    description: 'Built-in components, hooks, and the render/lifecycle API.',
  },
  patterns: {
    title: 'Patterns',
    description: 'Recipes for structuring a real Ink app: architecture, layouts, async, tests.',
  },
  ecosystem: {
    title: 'Ecosystem',
    description: 'The @inkjs/ui component library and the wider community package ecosystem.',
  },
  'ecosystem/inkjs-ui': {
    title: 'Ink UI (@inkjs/ui)',
    description: "Component library by Ink's authors: inputs, feedback, lists, theming.",
  },
  'ecosystem/data-display': {
    title: 'Data display',
    description: 'Tables, charts, markdown/syntax highlighting, and decorative text.',
  },
  'ecosystem/interaction': {
    title: 'Interaction',
    description: 'Forms, tab/scroll navigation, and task-runner components.',
  },
};

function categoryOf(skill) {
  // relDir is e.g. "ecosystem/inkjs-ui/inkjs-ui-inputs" -> category "ecosystem/inkjs-ui"
  const parts = skill.relDir.split(sep);
  return parts.slice(0, -1).join('/'); // "" for the top-level router
}

const skills = await discoverSkillFiles();
skills.sort((a, b) => a.relDir.localeCompare(b.relDir));

// A skill in a folder with no CATEGORY_META entry used to vanish silently from
// skills.sh.json and the README table. Make that a hard failure instead.
const unknownCategories = new Set(
  skills.map(categoryOf).filter((cat) => cat !== '' && !(cat in CATEGORY_META))
);
if (unknownCategories.size > 0) {
  console.error(
    `No CATEGORY_META entry for: ${[...unknownCategories].map((c) => `"${c}"`).join(', ')}. ` +
      `Add a title/description for each in scripts/generate-index.mjs.`
  );
  process.exit(1);
}

// ---------------------------------------------------------------------
// 1. skills.sh.json — repo page groupings
// ---------------------------------------------------------------------
// CATEGORY_META's key order is the display order everywhere (repo page, README).
const groupOrder = Object.keys(CATEGORY_META);
const grouped = new Map(groupOrder.map((k) => [k, []]));

for (const skill of skills) {
  const cat = categoryOf(skill);
  if (cat === '') continue; // the router itself — left ungrouped, shown first via notGrouped: "top"
  grouped.get(cat).push(skill.frontmatter.name);
}

const skillsShJson = {
  $schema: 'https://skills.sh/schemas/skills.sh.schema.json',
  notGrouped: 'top',
  groupings: groupOrder
    .filter((key) => grouped.get(key)?.length)
    .map((key) => ({
      title: CATEGORY_META[key].title,
      description: CATEGORY_META[key].description,
      skills: grouped.get(key),
    })),
};

await writeFile(join(ROOT, 'skills.sh.json'), JSON.stringify(skillsShJson, null, 2) + '\n', 'utf8');

// ---------------------------------------------------------------------
// 2. .claude-plugin/plugin.json — explicit skill-container directories
// ---------------------------------------------------------------------
const containerDirs = new Set();
for (const skill of skills) {
  const containerRel = relative(ROOT, dirname(skill.dir)).split(sep).join('/');
  containerDirs.add(`./${containerRel}/`);
}

const pluginJson = {
  name: 'ink-skills',
  displayName: 'Ink Skills',
  version: pkg.version,
  description: pkg.description,
  author: { name: 'tunetrain.ai', url: 'https://www.tunetrain.ai' },
  homepage: pkg.homepage,
  repository: pkg.repository.url.replace(/^git\+/, '').replace(/\.git$/, ''),
  license: pkg.license,
  keywords: pkg.keywords,
  skills: [...containerDirs].sort(),
};

await writeFile(
  join(ROOT, '.claude-plugin', 'plugin.json'),
  JSON.stringify(pluginJson, null, 2) + '\n',
  'utf8'
);

// ---------------------------------------------------------------------
// 3. .claude-plugin/marketplace.json — this repo as its own single plugin
// ---------------------------------------------------------------------
const marketplaceJson = {
  name: 'ink-skills',
  owner: { name: 'tunetrain.ai', url: 'https://www.tunetrain.ai' },
  description: pkg.description,
  plugins: [
    {
      name: 'ink-skills',
      source: './',
      description: pkg.description,
      version: pkg.version,
      category: 'documentation',
    },
  ],
};

await writeFile(
  join(ROOT, '.claude-plugin', 'marketplace.json'),
  JSON.stringify(marketplaceJson, null, 2) + '\n',
  'utf8'
);

// ---------------------------------------------------------------------
// 4. README.md — replace the table between marker comments
// ---------------------------------------------------------------------
const README_PATH = join(ROOT, 'README.md');
const START = '<!-- SKILLS_TABLE:START (generated by `npm run index`, do not edit by hand) -->';
const END = '<!-- SKILLS_TABLE:END -->';

const TABLE_ORDER = ['', ...groupOrder]; // '' = the router, listed first

function buildTable() {
  const lines = ['| Skill | Category | Description |', '| --- | --- | --- |'];
  const byCategory = new Map(TABLE_ORDER.map((c) => [c, []]));
  for (const skill of skills) {
    const cat = categoryOf(skill);
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(skill);
  }
  for (const cat of TABLE_ORDER) {
    const label = cat === '' ? 'Router' : (CATEGORY_META[cat]?.title ?? cat);
    for (const skill of byCategory.get(cat) ?? []) {
      // Full description, not a truncated one — a naive split on the first
      // "." mangles anything containing "package.json", "stdin.write()", etc.
      const desc = skill.frontmatter.description.replace(/\|/g, '\\|');
      lines.push(`| \`${skill.frontmatter.name}\` | ${label} | ${desc} |`);
    }
  }
  return lines.join('\n');
}

/**
 * Inject `body` between a marker pair in `file`. A missing file or marker pair
 * is a hard failure: a silent skip would let CI's `git diff` pass on stale text.
 */
async function injectInto(file, start, end, body) {
  const path = join(ROOT, file);
  const text = await readFile(path, 'utf8');
  await writeFile(path, injectBetweenMarkers(text, start, end, body, file), 'utf8');
}

try {
  await injectInto('README.md', START, END, buildTable());

  // -------------------------------------------------------------------
  // 5. Ecosystem compatibility tables — from data/ecosystem.json
  // -------------------------------------------------------------------
  const ecosystem = await loadEcosystem();
  const marker = (name, edge) =>
    `<!-- ${name}:${edge}${edge === 'START' ? ' (generated by `npm run index` from data/ecosystem.json, do not edit by hand)' : ''} -->`;

  const v = ecosystem.verifiedWith;
  await injectInto(
    'docs/SOURCES.md',
    marker('ECOSYSTEM_VERIFIED', 'START'),
    marker('ECOSYSTEM_VERIFIED', 'END'),
    `Last probed ${v.date} against ink ${v.ink}, react ${v.react} and Node ${v.node}: ${v.method}.`
  );
  await injectInto(
    'docs/SOURCES.md',
    marker('ECOSYSTEM_TABLE_CORE', 'START'),
    marker('ECOSYSTEM_TABLE_CORE', 'END'),
    renderTable(ecosystem, { group: 'core', withRegistry: true })
  );
  await injectInto(
    'docs/SOURCES.md',
    marker('ECOSYSTEM_TABLE_COMMUNITY', 'START'),
    marker('ECOSYSTEM_TABLE_COMMUNITY', 'END'),
    renderTable(ecosystem, { group: 'ecosystem', withRegistry: true })
  );
  // Agent-facing matrix: all packages in one table, no volatile registry columns.
  await injectInto(
    'skills/ecosystem/ink-ecosystem-overview/SKILL.md',
    marker('ECOSYSTEM_MATRIX', 'START'),
    marker('ECOSYSTEM_MATRIX', 'END'),
    renderTable(ecosystem, { group: null, withRegistry: false })
  );
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

console.log(
  `Generated skills.sh.json, .claude-plugin/plugin.json, .claude-plugin/marketplace.json, ` +
    `the README skill table, and the ecosystem tables (docs/SOURCES.md, ink-ecosystem-overview) ` +
    `from ${skills.length} skill(s) and data/ecosystem.json.`
);
