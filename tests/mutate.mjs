#!/usr/bin/env node
// `npm run test:mutate` — the anti-vacuity audit.
//
// A claim binds the facts it checks to the skill text with q.tok(): the expected value is read
// from the text, never retyped. That only means something if changing the value in the text
// would make the claim fail. For every fact claim this script runs the claim once as it is,
// then once per token it reads with that token changed in several ways (a digit up, a letter
// replaced, a suffix, ...). A token is *killed* when at least one change makes the claim fail;
// a token that survives every change is bound to nothing and is reported.
//
//   node tests/mutate.mjs [claim id substring ...] [--verbose] [--claims-dir=<dir>]
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { testEnv } from './lib/test-env.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

if (process.env.CLAIMS_MUTATE_CHILD !== '1') {
  // stdin is a pipe that stays open, like a terminal's: ink-spawn (exercised by some claims) throws
  // `dest.end is not a function` when stdin is a file or /dev/null, which is what a CI step or a
  // background job provides
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
    cwd: ROOT,
    env: testEnv({ CLAIMS_MUTATE_CHILD: '1', CLAIMS_COLLECT: '1' }),
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  child.on('exit', (status) => process.exit(status ?? 1));
  await new Promise(() => {});
}

const verbose = process.argv.includes('--verbose');
const filters = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dirArg = process.argv.find((a) => a.startsWith('--claims-dir='))?.slice('--claims-dir='.length);

const { registry, countingAssert, makeQ } = await import('./lib/claims.mjs');
const { allHarnessCleanups } = await import('./lib/harness.mjs');

const dir = dirArg ? join(ROOT, dirArg) : join(ROOT, 'tests', 'claims');
for (const file of readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort()) await import(pathToFileURL(join(dir, file)).href);

/** Ways to change a token; none of them is a value a skill would plausibly contain. */
function mutations(token) {
  const out = new Set([`${token}Δ`, `Δ${token}`]);
  if (/\d/.test(token)) out.add(token.replace(/\d+/, (d) => String(Number(d) + 1)));
  const words = [...token.matchAll(/[\p{L}\p{N}_]+/gu)];
  if (words.length) {
    const longest = words.reduce((a, b) => (b[0].length > a[0].length ? b : a));
    const mid = longest.index + Math.floor(longest[0].length / 2);
    out.add(token.slice(0, mid) + 'Δ' + token.slice(mid + 1));
  }
  out.add(token.slice(0, -1) + 'Δ');
  out.delete(token);
  return [...out];
}

const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms))]);

// A stray exception thrown outside the claim's own promise chain (a pipe into a fake stream, a
// timer) would end the whole audit. Attribute it to the claim that is running and carry on.
let uncaught = null;
let inFlight = null;
process.on('uncaughtException', (error) => {
  uncaught = error;
  console.log(`  ! uncaught while running ${inFlight}: ${String(error?.message ?? error).split('\n')[0]}`);
});

async function run(claim, mutate) {
  const t = countingAssert(null);
  const q = makeQ(claim, mutate);
  inFlight = claim.id;
  uncaught = null;
  try {
    await withTimeout(claim.fn(t, q), claim.timeout ?? 60_000);
    // give a late stray exception its chance to surface before the claim counts as passed
    await new Promise((resolve) => setTimeout(resolve, 20));
  } finally {
    for (const cleanup of allHarnessCleanups) await cleanup();
  }
  if (uncaught) throw uncaught;
  if (t.count === 0) throw new Error('no assertions');
  return q;
}

const claims = registry.filter((c) => c.type === 'fact' && (!filters.length || filters.some((f) => c.id.includes(f))));
const survivors = [];
const broken = [];
let tokens = 0;
let killed = 0;

for (const claim of claims) {
  let read;
  try {
    read = (await run(claim)).readTokens();
  } catch (error) {
    broken.push({ claim, error });
    continue;
  }
  for (const token of read) {
    tokens++;
    let by = null;
    for (const changed of mutations(token)) {
      try {
        await run(claim, (text) => (text === token ? changed : text));
      } catch {
        by = changed;
        break;
      }
    }
    if (by) {
      killed++;
      if (verbose) console.log(`  killed   ${claim.id}  ${JSON.stringify(token)}  by ${JSON.stringify(by)}`);
    } else {
      survivors.push({ claim, token });
    }
  }
}

console.log(`\nMutation audit: ${claims.length} fact claim(s), ${tokens} bound token(s), ${killed} killed, ${survivors.length} survived, ${broken.length} broken.`);
for (const { claim, error } of broken) console.log(`  ✗ broken baseline  ${claim.id}: ${String(error.message).split('\n')[0]}`);
for (const { claim, token } of survivors) {
  console.log(`  ✗ survived         ${claim.id}  token ${JSON.stringify(token)} — the claim still passes with it changed; make an assertion depend on it, or list it in ctx`);
}
process.exit(survivors.length || broken.length ? 1 : 0);
