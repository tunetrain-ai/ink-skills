import test from 'node:test';
import assert from 'node:assert/strict';
import { React, ink, h, mount, keys, screenOf, stripAnsi, runIsolated, catchRenderError, pkg, waitFor, cleanupMounts } from './harness.mjs';

const { Box, Text, useInput, useWindowSize } = ink;

test('mount renders on a fake TTY and records raw bytes', async () => {
  const app = mount(h(Text, { color: 'green' }, 'hello'), { columns: 40 });
  await app.flush();
  assert.equal(app.screen(), 'hello');
  assert.match(app.bytes(), /\x1b\[32m/, 'colour reaches the stream as SGR (FORCE_COLOR is on)');
  assert.equal(stripAnsi(app.bytes()).includes('hello'), true);
  await cleanupMounts();
});

test('press drives useInput, including arrows and a lone ESC', async () => {
  const seen = [];
  const App = () => {
    useInput((input, key) => seen.push(key.upArrow ? 'up' : key.escape ? 'esc' : key.return ? 'enter' : input));
    return h(Text, null, 'x');
  };
  const app = mount(h(App));
  await app.press(keys.up, 'a', keys.enter, keys.esc);
  assert.deepEqual(seen, ['up', 'a', 'enter', 'esc']);
  await cleanupMounts();
});

test('resize updates useWindowSize through the fake stdout', async () => {
  const Size = () => {
    const { columns, rows } = useWindowSize();
    return h(Text, null, `${columns}x${rows}`);
  };
  const app = mount(h(Size), { columns: 50, rows: 20 });
  await app.flush();
  assert.equal(app.screen(), '50x20');
  await app.resize(70, 30);
  assert.equal(app.screen(), '70x30');
  await cleanupMounts();
});

test('screenOf applies erase-line and cursor-up like a terminal', () => {
  assert.equal(screenOf('one\ntwo\n\x1b[2K\x1b[1A\x1b[2K\x1b[Gthree'), 'one\nthree');
});

test('waitFor resolves on the condition and fails only at the deadline', async () => {
  let n = 0;
  assert.equal(await waitFor(() => ++n >= 3 && 'done'), 'done');
  await assert.rejects(waitFor(() => false, { timeout: 60, message: 'never' }), /never not met/);
});

test('catchRenderError returns the error a render throws', () => {
  const err = catchRenderError(h(Box, null, 'raw string'));
  assert.match(String(err?.message), /must be rendered inside <Text>/);
  assert.equal(catchRenderError(h(Text, null, 'fine')), null);
});

test('runIsolated: from-scratch env, fake TTY, empty PATH', async () => {
  const plain = await runIsolated({ probe: 'selftest-env', env: { FORCE_COLOR: '0' } });
  assert.equal(plain.code, 0, plain.stderr);
  assert.deepEqual({ chalkLevel: plain.json.chalkLevel, isInCi: plain.json.isInCi, isTTY: plain.json.isTTY, path: plain.json.path }, { chalkLevel: 0, isInCi: false, isTTY: false, path: '' });

  const tty = await runIsolated({ probe: 'selftest-env', env: { FORCE_COLOR: '' }, tty: { isTTY: true, columns: 120, rows: 40 } });
  assert.deepEqual({ isTTY: tty.json.isTTY, columns: tty.json.columns, rows: tty.json.rows }, { isTTY: true, columns: 120, rows: 40 });

  const ci = await runIsolated({ probe: 'selftest-env', env: { CI: 'true' } });
  assert.equal(ci.json.isInCi, true, 'is-in-ci follows CI at import — the reason the suite normalises it');
});

test('pkg reads installed metadata, including a nested dependency of another package', () => {
  assert.match(pkg('ink').version, /^8\./);
  assert.ok(pkg('cli-boxes', { from: 'ink' }).version);
});

test('findCaseInsensitive finds a file whatever the case of its name, in any path segment', async () => {
  const { findCaseInsensitive } = await import('./harness.mjs');
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(join(tmpdir(), 'ink-skills-case-'));
  mkdirSync(join(dir, 'Docs'));
  writeFileSync(join(dir, 'Docs', 'readme.md'), 'x');
  writeFileSync(join(dir, 'LICENSE'), 'y');
  assert.equal(findCaseInsensitive(dir, 'docs/README.md'), join(dir, 'Docs', 'readme.md'));
  assert.equal(findCaseInsensitive(dir, 'LICENSE'), join(dir, 'LICENSE'));
  assert.equal(findCaseInsensitive(dir, './Docs/../docs/./README.md'), join(dir, 'Docs', 'readme.md'), 'dot segments are followed');
  assert.throws(() => findCaseInsensitive(dir, 'docs/missing.md'), /no "missing.md"/);
});
