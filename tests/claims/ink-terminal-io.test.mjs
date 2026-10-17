// Claims for skills/core/ink-terminal-io/SKILL.md.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import stringWidth from 'string-width';
import { skill, tsx, h, ink, mount, keys, screenOf, runIsolated, packageDir, fakeStdin, fakeStdout, waitFor } from '../lib/index.mjs';
import { ptyRun, logged, runDetached, cursorAfter } from './ink-terminal-io.helpers.mjs';

const { Box, Text, Static } = ink;
const s = skill('ink-terminal-io');
const F = 'SKILL.md';

const TTY = { isTTY: true, columns: 80, rows: 24 };
const FRAME = h(Text, null, 'frame');
const ENV = { FORCE_COLOR: '0', TERM: 'xterm-256color' };
const PROBE = process.execPath;
const probeFile = (name) => join('tests', 'probes', `${name}.mjs`);
/** What a terminal shows after these bytes (a pty turns every newline into carriage return + newline). */
const screen = (bytes) => screenOf(bytes.replace(/\r/g, ''));
const names = (token) => token.slice(1, -1).split(',').map((name) => name.trim());

/** Mount a component that hands its hook result to the test. */
function mountHook(useHook, options = {}) {
  const seen = {};
  const Probe = () => {
    seen.value = useHook();
    return FRAME;
  };
  const app = mount(h(Probe), options);
  return { app, seen };
}

// ===================================================================== description

const DESCRIPTION =
  'Low-level terminal I/O hooks in Ink — useStdout/useStderr for writing outside the managed render (write-without-tearing), useStdin for the raw stdin stream and setRawMode/isRawModeSupported, useWindowSize for terminal dimensions with resize updates, and useCursor for controlling the terminal cursor position';

s.fact(F, [DESCRIPTION], { kind: 'R' }, async (t) => {
  const hooks = [...DESCRIPTION.matchAll(/\buse[A-Z]\w+/g)].map((match) => match[0]);
  t.deepEqual(hooks, ['useStdout', 'useStderr', 'useStdin', 'useWindowSize', 'useCursor']);
  for (const hook of hooks) t.equal(typeof ink[hook], 'function', `${hook} is exported`);

  const stdin = mountHook(ink.useStdin);
  await stdin.app.flush();
  t.ok('setRawMode' in stdin.seen.value && 'isRawModeSupported' in stdin.seen.value, 'useStdin has setRawMode and isRawModeSupported');
  t.equal(typeof stdin.seen.value.stdin.on, 'function', 'and the raw stdin stream');

  const stdout = mountHook(ink.useStdout);
  await stdout.app.flush();
  stdout.seen.value.write('outside\n');
  await stdout.app.flush();
  t.equal(stdout.app.screen(), 'outside\nframe', 'useStdout writes outside the render without tearing it');

  const size = mountHook(ink.useWindowSize, { columns: 40, rows: 12 });
  await size.app.flush();
  t.deepEqual(size.seen.value, { columns: 40, rows: 12 });
  await size.app.resize(30, 10);
  t.deepEqual(size.seen.value, { columns: 30, rows: 10 }, 'with resize updates');

  const cursor = mountHook(ink.useCursor);
  await cursor.app.flush();
  t.deepEqual(Object.keys(cursor.seen.value), ['setCursorPosition'], 'useCursor controls the cursor position');
});

s.guidance(F, ['(IME support)'], 'a use case named in the description; whether an input method honours the terminal cursor is up to the operating system and the terminal, which this suite cannot run');

s.guidance(F, ["Use when useInput/useApp aren't the right fit."], 'a pointer to when the skill applies; it asserts nothing about behaviour');

// ===================================================================== useStdout / useStderr

s.fact(
  F,
  ['Both return `{stdout, write}` / `{stderr, write}` — the underlying stream (`process.stdout`/`process.stderr` by default, or whatever was passed to `render()`) plus a `write(data: string)` helper.'],
  { kind: 'D', ctx: ['write(data: string)'] },
  async (t, q) => {
    const [outKey, writeKey] = names(q.tok('{stdout, write}'));
    const [errKey, errWriteKey] = names(q.tok('{stderr, write}'));
    const render = q.api(ink, 'render()');
    const streams = { stdout: fakeStdout(), stderr: fakeStdout(), stdin: fakeStdin() };
    const seen = {};
    const Hooks = () => {
      seen.out = ink.useStdout();
      seen.err = ink.useStderr();
      return FRAME;
    };
    const instance = render(h(Hooks), { ...streams, exitOnCtrlC: false, patchConsole: false });
    try {
      await instance.waitUntilRenderFlush();
      t.deepEqual(Object.keys(seen.out), [outKey, writeKey], 'useStdout returns exactly the stream and write');
      t.deepEqual(Object.keys(seen.err), [errKey, errWriteKey], 'useStderr returns exactly the stream and write');
      t.equal(seen.out[outKey], streams.stdout, 'the stream passed to render()');
      t.equal(seen.err[errKey], streams.stderr);
      t.equal(typeof seen.out[writeKey], 'function');
    } finally {
      instance.unmount();
    }

    // without streams in render(): the process's own
    const run = await runIsolated({ probe: 'ink-terminal-io-streams', env: { ...ENV, PROBE_SCENARIO: 'identity', PROBE_STDOUT: q.tok('process.stdout'), PROBE_STDERR: q.tok('process.stderr') }, tty: TTY });
    t.equal(run.json?.sameStdout, true, 'process.stdout by default');
    t.equal(run.json?.sameStderr, true, 'process.stderr by default');
    const other = await runIsolated({ probe: 'ink-terminal-io-streams', env: { ...ENV, PROBE_SCENARIO: 'identity', PROBE_STDOUT: 'process.stderr' }, tty: TTY });
    t.equal(other.json?.sameStdout, false, 'positive control: a different stream is not what the hook returns');
  },
);

s.types(
  F,
  ['plus a `write(data: string)` helper'],
  tsx`
import {useStdout, useStderr} from 'ink';

export const Example = () => {
	const {write} = useStdout();
	const {write: writeError} = useStderr();
	write('text'); // write(data: string)
	writeError('text');
	write(1); //! TS2345
	return null;
};
`,
);

s.fact(
  F,
  ["`write` is the key part: it writes a plain string **without tearing Ink's managed output** — similar to `<Static>`, but for a one-off string instead of a list of components."],
  { kind: 'R', ctx: ["without tearing Ink's managed output"] },
  async (t, q) => {
    const key = q.tok('write');
    const Staticc = q.el(ink, '<Static>');
    const Live = ({ n }) => h(Text, null, `frame ${n}`);
    const hooked = mountHook(ink.useStdout);
    await hooked.app.flush();
    hooked.seen.value[key]('written\n');
    await hooked.app.flush();
    await hooked.app.rerender(h(Live, { n: 2 }));
    t.equal(hooked.app.screen(), 'written\nframe 2', 'the string stays above the live frame, which is redrawn cleanly below it');

    const fixed = mount(h(Box, { flexDirection: 'column' }, h(Staticc, { items: ['written'] }, (item) => h(Text, { key: item }, item)), h(Live, { n: 1 })));
    await fixed.flush();
    t.equal(fixed.screen(), 'written\nframe 1', '<Static> leaves its text in the same place, above the live frame');

    // positive control: the same bytes written straight to the stream do tear the frame
    const torn = mount(h(Live, { n: 1 }));
    await torn.flush();
    torn.stdout.write('written\n');
    await torn.rerender(h(Live, { n: 2 }));
    t.equal(torn.screen(), 'frame 1\nframe 2', 'directly written text is erased by the next frame and the old frame is left behind');
  },
);

s.types(
  F,
  ['`stdout`/`stderr` are typed `NodeJS.WritableStream`, so `stdout.columns`, `stdout.rows` and `stdout.isTTY` do not type-check.'],
  tsx`
import {useStdout, useStderr} from 'ink';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const Example = () => {
	const {stdout} = useStdout();
	const {stderr} = useStderr();
	const sameStdout: Same<typeof stdout, NodeJS.WritableStream> = true;
	const sameStderr: Same<typeof stderr, NodeJS.WritableStream> = true;
	const columns = stdout.columns; //! TS2339
	const rows = stdout.rows; //! TS2339
	const isTTY = stdout.isTTY; //! TS2339
	const errorColumns = stderr.columns; //! TS2339
	return [sameStdout, sameStderr, columns, rows, isTTY, errorColumns];
};
`,
);

s.types(
  F,
  ["(`stdout.on('resize', …)` still compiles"],
  tsx`
import {useStdout} from 'ink';

export const Example = () => {
	const {stdout} = useStdout();
	// stdout.on('resize', …)
	stdout.on('resize', () => {});
	return null;
};
`,
  { ctx: ["stdout.on('resize', …)"] },
);

s.fact(
  F,
  ["a TTY stream emits `resize` when its window size changes.)"],
  { kind: 'R', timeout: 30_000 },
  async (t, q) => {
    const event = q.tok('resize');
    const run = ptyRun({ argv: [PROBE, probeFile('ink-terminal-io-tty')], cols: 40, rows: 12, env: { ...ENV, PROBE_SCENARIO: 'size', PROBE_EVENT: event } });
    try {
      await run.waitFor('@@ ready tty=true');
      t.deepEqual(logged(run), ['ready tty=true raw=false'], 'a real terminal: process.stdout is a TTY');
      run.resize(60, 20);
      await run.waitFor('size 60x20');
      const heard = await Promise.race([run.waitFor('@@ resize 60x20').then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), 3000))]);
      t.equal(heard, true, 'the stream emitted resize after the window changed size');
      t.deepEqual(logged(run).slice(1), ['resize 60x20']);
    } finally {
      run.kill();
    }
  },
);

s.fact(F, ['Use `useWindowSize()` for dimensions and resize — it re-renders on resize and returns a size even for non-TTY output.'], { kind: 'R' }, async (t, q) => {
  const useWindowSize = q.api(ink, 'useWindowSize()');
  const { app, seen } = mountHook(useWindowSize, { columns: 50, rows: 14 });
  await app.flush();
  t.deepEqual(seen.value, { columns: 50, rows: 14 });
  await app.resize(33, 9);
  t.deepEqual(seen.value, { columns: 33, rows: 9 }, 'it re-renders on resize');
  const piped = await runDetached({ probe: 'ink-terminal-io-size' });
  t.equal(piped.json.stdoutColumns, null, 'positive control: this process has no terminal size to read');
  t.deepEqual(piped.json.size, { columns: 80, rows: 24 }, 'and the hook still returns one');
});

s.fence(F, 0, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const { mod } = await runFence(fence);
    const app = mount(h(mod.Example));
    await app.flush();
    t.equal(app.screen(), 'Hello from Ink to stdout', 'the string is written, once');
    t.equal(app.bytes().split('Hello from Ink to stdout').length, 2);
  },
});

s.fact(
  F,
  ["Never write to `process.stdout`/`process.stderr` directly from inside a mounted Ink app — it will interleave with (and corrupt) Ink's own frame writes."],
  { kind: 'R', timeout: 30_000 },
  async (t, q) => {
    const run = async (scenario, direct) => {
      const pty = ptyRun({ argv: [PROBE, probeFile('ink-terminal-io-streams')], env: { ...ENV, PROBE_SCENARIO: scenario, PROBE_DIRECT: direct } });
      const { code } = await pty.end;
      const output = pty.output();
      return { code, shown: screen(output.slice(0, output.lastIndexOf('{"sameStdout"'))) };
    };
    const hook = await run('hook', 'process.stdout');
    t.equal(hook.shown, 'HOOK\nframe 2', 'positive control: the hook writes cleanly and the frame follows');
    for (const stream of [q.tok('process.stdout'), q.tok('process.stderr')]) {
      const direct = await run('direct', stream);
      t.equal(direct.code, 0);
      t.equal(direct.shown, 'frame 1\nframe 2', `${stream}: the next frame erases the written text and leaves the previous frame behind`);
    }
  },
);

s.fact(
  F,
  ["Use these hooks' `write`, or `console.*` (Ink intercepts console output by default via `patchConsole`, see `ink-rendering-and-lifecycle`)."],
  { kind: 'D', ctx: ['ink-rendering-and-lifecycle'] },
  async (t, q) => {
    const method = globalThis[q.tok('console.*').split('.')[0]].log;
    const patchOption = q.tok('patchConsole');
    const write = mountHook(ink.useStdout);
    await write.app.flush();
    write.seen.value[q.tok('write')]('via write\n');
    await write.app.flush();
    t.equal(write.app.screen(), 'via write\nframe');

    // render() with its default options: console output is intercepted and printed above the frame
    const live = [];
    const make = (extra) => {
      const stdout = fakeStdout();
      const instance = ink.render(FRAME, { stdout, stderr: fakeStdout(), stdin: fakeStdin(), exitOnCtrlC: false, ...extra });
      live.push(instance);
      return { stdout, instance };
    };
    const original = process.stdout.write;
    const before = method;
    try {
      const patched = make({});
      await patched.instance.waitUntilRenderFlush();
      console.log('via console');
      await patched.instance.waitUntilRenderFlush();
      t.equal(screenOf(patched.stdout.bytes()), 'via console\nframe', 'by default console.log lands above the frame');
      t.notEqual(console.log, before, 'console.log has been replaced while the app is mounted');
      patched.instance.unmount();
      t.equal(console.log, before, 'and is restored afterwards');

      const raw = [];
      const untouched = make({ [patchOption]: false });
      await untouched.instance.waitUntilRenderFlush();
      process.stdout.write = (chunk) => (raw.push(String(chunk)), true);
      console.log('not intercepted');
      process.stdout.write = original;
      t.deepEqual(raw, ['not intercepted\n'], `positive control: with ${patchOption}: false it goes to the process's own stdout`);
      t.equal(screenOf(untouched.stdout.bytes()), 'frame');
    } finally {
      process.stdout.write = original;
      for (const instance of live) instance.unmount();
    }
  },
);

// ===================================================================== useStdin

s.fact(F, ['Returns `{stdin, isRawModeSupported, setRawMode}`.'], { kind: 'R' }, async (t, q) => {
  const [streamKey, supportedKey, setKey] = names(q.tok('{stdin, isRawModeSupported, setRawMode}'));
  const { app, seen } = mountHook(ink.useStdin);
  await app.flush();
  const value = seen.value;
  t.equal(value[streamKey], app.stdin, 'the stdin stream passed to render()');
  t.equal(value[supportedKey], true, 'a boolean');
  t.equal(typeof value[setKey], 'function');
  value[setKey](true);
  t.deepEqual(app.stdin.rawModeCalls, [true], 'which switches raw mode on the stream');
});

s.types(
  F,
  ['Returns `{stdin, isRawModeSupported, setRawMode}`.'],
  tsx`
import {useStdin} from 'ink';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Result = ReturnType<typeof useStdin>;

export const keys: Same<keyof Result, 'stdin' | 'isRawModeSupported' | 'setRawMode'> = true;
export const supported: Same<Result['isRawModeSupported'], boolean> = true;
export const setRaw: Same<Result['setRawMode'], (isEnabled: boolean) => void> = true;
`,
  { ctx: ['{stdin, isRawModeSupported, setRawMode}'] },
);

s.guidance(
  F,
  ['Reach for this instead of `useInput` when you need the raw stream itself (e.g. piping it somewhere)'],
  'when to use useStdin rather than useInput is a recommendation; what the stream and the input hooks do is shown by the neighbouring claims',
  { exempt: ['useInput'] },
);

s.fact(
  F,
  ['`useInput`/`usePaste` (see `ink-input-handling`) read keypresses and already manage raw mode for you.'],
  { kind: 'R', ctx: ['ink-input-handling'] },
  async (t, q) => {
    const useInput = q.api(ink, 'useInput');
    const usePaste = q.api(ink, 'usePaste');
    for (const [name, hook] of [['useInput', useInput], ['usePaste', usePaste]]) {
      const Probe = () => (hook(() => {}), FRAME);
      const app = mount(h(Probe));
      await app.flush();
      t.deepEqual(app.stdin.rawModeCalls, [true], `${name} switches raw mode on`);
      await app.unmount();
      await waitFor(() => app.stdin.rawModeCalls.length === 2);
      t.deepEqual(app.stdin.rawModeCalls, [true, false], `${name} switches it off when the component goes away`);
    }
    const seen = [];
    const Reader = () => (useInput((input) => seen.push(input)), FRAME);
    const reader = mount(h(Reader));
    await reader.flush();
    await reader.press('a');
    t.deepEqual(seen, ['a'], 'useInput reads keypresses');
    const idle = mount(FRAME);
    await idle.flush();
    t.deepEqual(idle.stdin.rawModeCalls, [], 'positive control: an app with no input hook never switches raw mode');
  },
);

s.fact(
  F,
  ['use `isRawModeSupported` (true only when stdin is a TTY with `setRawMode`) instead.'],
  { kind: 'R' },
  async (t, q) => {
    const supported = q.tok('isRawModeSupported');
    const rawMode = q.tok('setRawMode');
    const support = async (stdin) => {
      const { app, seen } = mountHook(ink.useStdin, { render: { stdin } });
      await app.flush();
      return seen.value[supported];
    };
    t.equal(await support(fakeStdin({ isTTY: true })), true, 'a TTY with setRawMode');
    const noMethod = fakeStdin({ isTTY: true });
    delete noMethod[rawMode];
    t.equal(await support(noMethod), false, 'a TTY without setRawMode');
    t.equal(await support(fakeStdin({ isTTY: false })), false, 'a stream that is not a TTY');
    const plainStream = fakeStdin({ isTTY: false });
    plainStream[rawMode] = () => {};
    t.equal(await support(plainStream), false, 'even with a setRawMode method');
  },
);

s.types(
  F,
  ['`stdin` is typed `NodeJS.ReadableStream`, so `stdin.isTTY` does not type-check:'],
  tsx`
import {useStdin} from 'ink';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const Example = () => {
	const {stdin, isRawModeSupported, setRawMode} = useStdin();
	const same: Same<typeof stdin, NodeJS.ReadableStream> = true;
	const isTTY = stdin.isTTY; //! TS2339
	return [same, isTTY, isRawModeSupported, setRawMode];
};
`,
);

s.fact(
  F,
  ['`useInput` drops unrecognized control sequences (mouse reports, focus in/out, cursor-position reports), and keypad Enter arrives as `key.return`; if you need those raw sequences, read `stdin` directly.'],
  { kind: 'R', timeout: 30_000, ctx: ['stdin'] },
  async (t, q) => {
    const returnKey = q.tok('key.return').split('.')[1];
    const mouse = '\x1b[<0;10;5M';
    const focusIn = '\x1b[I';
    const focusOut = '\x1b[O';
    const report = '\x1b[12;40R';
    const keypadEnter = '\x1bOM';
    const run = await runIsolated({
      probe: 'ink-terminal-io-raw',
      env: { ...ENV, PROBE_HOOK: q.tok('useInput') },
      tty: TTY,
      stdin: [[60, mouse], [120, focusIn], [180, focusOut], [240, report], [300, keypadEnter], [360, 'a'], [440, 'z']],
    });
    t.equal(run.code, 0, run.stderr);
    t.deepEqual(run.json.inputs, [{ input: '\r', [returnKey]: true }, { input: 'a', [returnKey]: false }], 'useInput saw only keypad Enter (as the return key) and the letter');
    t.deepEqual(run.json.raw, [mouse, focusIn, focusOut, report, keypadEnter, 'a', 'z'], 'the stream itself delivered every sequence');
  },
);

s.fence(F, 1, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const { mod } = await runFence(fence);
    const supported = mount(h(mod.Example));
    await supported.flush();
    t.deepEqual(supported.stdin.rawModeCalls, [true], 'raw mode on while mounted');
    await supported.unmount();
    t.deepEqual(supported.stdin.rawModeCalls, [true, false], 'and off again afterwards');
    const piped = mount(h(mod.Example), { stdinIsTTY: false });
    await piped.flush();
    t.deepEqual(piped.stdin.rawModeCalls, [], 'with a stdin that has no raw mode the guard keeps it from throwing');
  },
});

s.fact(
  F,
  ['**Always check `isRawModeSupported` before calling `setRawMode`** — it throws when the current stdin doesn\'t support raw mode (for example piped input).'],
  { kind: 'R', ctx: ['Always check `isRawModeSupported` before calling `setRawMode`'] },
  async (t, q) => {
    const supported = q.tok('isRawModeSupported');
    const setRawMode = q.tok('setRawMode');
    const piped = mountHook(ink.useStdin, { render: { stdin: fakeStdin({ isTTY: false }) } });
    await piped.app.flush();
    t.equal(piped.seen.value[supported], false);
    t.throws(() => piped.seen.value[setRawMode](true), /Raw mode is not supported on the stdin provided to Ink/);
    t.throws(() => piped.seen.value[setRawMode](false), /Raw mode is not supported/, 'switching it off throws too');
    const tty = mountHook(ink.useStdin);
    await tty.app.flush();
    t.doesNotThrow(() => tty.seen.value[setRawMode](true), 'positive control: with raw mode support it does not');

    // the process's own piped stdin
    const run = await runIsolated({ probe: 'ink-terminal-io-streams', env: { ...ENV, PROBE_SCENARIO: 'raw' }, tty: {} });
    t.equal(run.json.isRawModeSupported, false);
    t.match(run.json.rawThrew, /Raw mode is not supported on the current process\.stdin/);
  },
);

s.fact(
  F,
  ["Use Ink's `setRawMode`, never `process.stdin.setRawMode` directly — Ink needs to intercept Ctrl+C itself when raw mode is on."],
  { kind: 'R', timeout: 45_000 },
  async (t, q) => {
    const method = q.tok('setRawMode');
    const direct = q.tok('process.stdin.setRawMode');
    t.equal(direct, `process.stdin.${method}`);
    const run = (scenario, extra = {}) => ptyRun({ argv: [PROBE, probeFile('ink-terminal-io-tty')], env: { ...ENV, PROBE_SCENARIO: scenario, ...extra } });

    // without raw mode the terminal turns Ctrl+C into SIGINT
    const cooked = run('idle');
    try {
      await cooked.waitFor('@@ ready');
      cooked.write('\x03');
      t.deepEqual(await cooked.end, { code: null, signal: 2 }, 'cooked mode: Ctrl+C is SIGINT');
    } finally {
      cooked.kill();
    }

    // Ink's setRawMode (through useInput): Ctrl+C reaches Ink as input and Ink exits by itself
    const viaInk = run('keys');
    try {
      await viaInk.waitFor('@@ ready tty=true raw=true');
      viaInk.write('\x03');
      t.deepEqual(await viaInk.end, { code: 0, signal: null }, 'Ink raw mode: Ink handles Ctrl+C and exits normally');
      t.ok(logged(viaInk).includes('exited'));
    } finally {
      viaInk.kill();
    }

    // process.stdin.setRawMode directly: Ink never sees the key, and the terminal no longer sends SIGINT
    const bypass = run('direct');
    try {
      await bypass.waitFor('@@ ready tty=true raw=true');
      bypass.write('\x03');
      await bypass.waitFor('@@ data 03');
      bypass.write('q');
      t.deepEqual(await bypass.end, { code: 0, signal: null }, 'direct raw mode: Ctrl+C neither exits the app nor interrupts it, it is just a byte');
      t.ok(!logged(bypass).includes('exited'), 'Ink did not exit on it');
    } finally {
      bypass.kill();
    }
  },
);

// ===================================================================== useWindowSize

s.fact(F, ['Returns `{columns, rows}` and re-renders your component on terminal resize.'], { kind: 'R' }, async (t, q) => {
  const [columns, rows] = names(q.tok('{columns, rows}'));
  const { app, seen } = mountHook(ink.useWindowSize, { columns: 70, rows: 20 });
  await app.flush();
  t.deepEqual(Object.keys(seen.value), [columns, rows]);
  t.deepEqual(seen.value, { [columns]: 70, [rows]: 20 });
  await app.resize(55, 18);
  t.deepEqual(seen.value, { [columns]: 55, [rows]: 18 }, 'a resize event re-renders with the new size');
  await app.resize(90, 40);
  t.deepEqual(seen.value, { [columns]: 90, [rows]: 40 }, 'wider as well as narrower');
});

s.types(
  F,
  ['Returns `{columns, rows}`'],
  tsx`
import {useWindowSize} from 'ink';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const same: Same<ReturnType<typeof useWindowSize>, {readonly columns: number; readonly rows: number}> = true;
`,
  { ctx: ['{columns, rows}'] },
);

s.fact(
  F,
  ['When the stream reports no size (e.g. piped output) it falls back to the size of `process.stderr`, then to the `COLUMNS` and `LINES` environment variables (both must be set), then to the controlling terminal, and finally to 80×24.'],
  { kind: 'D', timeout: 30_000 },
  async (t, q) => {
    const stderr = q.tok('process.stderr');
    const columnsVar = q.tok('COLUMNS');
    const linesVar = q.tok('LINES');
    const [defaultColumns, defaultRows] = q.tok('80×24').split('×').map(Number);
    const size = async (env) => (await runDetached({ probe: 'ink-terminal-io-size', env })).json;

    const bare = await size({});
    t.equal(bare.stdoutColumns, null, 'stdout is a pipe: it reports no size');
    t.deepEqual(bare.size, { columns: defaultColumns, rows: defaultRows }, 'with nothing else to ask: 80×24');

    const fromEnv = await size({ [columnsVar]: '33', [linesVar]: '11' });
    t.deepEqual(fromEnv.size, { columns: 33, rows: 11 }, 'the environment variables');
    t.deepEqual((await size({ [columnsVar]: '33' })).size, bare.size, 'COLUMNS alone is not enough');
    t.deepEqual((await size({ [linesVar]: '11' })).size, bare.size, 'neither is LINES alone');

    const withStderr = { PROBE_SIZE_STREAM: stderr, PROBE_SIZE: JSON.stringify({ columns: 50, rows: 9 }) };
    t.deepEqual((await size(withStderr)).size, { columns: 50, rows: 9 }, 'the size of process.stderr');
    t.deepEqual((await size({ ...withStderr, [columnsVar]: '33', [linesVar]: '11' })).size, { columns: 50, rows: 9 }, 'which comes before the environment variables');

    // the controlling terminal: a pty whose stdout and stderr are redirected, so that only /dev/tty can tell
    const pty = ptyRun({ argv: ['/bin/sh', '-c', `exec "$0" "$1" 2>/dev/null | /bin/cat`, PROBE, probeFile('ink-terminal-io-size')], cols: 37, rows: 13, env: { ...ENV } });
    try {
      const match = await pty.waitFor(/"size":\{"columns":(\d+),"rows":(\d+)\}/);
      t.deepEqual([Number(match[1]), Number(match[2])], [37, 13], 'the terminal the process is attached to, when stdout, stderr and the environment give nothing');
      await pty.end;
    } finally {
      pty.kill();
    }
  },
);

s.guidance(
  F,
  ['Use it whenever layout needs to react to the terminal size (see `ink-fullscreen-layouts` for full-screen/responsive layouts built on top of it).'],
  'a recommendation and a pointer to another skill; the behaviour of the hook itself is covered by the claims above',
);

s.fence(F, 2, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const { mod } = await runFence(fence);
    const app = mount(h(mod.Example), { columns: 64, rows: 18 });
    await app.flush();
    t.equal(app.screen(), '64x18');
    await app.resize(40, 12);
    t.equal(app.screen().split('\n').at(-1), '40x12', 'the latest frame shows the new size');
  },
});

s.fact(F, ['Note: when the terminal is resized narrower, Ink erases its previous frame and redraws it at the new width.'], { kind: 'R' }, async (t) => {
  const Static3 = () => h(Box, { flexDirection: 'column' }, h(Text, null, 'one'), h(Text, null, 'two'), h(Text, null, 'three'));
  const app = mount(h(Static3), { columns: 40, rows: 10 });
  await app.flush();
  const before = app.bytes().length;
  await app.resize(20, 10);
  const narrower = app.bytes().slice(before);
  t.ok(narrower.startsWith('\x1b[2K\x1b[1A\x1b[2K\x1b[1A\x1b[2K\x1b[1A\x1b[2K\x1b[G'), 'the three rows of the frame are erased first');
  t.ok(narrower.includes('one\ntwo\nthree\n'), 'and the same frame is drawn again');
  const mark = app.bytes().length;
  await app.resize(60, 10);
  t.equal(app.bytes().slice(mark), '', 'positive control: a wider terminal leaves an unchanged frame alone');
});

// ===================================================================== useCursor

const CURSOR_FRAME = (position) => {
  const Cursor = () => {
    const { setCursorPosition } = ink.useCursor();
    setCursorPosition(position);
    return h(Box, { flexDirection: 'column' }, h(Text, null, 'line0'), h(Text, null, 'line1'), h(Text, null, 'line2'));
  };
  return h(Cursor);
};

s.fact(
  F,
  ['Returns `{setCursorPosition}` — controls where the terminal cursor sits after each render; Ink keeps the cursor hidden unless a position is set.'],
  { kind: 'R' },
  async (t, q) => {
    const method = names(q.tok('{setCursorPosition}'))[0];
    const hidden = mount(CURSOR_FRAME(undefined));
    await hidden.flush();
    t.equal(cursorAfter(hidden.bytes()).visible, false, 'no position: the cursor is hidden');
    t.ok(!hidden.bytes().includes('\x1b[?25h'), 'and never shown');

    const Component = ({ at }) => {
      const result = ink.useCursor();
      result[method](at);
      return h(Box, { flexDirection: 'column' }, h(Text, null, 'line0'), h(Text, null, 'line1'), h(Text, null, 'line2'));
    };
    const app = mount(h(Component, { at: { x: 4, y: 2 } }));
    await app.flush();
    t.deepEqual(cursorAfter(app.bytes()), { row: 2, column: 4, visible: true }, 'a position: the cursor is shown there');
    await app.rerender(h(Component, { at: { x: 1, y: 0 } }));
    t.deepEqual(cursorAfter(app.bytes()), { row: 0, column: 1, visible: true }, 'after the next render it sits at the new position');
    const result = mountHook(ink.useCursor);
    await result.app.flush();
    t.deepEqual(Object.keys(result.seen.value), [method], 'and the hook returns nothing else');
  },
);

s.types(
  F,
  ['Returns `{setCursorPosition}`'],
  tsx`
import {useCursor} from 'ink';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Position = {x: number; y: number} | undefined;

export const keys: Same<keyof ReturnType<typeof useCursor>, 'setCursorPosition'> = true;
export const param: Same<Parameters<ReturnType<typeof useCursor>['setCursorPosition']>[0], Position> = true;
`,
  { ctx: ['{setCursorPosition}'] },
);

s.guidance(
  F,
  ['Use it in a custom text input that needs the real cursor at its caret, for example for **IME (Input Method Editor)** support;'],
  'a recommendation about when to reach for the hook; whether an input method honours the terminal cursor depends on the operating system and terminal, which this suite cannot run',
  { exempt: ['IME (Input Method Editor)'] },
);

s.fact(F, ["none of `@inkjs/ui`'s components call it (see `inkjs-ui-inputs`)."], { kind: 'P', ctx: ['inkjs-ui-inputs'] }, async (t, q) => {
  const dir = packageDir(q.tok('@inkjs/ui'));
  const sources = readdirSync(join(dir, 'build'), { recursive: true }).filter((file) => /\.js$/.test(file));
  const text = sources.map((file) => readFileSync(join(dir, 'build', file), 'utf8')).join('\n');
  t.ok(sources.length > 10, `looked at ${sources.length} files of the package`);
  t.ok(/\buseInput\b/.test(text), 'positive control: the search finds a hook the package does use');
  t.ok(!/\buseCursor\b|\bsetCursorPosition\b/.test(text), 'neither useCursor nor setCursorPosition appears in it');
});

s.fence(F, 3, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const { mod } = await runFence(fence);
    const app = mount(h(mod.Prompt));
    await app.flush();
    t.equal(app.screen(), 'Type here:\n>', 'the prompt');
    t.deepEqual(cursorAfter(app.bytes()), { row: 1, column: 2, visible: true }, 'the cursor sits after "> " on the second row');
    await app.press('a');
    await app.press('b');
    t.deepEqual(cursorAfter(app.bytes()), { row: 1, column: 4, visible: true }, 'and follows the text');
    await app.press(keys.backspace);
    t.deepEqual(cursorAfter(app.bytes()), { row: 1, column: 3, visible: true }, 'backwards as well');
  },
});

s.fact(
  F,
  ["Use string-width, not .length, so wide characters (CJK, emoji) don't", 'throw off the column position.'],
  { kind: 'R' },
  async (t) => {
    const { mod } = await s.runFence(F, 3);
    const app = mount(h(mod.Prompt));
    await app.flush();
    await app.press('あ');
    const typed = '> あ';
    t.equal(stringWidth(typed), 4, 'a CJK character takes two columns');
    t.equal(typed.length, 3, 'although it is one UTF-16 unit');
    t.deepEqual(cursorAfter(app.bytes()), { row: 1, column: stringWidth(typed), visible: true }, 'the cursor is placed by the width, after the wide character');
    await app.press('😀');
    t.deepEqual(cursorAfter(app.bytes()), { row: 1, column: stringWidth('> あ😀'), visible: true }, 'an emoji counts for its width as well');
    t.notEqual(stringWidth('> あ😀'), '> あ😀'.length, 'positive control: .length would have given another column');
  },
);

s.fact(
  F,
  ['`position` is `{x, y}` (0-based column, 0-based row from the top of Ink\'s output) or `undefined` to hide the cursor entirely.'],
  { kind: 'R', ctx: ['position'] },
  async (t, q) => {
    const [x, y] = names(q.tok('{x, y}'));
    const origin = Number(q.tok('0'));
    const none = q.tok('undefined');
    t.ok(none in globalThis, 'undefined is the value that hides it');
    const hide = globalThis[none];
    const Component = ({ at }) => {
      const { setCursorPosition } = ink.useCursor();
      setCursorPosition(at);
      return h(Box, { flexDirection: 'column' }, h(Text, null, 'line0'), h(Text, null, 'line1'), h(Text, null, 'line2'), h(Text, null, 'line3'));
    };
    for (const [column, row] of [[0, 0], [3, 1], [7, 3]]) {
      const app = mount(h(Component, { at: { [x]: column + origin, [y]: row + origin } }));
      await app.flush();
      t.deepEqual(cursorAfter(app.bytes()), { row, column, visible: true }, `column ${column}, row ${row}, counted from the first column of the first line of the output`);
      await app.rerender(h(Component, { at: hide }));
      t.equal(cursorAfter(app.bytes()).visible, false, 'undefined hides it again');
    }
  },
);
