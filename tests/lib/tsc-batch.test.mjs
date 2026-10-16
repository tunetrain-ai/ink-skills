import test from 'node:test';
import assert from 'node:assert/strict';
import { registerFixture, checkFixture, expectedDiagnostics } from './tsc-batch.mjs';
import { tsx } from './claims.mjs';

test('expectedDiagnostics reads //! markers, several codes per line', () => {
  const src = 'const a = 1;\nconst b: string = 2; //! TS2322\nfoo(); //! TS2304 TS2554\n';
  assert.deepEqual([...expectedDiagnostics(src)].sort(), ['2:TS2322', '3:TS2304', '3:TS2554']);
});

const good = tsx`
import {Box} from 'ink';
export const ok = <Box minWidth={10} minHeight="50%" />;
export const bad = <Box minWidth="50%" />; //! TS2322
`;
const wrongCode = tsx`
import {Box} from 'ink';
export const bad = <Box minWidth="50%" />; //! TS2339
`;
const missingError = tsx`
import {Box} from 'ink';
export const meantToFail = <Box minWidth={10} />; //! TS2322
`;
const unexpectedError = tsx`
import {Box} from 'ink';
export const oops = <Box minWidth="50%" />;
`;

const hGood = registerFixture('_selftest', 'good', good);
const hWrong = registerFixture('_selftest', 'wrong-code', wrongCode);
const hMissing = registerFixture('_selftest', 'missing', missingError);
const hUnexpected = registerFixture('_selftest', 'unexpected', unexpectedError);

test('a fixture whose declared diagnostics match tsc exactly passes', async () => {
  await checkFixture(hGood);
});
test('a marker with the wrong code fails (a typo cannot hide behind "some error")', async () => {
  await assert.rejects(checkFixture(hWrong), /should fail with TS2339/);
});
test('a marked line that compiles cleanly fails', async () => {
  await assert.rejects(checkFixture(hMissing), /should fail with TS2322/);
});
test('an unmarked error fails', async () => {
  await assert.rejects(checkFixture(hUnexpected), /unexpected TS2322/);
});

test('a fixture registered after the batch has run is still checked (a top-level await lets tests start early)', async () => {
  const late = registerFixture('_selftest', 'late', tsx`
import {Box} from 'ink';
export const ok = <Box minWidth={4} />;
export const bad = <Box minWidth="50%" />; //! TS2322
`);
  assert.equal(late.diagnostics, null, 'registered after the first run, so it has not been compiled yet');
  await checkFixture(late);
  assert.ok(late.diagnostics.length > 0, 'it was compiled in a second run of the same batch');
});
