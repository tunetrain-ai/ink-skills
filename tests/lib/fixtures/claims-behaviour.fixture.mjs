// NOT a test file (no .test.mjs suffix): spawned by claims.test.mjs to prove that the
// safeguards fail the way they should. Quotes are taken from the live skill text so this
// fixture does not rot when a skill is edited.
import { skill, loadFile } from '../claims.mjs';

const { units } = loadFile('ink-layout', 'SKILL.md');
const withToken = units.find((u) => u.kind === 'sentence' && u.tokens.length >= 1 && u.text.split(' ').length >= 6);
const s = skill('ink-layout');

s.fact('SKILL.md', [withToken.text], { kind: 'D' }, async (t, q) => {
  for (const tok of q.tokens) t.ok(q.tok(tok).length > 0);
});
s.fact('SKILL.md', [withToken.text], { kind: 'D' }, async () => {
  /* BEHAVIOUR:zero-assertions */
});
s.fact('SKILL.md', [withToken.text], { kind: 'D' }, async (t) => {
  t.ok(true); // BEHAVIOUR:unread-tokens — asserts, but never reads the tokens of its quote
});
s.fact('SKILL.md', ['this sentence does not exist anywhere in the skill text'], { kind: 'D' }, async (t) => t.ok(true));
s.fact('SKILL.md', ['`<Box>`'], { kind: 'D' }, async (t, q) => t.ok(q.tok('<Box>'))); // BEHAVIOUR:ambiguous
