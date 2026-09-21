#!/usr/bin/env node
// Single source of truth is the skills/ directory tree. This script derives
// every other index of it: the README's skill table, skills.sh.json's
// repo-page groupings, and the Claude Code plugin manifests. Run `npm run
// index` after adding/moving/removing a skill; CI fails if this script's
// output doesn't match what's committed (`git diff --exit-code`).

import { readFile, writeFile } from 'node:fs/promises';
import { join, relative, dirname, sep } from 'node:path';
import { ROOT, SKILLS_DIR, discoverSkillFiles } from './lib/skills.mjs';

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
    description: "Anthropic-maintained component library: inputs, feedback, lists, theming.",
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

// ---------------------------------------------------------------------
// 1. skills.sh.json — repo page groupings
// ---------------------------------------------------------------------
const groupOrder = ['core', 'patterns', 'ecosystem', 'ecosystem/inkjs-ui', 'ecosystem/data-display', 'ecosystem/interaction'];
const grouped = new Map(groupOrder.map((k) => [k, []]));

for (const skill of skills) {
  const cat = categoryOf(skill);
  if (cat === '') continue; // the router itself — left ungrouped, shown first via notGrouped: "top"
  if (!grouped.has(cat)) grouped.set(cat, []);
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

const TABLE_ORDER = ['', 'core', 'patterns', ...groupOrder.filter((k) => k !== 'core' && k !== 'patterns')];

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

let readme;
try {
  readme = await readFile(README_PATH, 'utf8');
} catch {
  console.warn('README.md not found — skipping table injection (run after README.md exists).');
  readme = null;
}

if (readme !== null) {
  const startIdx = readme.indexOf(START);
  const endIdx = readme.indexOf(END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    console.error(
      `README.md is missing the ${START} / ${END} marker pair — cannot inject the skill table.`
    );
    process.exitCode = 1;
  } else {
    const before = readme.slice(0, startIdx + START.length);
    const after = readme.slice(endIdx);
    readme = `${before}\n\n${buildTable()}\n\n${after}`;
    await writeFile(README_PATH, readme, 'utf8');
  }
}

console.log(
  `Generated skills.sh.json, .claude-plugin/plugin.json, .claude-plugin/marketplace.json` +
    (readme !== null ? ', and README.md skill table' : '') +
    ` from ${skills.length} skill(s).`
);
