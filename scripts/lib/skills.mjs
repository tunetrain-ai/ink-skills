// Shared helpers for walking the skills/ tree and parsing SKILL.md frontmatter.
// Used by validate.mjs, typecheck-snippets.mjs, and generate-index.mjs so all
// three tools agree on exactly one definition of "what is a skill".

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { parse as parseYaml } from 'yaml';

export const ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');
export const SKILLS_DIR = join(ROOT, 'skills');
export const MAX_DEPTH = 3; // matches skills CLI's DEFAULT_SKILL_CONTAINER_DEPTH

/**
 * @typedef {object} SkillFile
 * @property {string} dir          absolute path to the skill directory
 * @property {string} skillMdPath  absolute path to SKILL.md
 * @property {string} relDir       path relative to skills/, e.g. "core/ink-layout"
 * @property {number} depth        directory depth under skills/ (1-3)
 * @property {string} name         directory basename (expected == frontmatter name)
 * @property {string} raw          full file contents
 * @property {object} frontmatter  parsed YAML frontmatter
 * @property {string} body         markdown body after frontmatter
 */

async function walk(dir) {
  /** @type {string[]} */
  const dirs = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return dirs;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = join(dir, entry.name);
    dirs.push(full);
    dirs.push(...(await walk(full)));
  }
  return dirs;
}

function splitFrontmatter(raw, filePath) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`${filePath}: missing YAML frontmatter (expected leading "---" block)`);
  }
  const [, fmText, body] = match;
  let frontmatter;
  try {
    frontmatter = parseYaml(fmText) ?? {};
  } catch (err) {
    throw new Error(`${filePath}: invalid YAML frontmatter — ${err.message}`);
  }
  return { frontmatter, body };
}

/**
 * Discover every SKILL.md under skills/, in the same shape the skills CLI's
 * bounded-depth walk would find (we additionally *report* violations rather
 * than silently truncating, which is what makes this a validator).
 * @returns {Promise<SkillFile[]>}
 */
export async function discoverSkillFiles() {
  const allDirs = [SKILLS_DIR, ...(await walk(SKILLS_DIR))];
  /** @type {SkillFile[]} */
  const skills = [];

  for (const dir of allDirs) {
    const skillMdPath = join(dir, 'SKILL.md');
    try {
      await stat(skillMdPath);
    } catch {
      continue;
    }
    const raw = await readFile(skillMdPath, 'utf8');
    const { frontmatter, body } = splitFrontmatter(raw, relative(ROOT, skillMdPath));
    const relDir = relative(SKILLS_DIR, dir);
    const depth = relDir.split(sep).filter(Boolean).length;
    const name = relDir.split(sep).pop();
    skills.push({ dir, skillMdPath, relDir, depth, name, raw, frontmatter, body });
  }

  return skills;
}

/** All directories under skills/ (not just skill dirs) — used for shadow/orphan checks. */
export async function discoverAllDirs() {
  return [SKILLS_DIR, ...(await walk(SKILLS_DIR))];
}

export function extractCodeFences(markdown) {
  const fenceRe = /```(tsx|jsx)(\s+no-check)?\r?\n([\s\S]*?)```/g;
  /** @type {{ lang: string, noCheck: boolean, code: string }[]} */
  const fences = [];
  let m;
  while ((m = fenceRe.exec(markdown))) {
    fences.push({ lang: m[1], noCheck: Boolean(m[2]), code: m[3] });
  }
  return fences;
}
