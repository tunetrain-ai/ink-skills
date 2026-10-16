#!/usr/bin/env node
// Structural quality gate for the skills/ catalog. Enforces everything the
// Agent Skills spec requires PLUS the two failure modes that are invisible
// until someone actually installs the repo with the skills CLI:
//
//   1. Duplicate skill names anywhere in the tree — the CLI installs every
//      skill to a FLAT <agent>/skills/<name>/ directory, so two skills with
//      the same name silently collide (last one wins).
//   2. Shadowing — the CLI's discovery walk stops descending as soon as it
//      finds a SKILL.md, so a category-folder SKILL.md hides every skill
//      nested beneath it.
//
// See docs/SOURCES.md and the Agent Skills spec (agentskills.io) for the
// frontmatter rules this also checks.

import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import semver from 'semver';
import { discoverSkillFiles, discoverAllDirs, referenceFiles, extractFences, ROOT, MAX_DEPTH, SKILLS_DIR } from './lib/skills.mjs';
import { loadEcosystem, installedInkVersion, statusProblems } from './lib/ecosystem.mjs';

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_NAME_LEN = 64;
const MAX_DESC_LEN = 1024;
const MAX_BODY_LINES = 500;

/** @type {string[]} */
const errors = [];
/** @type {string[]} */
const warnings = [];

function fail(msg) {
  errors.push(msg);
}
function warn(msg) {
  warnings.push(msg);
}

const skills = await discoverSkillFiles();

if (skills.length === 0) {
  fail('No SKILL.md files found under skills/ — nothing to validate.');
}

// The Ink the catalog is verified against is whatever the lockfile installed.
// Every skill's metadata.ink stamp must match its major.minor, so bumping ink
// (e.g. via Dependabot) fails CI until the skills have been re-reviewed.
let inkVersion = null;
try {
  inkVersion = await installedInkVersion();
} catch {
  fail('node_modules/ink not found — run `npm ci` before `npm run validate`.');
}
const majorMinor = (v) => `${semver.major(v)}.${semver.minor(v)}`;

const byName = new Map();

for (const skill of skills) {
  const loc = relative(ROOT, skill.skillMdPath);
  const fm = skill.frontmatter;

  // --- required fields -----------------------------------------------
  if (typeof fm.name !== 'string' || fm.name.length === 0) {
    fail(`${loc}: frontmatter "name" is required and must be a non-empty string`);
  } else {
    if (fm.name.length > MAX_NAME_LEN) {
      fail(`${loc}: name "${fm.name}" exceeds ${MAX_NAME_LEN} characters`);
    }
    if (!NAME_RE.test(fm.name)) {
      fail(
        `${loc}: name "${fm.name}" must be lowercase alphanumeric with single hyphens ` +
          `(no leading/trailing/double hyphens)`
      );
    }
    if (fm.name !== skill.name) {
      fail(`${loc}: name "${fm.name}" must equal parent directory name "${skill.name}"`);
    }
  }

  if (typeof fm.description !== 'string' || fm.description.trim().length === 0) {
    fail(`${loc}: frontmatter "description" is required and must be a non-empty string`);
  } else if (fm.description.length > MAX_DESC_LEN) {
    fail(`${loc}: description exceeds ${MAX_DESC_LEN} characters (${fm.description.length})`);
  }

  // --- depth ------------------------------------------------------------
  if (skill.depth > MAX_DEPTH) {
    fail(
      `${loc}: nested ${skill.depth} levels under skills/ — the skills CLI only walks ` +
        `${MAX_DEPTH} levels deep by default, this skill would never be discovered`
    );
  }

  // --- body length --------------------------------------------------
  const bodyLines = skill.body.split(/\r?\n/).length;
  if (bodyLines > MAX_BODY_LINES) {
    fail(
      `${loc}: SKILL.md body is ${bodyLines} lines, over the ${MAX_BODY_LINES}-line budget — ` +
        `move detail into references/`
    );
  }

  // --- code fences: a bare language and nothing else --------------------
  // Shipped text carries no tooling flags (an info string like `tsx no-check` is one): every fence
  // is compiled or run by the repo's own checks, so there is nothing to switch off.
  for (const source of [{ path: skill.skillMdPath, markdown: skill.body }, ...(await referenceFiles(skill.dir))]) {
    for (const fence of extractFences(source.markdown)) {
      if (!/^[a-z][a-z0-9+-]*$/.test(fence.info)) {
        fail(`${relative(ROOT, source.path)}: code fence with info string "${fence.info}" — use a bare language (tsx, sh, json, ...) and nothing after it`);
      }
    }
  }

  // --- duplicate names -------------------------------------------------
  if (fm.name) {
    const existing = byName.get(fm.name);
    if (existing) {
      fail(
        `Duplicate skill name "${fm.name}": ${relative(ROOT, existing)} and ${loc}. ` +
          `Both would collide at <agent>/skills/${fm.name}/ after install.`
      );
    } else {
      byName.set(fm.name, skill.skillMdPath);
    }
  }

  // --- metadata shape (string -> string map, per spec) ------------------
  if (fm.metadata !== undefined) {
    if (typeof fm.metadata !== 'object' || fm.metadata === null || Array.isArray(fm.metadata)) {
      fail(`${loc}: "metadata" must be a mapping of string keys to string values`);
    } else {
      for (const [k, v] of Object.entries(fm.metadata)) {
        if (typeof v !== 'string') {
          fail(`${loc}: metadata.${k} must be a string (got ${typeof v})`);
        }
      }
    }
  }

  // --- metadata.ink must match the installed ink (major.minor) -----------
  if (inkVersion) {
    const stamp = fm.metadata?.ink;
    if (typeof stamp !== 'string' || !semver.valid(stamp)) {
      fail(`${loc}: metadata.ink is required and must be a full version like "${inkVersion}"`);
    } else if (majorMinor(stamp) !== majorMinor(inkVersion)) {
      fail(
        `${loc}: metadata.ink is "${stamp}" but ink ${inkVersion} is installed — re-review this ` +
          `skill against the installed .d.ts files, then update the stamp`
      );
    }
  }
}

// --- shadowing: no skill directory may contain another skill nested below it
const skillDirs = new Set(skills.map((s) => s.dir));
for (const skill of skills) {
  for (const other of skills) {
    if (other === skill) continue;
    const rel = relative(skill.dir, other.dir);
    const isNestedBelow = rel.length > 0 && !rel.startsWith('..') && rel !== other.dir;
    if (isNestedBelow) {
      fail(
        `Shadowing: ${relative(ROOT, skill.skillMdPath)} is a parent directory of ` +
          `${relative(ROOT, other.skillMdPath)}. The skills CLI's discovery walk stops at the ` +
          `first SKILL.md it finds, so "${other.frontmatter.name}" would never be discovered. ` +
          `Category folders must not have their own SKILL.md — keep the category's index skill ` +
          `as a SIBLING of its children instead.`
      );
    }
  }
}

// --- cross-references: "Related skills:" lines must name real skills -----
// matchAll over every such line, not just the first one in the file.
const relatedRe = /^Related skills?:\s*(.+)$/gim;
for (const skill of skills) {
  for (const m of skill.body.matchAll(relatedRe)) {
    const names = m[1]
      .split(/[,\s]+/)
      .map((s) => s.replace(/[`*_.]/g, '').trim())
      .filter(Boolean);
    for (const name of names) {
      if (!byName.has(name)) {
        fail(
          `${relative(ROOT, skill.skillMdPath)}: "Related skills:" references unknown skill "${name}"`
        );
      }
    }
  }
}

// --- relative links must not escape the skill's own directory ------------
const linkRe = /]\((?!https?:\/\/|#)([^)]+)\)/g;
for (const skill of skills) {
  let m;
  linkRe.lastIndex = 0;
  while ((m = linkRe.exec(skill.body))) {
    const target = m[1].split('#')[0].trim();
    if (!target) continue;
    const resolved = resolve(skill.dir, target);
    const rel = relative(skill.dir, resolved);
    if (rel.startsWith('..')) {
      fail(
        `${relative(ROOT, skill.skillMdPath)}: relative link "${target}" escapes its own skill ` +
          `directory. Cross-skill links break after a flat install — reference the skill by name ` +
          `in a "Related skills:" line instead.`
      );
    }
  }
}

// --- router completeness: skills/ink/SKILL.md must route to every other skill
const router = skills.find((s) => s.frontmatter?.name === 'ink' && s.depth === 1);
if (!router) {
  fail('skills/ink/SKILL.md (the top-level router, name: ink) was not found');
} else {
  const missingFromRouter = [];
  for (const skill of skills) {
    if (skill.skillMdPath === router.skillMdPath) continue;
    const name = skill.frontmatter?.name ?? skill.name;
    // Whole-name match: a bare `includes` is satisfied by "ink-testing" appearing
    // inside "ink-testing-library". Hyphens count as part of a name.
    const mentioned = new RegExp(`(?<![\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`);
    if (!mentioned.test(router.body)) missingFromRouter.push(name);
  }
  if (missingFromRouter.length > 0) {
    fail(
      `skills/ink/SKILL.md routing table is missing: ${missingFromRouter.join(', ')}. ` +
        `Every skill must be reachable from the router.`
    );
  }
}

// --- orphan directories: dirs with no SKILL.md and no descendant with one -
// (skip directories nested INSIDE a skill dir, e.g. references/ or assets/ —
// those intentionally hold no SKILL.md of their own)
const allDirs = await discoverAllDirs();
for (const dir of allDirs) {
  if (dir === SKILLS_DIR) continue;
  if (skillDirs.has(dir)) continue;
  const isInsideSkillDir = [...skillDirs].some((sd) => {
    const rel = relative(sd, dir);
    return rel.length > 0 && !rel.startsWith('..');
  });
  if (isInsideSkillDir) continue;
  const hasDescendantSkill = [...skillDirs].some((sd) => {
    const rel = relative(dir, sd);
    return rel && !rel.startsWith('..');
  });
  if (!hasDescendantSkill) {
    warn(`${relative(ROOT, dir)}: directory contains no SKILL.md (directly or nested) — dead weight?`);
  }
}

// --- ecosystem data: data/ecosystem.json must agree with the skills and the registry
const STATUSES = new Set(['core', 'works', 'peer-excluded', 'untested', 'broken', 'avoid']);
const GROUPS = new Set(['core', 'ecosystem']);

/** SKILL.md plus every references/*.md — everything an installed skill ships. */
async function skillText(skill) {
  let text = skill.raw;
  try {
    for (const entry of await readdir(join(skill.dir, 'references'), { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        text += '\n' + (await readFile(join(skill.dir, 'references', entry.name), 'utf8'));
      }
    }
  } catch {
    // no references/ directory
  }
  return text;
}

let ecosystem = null;
try {
  ecosystem = await loadEcosystem();
} catch (err) {
  fail(`data/ecosystem.json could not be read: ${err.message}`);
}

if (ecosystem && inkVersion) {
  const textByName = new Map();
  for (const skill of skills) textByName.set(skill.frontmatter?.name ?? skill.name, await skillText(skill));

  const tracked = new Map();
  for (const pkg of ecosystem.packages) {
    const where = `data/ecosystem.json "${pkg.name}"`;
    if (typeof pkg.name !== 'string' || !pkg.name) {
      fail('data/ecosystem.json: a package entry has no "name"');
      continue;
    }
    if (tracked.has(pkg.name)) fail(`${where}: listed twice`);
    tracked.set(pkg.name, pkg);

    if (!GROUPS.has(pkg.group)) fail(`${where}: group must be one of ${[...GROUPS].join(', ')}`);
    if (!STATUSES.has(pkg.status)) fail(`${where}: status must be one of ${[...STATUSES].join(', ')}`);
    if (typeof pkg.note !== 'string') fail(`${where}: "note" must be a string (use "" for none)`);
    if (typeof pkg.version !== 'string') {
      fail(`${where}: no registry data yet — run \`npm run fetch-sources && npm run check-drift\``);
    }
    if (!Array.isArray(pkg.skills) || pkg.skills.length === 0) {
      fail(`${where}: "skills" must list at least one skill that covers this package`);
    } else {
      for (const skillName of pkg.skills) {
        if (!byName.has(skillName)) fail(`${where}: lists unknown skill "${skillName}"`);
        else if (!textByName.get(skillName).includes(pkg.name)) {
          fail(`${where}: lists skill "${skillName}", which never mentions it`);
        }
      }
    }
    for (const problem of statusProblems(pkg, inkVersion)) fail(`${where}: ${problem}`);
  }

  // Every Ink package a skill names must be tracked, so the compatibility
  // matrix and the weekly drift check cannot silently miss one.
  // this repo / Ink's component-library repo, plus names a skill deliberately
  // warns about because they don't exist on npm (`notOnNpm` in the data file).
  const NOT_PACKAGES = new Set(['ink-skills', 'ink-ui', ...(ecosystem.notOnNpm ?? []).map((e) => e.name)]);
  const pkgTokenRe = /(?<![\w/.@-])(?:@[a-z0-9-]+\/ink-[a-z0-9-]+|@inkjs\/ui|ink-[a-z0-9-]+)/g;
  const untracked = new Map(); // token -> first skill that names it
  for (const [skillName, text] of textByName) {
    for (const m of text.matchAll(pkgTokenRe)) {
      const token = m[0].replace(/-+$/, '');
      if (byName.has(token) || NOT_PACKAGES.has(token) || tracked.has(token)) continue;
      if (!untracked.has(token)) untracked.set(token, skillName);
    }
  }
  for (const [token, skillName] of untracked) {
    fail(
      `"${token}" is named in skill "${skillName}" but is not in data/ecosystem.json — add it ` +
        `(then \`npm run fetch-sources && npm run check-drift\`) so its Ink 8 status is tracked`
    );
  }

  // A package installed in this repo is one we vouch for.
  const pkgJson = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  for (const name of Object.keys(pkgJson.devDependencies ?? {})) {
    const entry = tracked.get(name);
    if (entry && !['core', 'works', 'untested'].includes(entry.status)) {
      fail(`package.json installs "${name}" but data/ecosystem.json marks it "${entry.status}"`);
    }
  }
}

// --- report -----------------------------------------------------------
console.log(`Checked ${skills.length} skill(s) under skills/.`);

if (warnings.length > 0) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  ⚠ ${w}`);
}

if (errors.length > 0) {
  console.error(`\n${errors.length} error(s):`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}

console.log('✓ All skills valid.');
