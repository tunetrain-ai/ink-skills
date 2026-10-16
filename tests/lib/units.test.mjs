import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractUnits, sentenceRanges, normalize, factTokens, findAll } from './units.mjs';
import { allSkillFiles, loadFile } from './claims.mjs';

const kinds = (md) => extractUnits(md).units.map((u) => `${u.kind}:${u.text}`);

test('normalize collapses whitespace and un-escapes table pipes', () => {
  assert.equal(normalize('a\n   b \\| c'), 'a b | c');
});

test('sentences: inline code with dots, abbreviations, versions and file names do not split', () => {
  const t = normalize('Read `package.json` first, e.g. the bin field. Then use 8.0.0 or index.mjs for it. Done.');
  const parts = sentenceRanges(t).map(([a, b]) => t.slice(a, b));
  assert.deepEqual(parts, ['Read `package.json` first, e.g. the bin field.', 'Then use 8.0.0 or index.mjs for it.', 'Done.']);
});

test('sentences: a sentence that starts with a code span is still a sentence start', () => {
  const t = normalize('There is no grid. `<Box>` is the primitive.');
  assert.equal(sentenceRanges(t).length, 2);
});

test('units: tables by row (header and separator excluded), lists by item, fences whole, escaped pipes kept', () => {
  const md = '---\nname: x\ndescription: One. Two.\nmetadata:\n  ink: "8.0.0"\n---\n\n# Title\n\nPara one. Para two.\n\n| A | B |\n| --- | --- |\n| `x \\| y` | 1 |\n| z | 2 |\n\n- item one\n  continues here. Second.\n- item two\n\n```tsx\nconst a = 1; // a comment\n```\n';
  const got = kinds(md);
  assert.deepEqual(got.filter((k) => k.startsWith('frontmatter')), ['frontmatter:One.', 'frontmatter:Two.']);
  assert.ok(got.includes('sentence:Para one.') && got.includes('sentence:Para two.'));
  assert.deepEqual(got.filter((k) => k.startsWith('row')), ['row:| `x | y` | 1 |', 'row:| z | 2 |']);
  assert.ok(got.includes('sentence:item one continues here.') && got.includes('sentence:Second.') && got.includes('sentence:item two'));
  assert.equal(got.filter((k) => k.startsWith('fence')).length, 1);
  assert.deepEqual(got.filter((k) => k.startsWith('comment')), ['comment:a comment']);
  assert.ok(!got.some((k) => k.startsWith('metadata')), 'metadata.ink is enforced by validate.mjs, not a claim unit');
});

test('units: headings only count when they read like a claim', () => {
  const md = '## `Spinner`\n\n## The default is `row`, not `column`\n';
  assert.deepEqual(kinds(md), ['heading:The default is `row`, not `column`']);
});

test('units: "Related skills:" lines are structural, the generated matrix is one unit', () => {
  const md = 'Related skills: a, b\n\n<!-- ECOSYSTEM_MATRIX:START (x) -->\n\n| a |\n| --- |\n| b |\n\n<!-- ECOSYSTEM_MATRIX:END -->\n\nAfter it.\n';
  const got = kinds(md);
  assert.ok(got.some((k) => k.startsWith('structural:Related skills')));
  assert.equal(got.filter((k) => k.startsWith('generated')).length, 1);
  assert.ok(!got.some((k) => k.startsWith('row')), 'rows inside the generated block are not units');
  assert.ok(got.includes('sentence:After it.'));
});

test('fact tokens: code spans, bold, numbers and quoted strings; not prose words', () => {
  assert.deepEqual(
    factTokens('The `maxFps` default is 30, **not** 60 and prints "hello" at 80×24.').sort(),
    ['"hello"'.replace(/"/g, ''), '30', '60', '80×24', 'maxFps', 'not'].sort(),
  );
});

test('findAll returns every start index', () => {
  assert.deepEqual(findAll('abcabc', 'bc'), [1, 4]);
});

test('every real skill file: units are exact slices of the normalized text, in order, none empty', () => {
  const files = allSkillFiles().flatMap((s) => s.files.map((f) => [s.skill, f]));
  assert.ok(files.length >= 31, `expected ≥31 skill files (28 skills + 3 references), saw ${files.length}`);
  for (const [skill, file] of files) {
    const { N, units } = loadFile(skill, file);
    assert.ok(units.length > 0, `${skill}/${file}: no units`);
    for (const u of units) {
      assert.ok(u.text.length > 0, `${skill}/${file}: empty unit ${u.id}`);
      assert.equal(N.slice(u.start, u.end), u.text, `${skill}/${file}: ${u.id} is not a slice of N`);
    }
  }
});
