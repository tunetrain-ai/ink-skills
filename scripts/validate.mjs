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

import { relative, resolve } from 'node:path';
import { discoverSkillFiles, discoverAllDirs, ROOT, MAX_DEPTH, SKILLS_DIR } from './lib/skills.mjs';

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
const relatedRe = /^Related skills?:\s*(.+)$/im;
for (const skill of skills) {
  const m = skill.body.match(relatedRe);
  if (!m) continue;
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
    if (!router.body.includes(skill.frontmatter?.name ?? skill.name)) {
      missingFromRouter.push(skill.frontmatter?.name ?? skill.name);
    }
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
