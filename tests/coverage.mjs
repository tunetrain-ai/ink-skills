#!/usr/bin/env node
// The 100% gate. Every accountable unit of every skill file (sentence, table row, fence,
// frontmatter sentence, in-fence comment, claim-like heading) must be covered by a claim,
// every fact token in it must be named by a covering fact claim, no quote may be stale, and
// the shipped skill text must not mention the tests. Run after `npm test` so it can also
// confirm every registered claim actually passed.
//
//   node tests/coverage.mjs [--verbose] [--guidance] [--require-results] [--allow-uncovered]

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

process.env.CLAIMS_COLLECT = '1';

const { registry, allSkillFiles, loadFile, anchor, ROOT } = await import('./lib/claims.mjs');
const { normalize } = await import('./lib/units.mjs');

const args = new Set(process.argv.slice(2));
const verbose = args.has('--verbose');

// --- load every claims file in collect mode ---------------------------------
const claimsDir = join(ROOT, 'tests', 'claims');
const claimFiles = existsSync(claimsDir) ? readdirSync(claimsDir).filter((f) => f.endsWith('.test.mjs')).sort() : [];
for (const file of claimFiles) await import(pathToFileURL(join(claimsDir, file)).href);

const skills = allSkillFiles();
const skillNames = new Set(skills.map((s) => s.skill));
const errors = [];
const warnings = [];

// claims for skills/files that do not exist
for (const claim of registry) {
  if (!skills.some((s) => s.skill === claim.skill && s.files.includes(claim.file))) errors.push(`${claim.id}: no such file ${claim.skill}/${claim.file}`);
  for (const problem of claim.problems) errors.push(`${claim.id}: ${problem}`);
}

// --- coverage -----------------------------------------------------------------
const GUIDANCE_RED_FLAGS = /\b(always|never|only|default|must|exactly|throws?|returns?|cannot|can't|does not|doesn't)\b/i;
const report = { files: [], totals: { units: 0, covered: 0, guidance: 0 } };
const guidanceLog = [];

for (const { skill, files } of skills) {
  for (const file of files) {
    const { units, N } = loadFile(skill, file);
    const claims = registry.filter((c) => c.skill === skill && c.file === file);
    const withRanges = claims.map((claim) => ({ claim, ranges: anchor(skill, file, claim.quotes).ranges }));
    const accountable = units.filter((u) => u.kind !== 'structural');
    const uncovered = [];
    let covered = 0;
    let guidanceUnits = 0;

    for (const unit of accountable) {
      const covering = withRanges.filter(({ claim, ranges }) => {
        if (claim.type === 'fence') return unit.kind === 'fence' && claim.fence === unit.fence;
        return ranges.some(([a, b]) => a < unit.end && b > unit.start);
      });
      if (!covering.length) {
        uncovered.push(unit);
        continue;
      }

      // fact tokens: each must appear in a covering FACT quote (guidance may not hide facts)
      const factClaims = covering.filter(({ claim }) => claim.type === 'fact' || claim.type === 'types');
      const guidanceClaims = covering.filter(({ claim }) => claim.type === 'guidance');
      const missing = [];
      for (const token of unit.tokens) {
        const inFact = factClaims.some(({ claim }) => claim.quotes.some(({ q }) => normalize(q).includes(token)));
        const exempt = skillNames.has(token) || guidanceClaims.some(({ claim }) => claim.exempt.includes(token));
        if (!inFact && !exempt) missing.push(token);
      }
      if (missing.length) {
        errors.push(`${skill}/${file}:${unit.line} fact token(s) not named by any fact claim: ${missing.map((t) => `"${t}"`).join(', ')}\n      in: ${unit.text.slice(0, 140)}`);
      }
      covered++;
      if (!factClaims.length && guidanceClaims.length) {
        guidanceUnits++;
        if (GUIDANCE_RED_FLAGS.test(unit.text)) warnings.push(`${skill}/${file}:${unit.line} guidance contains a factual-sounding word: ${unit.text.slice(0, 120)}`);
      }
    }

    for (const { claim } of withRanges) {
      if (claim.type === 'guidance') guidanceLog.push(`${claim.id}  ${claim.quotes.map((q) => `"${q.q.slice(0, 60)}"`).join(' + ')}\n      why: ${claim.why}`);
    }

    report.files.push({ skill, file, units: accountable.length, covered, guidance: guidanceUnits, uncovered: uncovered.map((u) => ({ id: u.id, kind: u.kind, line: u.line, text: u.text })) });
    report.totals.units += accountable.length;
    report.totals.covered += covered;
    report.totals.guidance += guidanceUnits;
    if (accountable.length && guidanceUnits / accountable.length > 0.4) warnings.push(`${skill}/${file}: ${Math.round((100 * guidanceUnits) / accountable.length)}% of units are covered only by guidance`);
  }
}

// --- no-test-mentions lint ------------------------------------------------------
const DENY = [
  /\bverified against\b/i,
  /\bwere verified\b/i,
  /\bfirst[- ]frames?\b/i,
  /\bnot exercised\b/i,
  /\bexercised (further|on)\b/i,
  /\bin a test on\b/i,
  /\(tested\)/i,
  /\btypechecked\b/i,
  /\bactually run\b/i,
  /\bwe (tested|verified|probed|checked)\b/i,
  /\bprobed\b/i,
];
const allowFile = join(ROOT, 'tests', 'lint-allow.json');
const allow = existsSync(allowFile) ? JSON.parse(readFileSync(allowFile, 'utf8')).map((e) => normalize(e.quote)) : [];
const mentions = [];
for (const { skill, files } of skills) {
  if (skill === 'ink-testing') continue; // legitimately about testing Ink apps
  for (const file of files) {
    const { N, units } = loadFile(skill, file);
    for (const re of DENY) {
      for (const m of N.matchAll(new RegExp(re.source, `${re.flags.replace('g', '')}g`))) {
        const around = N.slice(Math.max(0, m.index - 80), m.index + m[0].length + 80);
        if (allow.some((a) => around.includes(a))) continue;
        const unit = units.find((u) => u.start <= m.index && m.index < u.end);
        mentions.push(`${skill}/${file}:${unit?.line ?? '?'} "${m[0]}" — …${around.trim()}…`);
      }
    }
  }
}
for (const m of mentions) errors.push(`test/verification wording in shipped skill text: ${m}`);

// --- results: registered must equal passed -----------------------------------
const resultsFile = join(ROOT, 'tests', '.tmp', 'results.json');
let resultsNote = 'no results file (run `npm test` first)';
if (existsSync(resultsFile)) {
  const results = JSON.parse(readFileSync(resultsFile, 'utf8').trim().split('\n').pop());
  const passed = new Set(results.passed);
  const notPassed = registry.filter((c) => !passed.has(c.id));
  for (const claim of notPassed) errors.push(`${claim.id}: registered but did not pass (${results.failed.includes(claim.id) ? 'failed' : 'did not run'})`);
  for (const id of results.skipped) errors.push(`${id}: skipped/todo — not allowed`);
  resultsNote = `${registry.length - notPassed.length}/${registry.length} registered claims passed`;
} else if (args.has('--require-results')) {
  errors.push('tests/.tmp/results.json missing — the gate must run after `npm test`');
}

// --- print ---------------------------------------------------------------------
const uncoveredTotal = report.files.reduce((n, f) => n + f.uncovered.length, 0);
console.log(`Claims: ${registry.length} registered in ${claimFiles.length} file(s); ${resultsNote}.`);
console.log(`Units:  ${report.totals.covered}/${report.totals.units} covered (${report.totals.guidance} by guidance only), ${uncoveredTotal} uncovered.`);
if (verbose || uncoveredTotal <= 40) {
  for (const f of report.files.filter((x) => x.uncovered.length)) {
    console.log(`\n  ${f.skill}/${f.file}  ${f.covered}/${f.units}`);
    for (const u of f.uncovered.slice(0, verbose ? 999 : 6)) console.log(`    L${u.line} [${u.kind}] ${u.text.slice(0, 110)}`);
    if (!verbose && f.uncovered.length > 6) console.log(`    … ${f.uncovered.length - 6} more`);
  }
} else {
  const worst = [...report.files].sort((a, b) => b.uncovered.length - a.uncovered.length).slice(0, 8);
  console.log('  most uncovered: ' + worst.map((f) => `${f.skill}/${f.file}=${f.uncovered.length}`).join(', '));
}
if (args.has('--guidance')) console.log(`\nGuidance claims (${guidanceLog.length}):\n` + guidanceLog.join('\n'));
if (warnings.length) {
  console.log(`\n${warnings.length} advisory warning(s):`);
  for (const w of warnings.slice(0, verbose ? 999 : 12)) console.log(`  ⚠ ${w}`);
}

mkdirSync(join(ROOT, 'tests', '.tmp'), { recursive: true });
writeFileSync(join(ROOT, 'tests', '.tmp', 'coverage.json'), JSON.stringify({ ...report, errors, warnings, guidance: guidanceLog }, null, 2));

const gate = !args.has('--allow-uncovered');
if (gate && uncoveredTotal) errors.push(`${uncoveredTotal} unit(s) are not covered by any claim`);
if (errors.length) {
  console.error(`\n${errors.length} error(s):`);
  for (const e of errors.slice(0, verbose ? 999 : 30)) console.error(`  ✗ ${e}`);
  if (errors.length > 30 && !verbose) console.error(`  … ${errors.length - 30} more (use --verbose)`);
  process.exit(1);
}
console.log('\n✓ every unit of every skill is covered by a passing claim.');
