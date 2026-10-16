// The claim registry. A claim ties a verbatim quote from a skill file to an executable
// proof. Nothing here is shipped, and skill files never reference it.
//
//   const s = skill('ink-layout');
//   s.fact('SKILL.md', ['`minWidth` accepts only numbers'], {kind: 'T'}, async (t, q) => {...});
//   s.types('SKILL.md', [...], tsx`...  //! TS2322`);
//   s.fence('SKILL.md', 3);                         // fence #3 compiles; no output claim
//   s.guidance('SKILL.md', [...], 'why this asserts nothing', {exempt: ['`token`']});
//
// Two modes. Normal: every claim becomes a node:test test. Collect
// (CLAIMS_COLLECT=1, used by coverage.mjs): claims register but nothing runs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractUnits, normalize, findAll, factTokens } from './units.mjs';
import { registerFixture, checkFixture } from './tsc-batch.mjs';
import { allHarnessCleanups } from './harness.mjs';
import { runFence } from './fence-run.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SKILLS_DIR = join(ROOT, 'skills');
export const COLLECT = process.env.CLAIMS_COLLECT === '1';

/** @type {Claim[]} */
export const registry = [];

/**
 * @typedef {object} Claim
 * @property {string} id
 * @property {string} skill
 * @property {string} file               relative to the skill dir, e.g. "SKILL.md"
 * @property {'fact'|'types'|'fence'|'guidance'} type
 * @property {string} kind               T R D P X (fact/types) | G | C
 * @property {{q:string, nth?:number}[]} quotes
 * @property {string[]} problems         anchoring/hygiene problems found at registration
 * @property {number} [fence]            fence index (type fence)
 * @property {string} [why]
 * @property {string[]} [exempt]         tokens a guidance claim declares as not-a-fact
 * @property {string[]} ctx              tokens a fact claim declares as context (not read via q.tok)
 */

// ---------------------------------------------------------------------------
// skill file lookup (cached)
// ---------------------------------------------------------------------------

const skillDirs = new Map();
function findSkillDir(name, dir = SKILLS_DIR) {
  if (skillDirs.has(name)) return skillDirs.get(name);
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = join(dir, entry.name);
    if (entry.name === name && existsSync(join(full, 'SKILL.md'))) {
      skillDirs.set(name, full);
      return full;
    }
    const found = findSkillDir(name, full);
    if (found) return found;
  }
  return null;
}

const fileCache = new Map();
/** Parsed units for a skill file. */
export function loadFile(skillName, file) {
  const key = `${skillName}/${file}`;
  if (fileCache.has(key)) return fileCache.get(key);
  const dir = findSkillDir(skillName);
  if (!dir) throw new Error(`unknown skill "${skillName}"`);
  const path = join(dir, file);
  if (!existsSync(path)) throw new Error(`${skillName}: no file "${file}"`);
  const raw = readFileSync(path, 'utf8');
  const parsed = { path, raw, ...extractUnits(raw) };
  fileCache.set(key, parsed);
  return parsed;
}

/** All skill names and their markdown files (SKILL.md + references/*.md). */
export function allSkillFiles() {
  const out = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const full = join(dir, entry.name);
      if (existsSync(join(full, 'SKILL.md'))) {
        const files = ['SKILL.md'];
        const refs = join(full, 'references');
        if (existsSync(refs) && statSync(refs).isDirectory()) {
          for (const r of readdirSync(refs).sort()) if (r.endsWith('.md')) files.push(`references/${r}`);
        }
        out.push({ skill: entry.name, dir: full, files });
      }
      walk(full);
    }
  })(SKILLS_DIR);
  return out.sort((a, b) => a.skill.localeCompare(b.skill));
}

// ---------------------------------------------------------------------------
// quote anchoring
// ---------------------------------------------------------------------------

/** Resolve a claim's quotes to ranges in the file's normalized text. */
export function anchor(skillName, file, quotes, { minWords = 3 } = {}) {
  const { N } = loadFile(skillName, file);
  const problems = [];
  const ranges = [];
  for (const { q, nth } of quotes) {
    const needle = normalize(q);
    const words = needle.split(' ').filter(Boolean).length;
    if (words < minWords && factTokens(needle).length === 0 && !/`/.test(needle)) {
      problems.push(`quote too short to anchor anything (need ≥${minWords} words or a fact token): "${q}"`);
    }
    const hits = findAll(N, needle);
    if (hits.length === 0) {
      problems.push(`stale quote — not found in ${skillName}/${file}: "${q}"${suggest(N, needle)}`);
      continue;
    }
    if (hits.length > 1 && nth === undefined) {
      problems.push(`ambiguous quote (${hits.length} matches, add nth): "${q}"`);
      continue;
    }
    const at = hits[nth ?? 0];
    if (at === undefined) {
      problems.push(`nth=${nth} out of range (${hits.length} matches): "${q}"`);
      continue;
    }
    ranges.push([at, at + needle.length]);
  }
  return { ranges, problems };
}

/** Nearest-match hint for a stale quote (longest shared prefix window). */
function suggest(N, needle) {
  const probe = needle.slice(0, Math.min(24, needle.length));
  const at = N.indexOf(probe);
  if (at === -1) return '';
  return `\n    nearest text: "${N.slice(at, at + needle.length + 20)}"`;
}

const asQuotes = (quotes) => quotes.map((q) => (typeof q === 'string' ? { q } : q));

// ---------------------------------------------------------------------------
// assertions that count themselves
// ---------------------------------------------------------------------------

export function countingAssert(ctx) {
  let count = 0;
  const wrap = (fn) => (...args) => {
    count++;
    return fn(...args);
  };
  const t = {
    ctx,
    after: (fn) => ctx?.after?.(fn),
    equal: wrap(assert.equal),
    notEqual: wrap(assert.notEqual),
    deepEqual: wrap(assert.deepEqual),
    notDeepEqual: wrap(assert.notDeepEqual),
    ok: wrap(assert.ok),
    match: wrap(assert.match),
    doesNotMatch: wrap(assert.doesNotMatch),
    throws: wrap(assert.throws),
    doesNotThrow: wrap(assert.doesNotThrow),
    rejects: wrap(assert.rejects),
    fail: wrap(assert.fail),
    get count() {
      return count;
    },
  };
  return t;
}

/** The `q` handed to a fact test: reading a token proves the expected value came from the text. */
export function makeQ(claim, mutate) {
  const tokens = [...new Set(claim.quotes.flatMap(({ q }) => factTokens(q)))];
  const read = new Set(claim.ctx);

  const tok = (text) => {
    if (!tokens.includes(text)) {
      throw new Error(`q.tok("${text}"): not a fact token of this claim's quotes (${tokens.map((x) => `"${x}"`).join(', ') || 'none'})`);
    }
    read.add(text);
    return mutate ? mutate(text) : text;
  };
  const resolve = (scope, name) => {
    if (!(name in Object(scope)) || scope[name] === undefined) throw new Error(`"${name}" is not an export of the module it was looked up in`);
    return scope[name];
  };

  return {
    tokens,
    tok,
    /**
     * Bind a token that names an API (`useBoxMetrics`, `measureElement(ref.current)`, `Box`): read
     * it and look it up in `scope`. A token that is not an export of `scope` throws, so changing
     * the name in the text fails the claim.
     */
    api: (scope, text) => resolve(scope, tok(text).replace(/\(.*$/s, '').trim()),
    /** Bind a component token (`<Box>`, `<Rule />`): read it and look the component up in `scope`. */
    el: (scope, text) => resolve(scope, tok(text).replace(/[<>/\s]/g, '')),
    unread: () => tokens.filter((tk) => !read.has(tk)),
    /** Tokens read with q.tok() (not the ctx ones). */
    readTokens: () => tokens.filter((tk) => read.has(tk) && !claim.ctx.includes(tk)),
  };
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

// ids count per markdown file, so they are the same whether every claims file runs in its own
// process (npm test) or all are imported into one (collect mode, the gate)
const counters = new Map();
const nextId = (name, file) => {
  const key = `${name}/${file.replace(/\.md$/, '')}`;
  const n = (counters.get(key) ?? 0) + 1;
  counters.set(key, n);
  return `${key}#${String(n).padStart(3, '0')}`;
};

export function skill(name) {
  if (!findSkillDir(name)) throw new Error(`skill("${name}"): no such skill`);

  function base(type, kind, file, quotes, extra = {}) {
    const q = asQuotes(quotes);
    const { problems } = anchor(name, file, q, { minWords: type === 'guidance' ? 2 : 3 });
    /** @type {Claim} */
    const claim = {
      id: nextId(name, file),
      skill: name,
      file,
      type,
      kind,
      quotes: q,
      problems,
      ctx: [],
      ...extra,
    };
    registry.push(claim);
    return claim;
  }

  const title = (claim) =>
    `${claim.id} [${claim.kind}] ${claim.quotes[0]?.q.replace(/\s+/g, ' ').slice(0, 70) ?? `fence ${claim.fence}`}`;

  return {
    name,

    /** A fact proven by running code. `fn(t, q)`; t has counting assertions, q.tok() binds tokens. */
    fact(file, quotes, opts, fn) {
      const claim = base('fact', opts.kind, file, quotes, { ctx: opts.ctx ?? [], timeout: opts.timeout });
      claim.fn = fn;
      if (COLLECT) return claim;
      test(title(claim), { timeout: opts.timeout ?? 10_000 }, async (ctx) => {
        if (claim.problems.length) assert.fail(claim.problems.join('\n'));
        const t = countingAssert(ctx);
        const q = makeQ(claim, globalThis.__CLAIMS_MUTATE__);
        try {
          await fn(t, q);
        } finally {
          for (const cleanup of allHarnessCleanups) await cleanup();
        }
        if (t.count === 0) assert.fail('claim finished without a single assertion');
        const unread = q.unread();
        if (unread.length) {
          assert.fail(`fact tokens never read with q.tok(): ${unread.map((x) => `"${x}"`).join(', ')} (or list them in ctx if they are context)`);
        }
      });
      return claim;
    },

    /**
     * A type-level fact. `fixture` is TSX; lines expected to fail end with `//! TS2322`
     * (one or more codes). The exact set of (line, code) must match what tsc reports.
     */
    types(file, quotes, fixture, opts = {}) {
      const claim = base('types', 'T', file, quotes);
      const handle = registerFixture(name, claim.id, fixture, opts);
      claim.fixture = fixture;
      if (COLLECT) return claim;
      test(title(claim), { timeout: opts.timeout ?? 60_000 }, async () => {
        if (claim.problems.length) assert.fail(claim.problems.join('\n'));
        const missing = claim.quotes.flatMap(({ q }) => factTokens(q)).filter((tk) => !fixture.includes(tk) && !(opts.ctx ?? []).includes(tk));
        if (missing.length) assert.fail(`fact tokens not present in the fixture source: ${missing.map((x) => `"${x}"`).join(', ')}`);
        await checkFixture(handle);
      });
      return claim;
    },

    /** A code fence: it compiles (checked by scripts/typecheck-snippets.mjs). Optional execution via run(t, mod). */
    fence(file, nth, opts = {}) {
      const claim = base('fence', 'C', file, [], { fence: nth });
      if (COLLECT) return claim;
      test(`${claim.id} [C] fence ${nth} of ${file}`, { timeout: opts.timeout ?? 10_000 }, async (ctx) => {
        const { fences } = loadFile(name, file);
        assert.ok(fences[nth], `no fence #${nth} in ${file}`);
        if (opts.run) {
          const t = countingAssert(ctx);
          await opts.run(t, fences[nth]);
          if (t.count === 0) assert.fail('fence run made no assertions');
        }
      });
      return claim;
    },

    /** The nth fence of a skill file ({lang, info, code}). */
    fenceOf(file, nth) {
      const fence = loadFile(name, file).fences[nth];
      if (!fence) throw new Error(`${name}/${file} has no fence #${nth}`);
      return fence;
    },

    /** Run the nth fence as written (see fence-run.mjs). */
    runFence(file, nth, opts) {
      return runFence(this.fenceOf(file, nth), opts);
    },

    /** No assertion — a recommendation or pointer. Must say why, and may not hide fact tokens. */
    guidance(file, quotes, why, opts = {}) {
      if (!why || why.trim().length < 8) throw new Error('guidance() needs a real reason');
      const claim = base('guidance', 'G', file, quotes, { why, exempt: opts.exempt ?? [] });
      if (COLLECT) return claim;
      test(title(claim), () => {
        if (claim.problems.length) assert.fail(claim.problems.join('\n'));
        assert.ok(true);
      });
      return claim;
    },
  };
}

/** Tagged template that returns its text unchanged (for readable TSX fixtures). */
export const tsx = (strings, ...values) => String.raw({ raw: strings }, ...values);

export { relative };
