// NOT part of the suite (run.mjs only lists tests/lib/*.test.mjs and tests/claims/*.test.mjs):
// claims for mutate.test.mjs to audit. One binds its token to behaviour, one only reads it.
// Quotes come from the live skill text so this fixture does not rot when a skill is edited.
import { skill, loadFile } from '../../claims.mjs';
import { ink } from '../../harness.mjs';

const { units } = loadFile('ink-layout', 'SKILL.md');
const withApi = units.find((u) => u.kind === 'sentence' && u.tokens.some((tok) => tok in ink) && u.text.split(' ').length >= 5);
const api = withApi.tokens.find((tok) => tok in ink);
const s = skill('ink-layout');

// bound: the token is looked up in the module, so a changed name fails the claim
s.fact('SKILL.md', [withApi.text], { kind: 'D', ctx: withApi.tokens.filter((tok) => tok !== api) }, async (t, q) => {
  t.equal(typeof q.api(ink, api), 'function');
});

// vacuous: reads the token, asserts something that has nothing to do with it
s.fact('SKILL.md', [withApi.text], { kind: 'D', ctx: withApi.tokens.filter((tok) => tok !== api) }, async (t, q) => {
  q.tok(api);
  t.equal(1 + 1, 2);
});
