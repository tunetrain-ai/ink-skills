// Canary. Ink reads `is-in-ci` once at import and chalk reads the environment once, so a
// suite run with a different environment would pass or fail for the wrong reasons. If this
// fails you are not running through `npm test` (tests/run.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import chalk from 'chalk';
import isInCi from 'is-in-ci';

test('canary: the suite runs in the normalised environment', () => {
  assert.equal(isInCi, false, 'CI must be absent from the environment; run via `npm test`');
  assert.ok(!('CI' in process.env) && !('CONTINUOUS_INTEGRATION' in process.env), 'CI / CONTINUOUS_INTEGRATION must not be set at all (even empty)');
  assert.equal(chalk.level, 3, 'FORCE_COLOR=3 must be in effect; run via `npm test`');
  assert.ok(!process.env.COLUMNS && !process.env.LINES, 'COLUMNS/LINES must be unset');
  assert.ok(!process.env.GITHUB_ACTIONS, 'GITHUB_ACTIONS must not leak in');
});
