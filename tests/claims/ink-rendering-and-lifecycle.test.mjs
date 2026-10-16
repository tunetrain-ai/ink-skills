// Claims for skills/core/ink-rendering-and-lifecycle/SKILL.md.
import { PassThrough, Writable } from 'node:stream';
import semver from 'semver';
import { skill, tsx, h, ink, mount, screenOf, stripAnsi, runIsolated, pkg, fakeStdin, fakeStdout, waitFor } from '../lib/index.mjs';
import { ptyRun, logged } from './ink-terminal-io.helpers.mjs';
import { runFenceLikeInk, runNode } from './ink-rendering-and-lifecycle.helpers.mjs';

const { Box, Text, renderToString } = ink;
const s = skill('ink-rendering-and-lifecycle');
const F = 'SKILL.md';

const TTY = { isTTY: true, columns: 80, rows: 24 };
const ENV = { FORCE_COLOR: '0' };
const FRAME = h(Text, null, 'frame');
const Counter = ({ n = 0 }) => h(Box, { flexDirection: 'column' }, h(Text, null, 'line one'), h(Text, null, `count ${n}`), h(Text, null, 'line three'));
const names = (token) => token.slice(1, -1).split(',').map((name) => name.trim());
const method = (token) => token.replace(/\(.*$/s, '');

/** Run `fn(make)`; `make` renders with ink.render() on fake streams and everything is unmounted afterwards. */
async function withApps(fn) {
  const live = [];
  const make = (element, options = {}, streams = {}) => {
    const stdout = streams.stdout ?? fakeStdout({ isTTY: true });
    const stderr = streams.stderr ?? fakeStdout({ isTTY: true });
    const stdin = streams.stdin ?? fakeStdin({ isTTY: true });
    const instance = ink.render(element, { stdout, stderr, stdin, patchConsole: false, ...options });
    live.push(instance);
    return { instance, stdout, stderr, stdin, screen: () => screenOf(stdout.bytes()), bytes: () => stdout.bytes() };
  };
  try {
    return await fn(make);
  } finally {
    for (const instance of live) instance.unmount();
  }
}

/** Run `fn(timers)` with setTimeout and Date under the test's control (Ink's frame throttle uses both). */
async function withFakeTime(fn) {
  const { mock } = await import('node:test');
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  try {
    return await fn(mock.timers);
  } finally {
    mock.timers.reset();
  }
}

/** Give the event loop `turns` macrotask turns (React's scheduler and Ink's flush need a few). */
async function turns(count = 50) {
  for (let turn = 0; turn < count; turn++) await new Promise((resolve) => setImmediate(resolve));
}

/** A stdout whose write callbacks are held until `release()`: a slow pipe. */
function slowStdout() {
  const out = fakeStdout({ isTTY: true });
  const held = [];
  out.write = (chunk, encoding, callback) => {
    out.writes.push(String(chunk));
    const done = typeof encoding === 'function' ? encoding : callback;
    if (done) held.push(done);
    return true;
  };
  out.release = () => held.splice(0).forEach((done) => done());
  out.pending = () => held.length;
  return out;
}

const processRuns = new Map();
/** One run of the process probe per scenario; several claims read the same one. */
function processProbe(scenario, hook = 'useInput') {
  const key = `${scenario}/${hook}`;
  if (!processRuns.has(key)) {
    processRuns.set(key, runIsolated({ probe: 'ink-rendering-and-lifecycle-process', env: { ...ENV, PROBE_SCENARIO: scenario, PROBE_HOOK: hook, PROBE_ALIVE_MS: '1500' }, tty: scenario === 'input' ? TTY : {}, timeout: 20_000 }));
  }
  return processRuns.get(key);
}
const renderProbe = (env, tty = TTY) => runIsolated({ probe: 'ink-rendering-and-lifecycle-render', env: { ...ENV, ...env }, tty, timeout: 20_000 });

// ===================================================================== description

const DESCRIPTION =
  'Mount and control an Ink app with render() — its options (stdout/stdin/stderr streams, exitOnCtrlC, patchConsole, maxFps, incrementalRendering, concurrent, interactive, alternateScreen, kittyKeyboard), the returned Instance (rerender, unmount, waitUntilExit, waitUntilRenderFlush, clear), renderToString for non-interactive output, and why an Ink process exits immediately with no async work.';

s.fact(F, [DESCRIPTION], { kind: 'R', timeout: 30_000 }, async (t) => {
  const options = DESCRIPTION.match(/its options \(([^)]*)\)/)[1].split(',').map((name) => name.trim());
  const methods = DESCRIPTION.match(/the returned Instance \(([^)]*)\)/)[1].split(',').map((name) => name.trim());
  t.deepEqual(options, ['stdout/stdin/stderr streams', 'exitOnCtrlC', 'patchConsole', 'maxFps', 'incrementalRendering', 'concurrent', 'interactive', 'alternateScreen', 'kittyKeyboard'], 'the options the description lists (the types claim below checks each name)');
  t.deepEqual(methods, ['rerender', 'unmount', 'waitUntilExit', 'waitUntilRenderFlush', 'clear']);
  await withApps(async (make) => {
    const app = make(h(Counter), {});
    for (const name of methods) t.equal(typeof app.instance[name], 'function', `${name} is a method of the returned Instance`);
    await app.instance.waitUntilRenderFlush();
    t.match(app.bytes(), /line one/);
  });
  t.equal(typeof renderToString, 'function', 'renderToString is exported');
  t.equal(renderToString(h(Text, null, 'hi')), 'hi', 'and returns the output as a string');
  const exits = await processProbe('none');
  t.deepEqual(exits.json, { scenario: 'none', alive: false }, 'an Ink process with no async work exits on its own');
});

s.types(
  F,
  [DESCRIPTION],
  tsx`
import {render, type RenderOptions, type Instance} from 'ink';

type Listed = 'stdout' | 'stdin' | 'stderr' | 'exitOnCtrlC' | 'patchConsole' | 'maxFps' | 'incrementalRendering' | 'concurrent' | 'interactive' | 'alternateScreen' | 'kittyKeyboard';
export const options: [Listed] extends [keyof RenderOptions] ? true : false = true;

type Methods = 'rerender' | 'unmount' | 'waitUntilExit' | 'waitUntilRenderFlush' | 'clear';
export const methods: [Methods] extends [keyof Instance] ? true : false = true;

export const instance: Instance = render(null, {typoedOption: true}); //! TS2353
`,
  { ctx: [] },
);

s.guidance(
  F,
  ['Use for "how do I exit/render/test output as a string" questions.'],
  'a pointer to when the skill applies; it asserts nothing about behaviour',
  { exempt: ['how do I exit/render/test output as a string'] },
);

// ===================================================================== requirements

s.fact(F, ['Requires Node >=22 and `react` / `@types/react` >=19.3.0.'], { kind: 'P' }, async (t, q) => {
  const ink8 = pkg('ink');
  const major = q.tok('22');
  const version = q.tok('19.3.0');
  t.equal(ink8.engines.node, `>=${major}`, "Ink's engines.node");
  t.equal(ink8.peerDependencies[q.tok('react')], `>=${version}`, "Ink's peer range for react");
  t.equal(ink8.peerDependencies[q.tok('@types/react')], `>=${version}`, 'and for @types/react');
  t.ok(semver.gte(process.versions.node, `${major}.0.0`), 'this suite runs on such a Node');
  t.ok(semver.satisfies(pkg('react').version, `>=${version}`), 'with such a React');
});

// ===================================================================== the process model

s.fact(
  F,
  ["An Ink app stays alive only while there's active work in the event loop — timers, open handles such as sockets or child processes, or `useInput` listening on stdin; a pending promise on its own does not keep it alive."],
  { kind: 'R', timeout: 40_000 },
  async (t, q) => {
    const hook = q.tok('useInput');
    const [none, timer, server, child, promise, input] = await Promise.all(['none', 'timer', 'server', 'child', 'promise', 'input'].map((scenario) => processProbe(scenario, hook)));
    t.equal(none.json.alive, false, 'nothing else: the process ends');
    t.equal(promise.json.alive, false, 'a promise that never settles does not hold it');
    t.equal(timer.json.alive, true, 'a timer does');
    t.equal(server.json.alive, true, 'a listening socket does');
    t.equal(child.json.alive, true, 'a child process does');
    t.equal(input.json.alive, true, 'useInput listening on stdin does');
    for (const run of [none, timer, server, child, promise, input]) t.equal(run.code, 0, run.stderr);
  },
);

s.fact(F, ['**A component tree with no async work renders once and exits immediately.**'], { kind: 'R', ctx: ['A component tree with no async work renders once and exits immediately.'] }, async (t) => {
  const run = await processProbe('none');
  t.equal(run.code, 0);
  t.equal(run.json.alive, false, 'the process ended by itself, with nothing keeping it');
  t.equal(run.stdout.split('frame').length - 1, 1, 'after writing its frame once');
  t.equal(stripAnsi(run.stdout).split('\n').filter((line) => line === 'frame').length, 1);
});

s.fact(
  F,
  ['If a CLI prints its UI and quits before the user can interact, nothing is keeping the event loop alive — add what the app is waiting for, for example `useInput` (see `ink-input-handling`).'],
  { kind: 'R', ctx: ['ink-input-handling'], timeout: 30_000 },
  async (t, q) => {
    const hook = q.tok('useInput');
    const [without, withInput] = await Promise.all([processProbe('none', hook), processProbe('input', hook)]);
    t.equal(without.json.alive, false, 'it prints its UI and quits');
    t.equal(withInput.json.alive, true, 'with useInput it keeps running');
    t.ok(withInput.stdout.includes('frame'), 'and still printed its UI');
  },
);

s.fact(
  F,
  ['Exit paths: **Ctrl+C** (enabled by default via `exitOnCtrlC`), calling `exit()` from `useApp()` inside a component, or calling `unmount()` on the `Instance` `render()` returns.'],
  { kind: 'R', ctx: ['Instance'] },
  async (t, q) => {
    const keyOf = { 'Ctrl+C': '\x03' }[q.tok('Ctrl+C')];
    const exitOnCtrlC = q.tok('exitOnCtrlC');
    const useApp = q.api(ink, 'useApp()');
    const exit = method(q.tok('exit()'));
    const unmount = method(q.tok('unmount()'));
    const render = q.api(ink, 'render()');
    const settled = (instance) => {
      const state = { done: false };
      instance.waitUntilExit().then(() => (state.done = true), () => (state.done = true));
      return state;
    };

    // Ctrl+C: Ink's default, in raw mode
    const inputs = [];
    const Listening = () => (ink.useInput((input, key) => inputs.push([input, key.ctrl])), FRAME);
    await withApps(async (make) => {
      const byDefault = make(h(Listening));
      const done = settled(byDefault.instance);
      byDefault.stdin.write(keyOf);
      await waitFor(() => done.done, { message: 'the app to exit on Ctrl+C' });
      t.equal(done.done, true, 'Ctrl+C exits by default');
      t.deepEqual(inputs, [], 'and is not passed on to useInput');
      const off = make(h(Listening), { [exitOnCtrlC]: false });
      const stays = settled(off.instance);
      off.stdin.write(keyOf);
      await off.instance.waitUntilRenderFlush();
      t.equal(stays.done, false, `positive control: with ${exitOnCtrlC}: false it keeps running`);
      t.deepEqual(inputs, [['c', true]], 'and the keypress reaches useInput instead');
    });

    // exit() from useApp() inside a component
    let called;
    const Quitter = () => {
      called = useApp()[exit];
      return FRAME;
    };
    await withApps(async (make) => {
      const app = make(h(Quitter));
      const done = settled(app.instance);
      t.equal(done.done, false, 'running until told to exit');
      called();
      await waitFor(() => done.done);
      t.equal(done.done, true, 'exit() from useApp() ends the app');
    });

    // unmount() on the Instance render() returns
    const stdout = fakeStdout({ isTTY: true });
    const instance = render(FRAME, { stdout, stderr: fakeStdout(), stdin: fakeStdin(), patchConsole: false });
    const done = settled(instance);
    instance[unmount]();
    await waitFor(() => done.done);
    t.equal(done.done, true, 'unmount() ends the app');
  },
);

s.fact(
  F,
  ["To run an interactive child that needs the terminal itself (an editor, a pager) without exiting, `useApp()` also returns `suspendTerminal(callback)`: it hands the terminal over for the callback's duration, then restores Ink's terminal state and forces a full redraw (see `ink-async-and-suspense` for the spawn recipe)."],
  { kind: 'R', ctx: ['ink-async-and-suspense'] },
  async (t, q) => {
    const useApp = q.api(ink, 'useApp()');
    const suspend = method(q.tok('suspendTerminal(callback)'));
    let hand;
    const App = () => {
      hand = useApp()[suspend];
      ink.useInput(() => {});
      return FRAME;
    };
    await withApps(async (make) => {
      const app = make(h(App));
      await app.instance.waitUntilRenderFlush();
      const before = app.bytes().length;
      const during = {};
      let exited = false;
      app.instance.waitUntilExit().then(() => (exited = true));
      await hand(async () => {
        during.bytes = app.bytes().slice(before);
        during.raw = [...app.stdin.rawModeCalls];
      });
      t.equal(during.bytes, '\x1b[2K\x1b[1A\x1b[2K\x1b[G\x1b[?25h', "for the callback's duration Ink's frame is erased and the cursor is shown");
      t.deepEqual(during.raw, [true, false], 'raw mode is handed back as well');
      t.deepEqual(app.stdin.rawModeCalls, [true, false, true], 'and taken again afterwards');
      t.equal(app.bytes().slice(before + during.bytes.length), '\x1b[?2026h\x1b[?25lframe\n\x1b[?2026l', 'the frame is drawn again, although nothing about it changed');
      t.equal(exited, false, 'the app did not exit');
    });
  },
);

s.fence(F, 0, {
  run: async (t, fence) => {
    const { logs, apps } = await runFenceLikeInk(fence, { after: (instance) => instance.unmount() });
    await apps[0].flush();
    t.equal(apps[0].screen(), 'hi');
    t.deepEqual(logs, ['App exited'], 'the line after waitUntilExit() runs once the app has been unmounted');
  },
});

s.fact(
  F,
  ['Top-level `await` needs an ES module: an `.mjs` entry point, `"type": "module"` in `package.json`, or a `.js` file that Node detects as ESM because of the top-level `await`. In a `.cjs` file, or in CommonJS that uses `require`, wrap it in an `async` function.'],
  { kind: 'R', timeout: 40_000 },
  async (t, q) => {
    const keyword = q.tok('await');
    const mjs = q.tok('.mjs');
    const js = q.tok('.js');
    const cjs = q.tok('.cjs');
    const manifest = q.tok('package.json');
    const typeModule = `{${q.tok('"type": "module"')}}`;
    const asyncKeyword = q.tok('async');
    const requireName = q.tok('require');
    const moduleKind = `console.log(typeof ${requireName})`; // 'function' in CommonJS, 'undefined' in an ES module
    const topLevel = `${keyword} Promise.resolve(); ${moduleKind};`;

    const esm = await runNode({ [`entry${mjs}`]: topLevel }, [`entry${mjs}`]);
    t.deepEqual([esm.code, esm.stdout], [0, 'undefined\n'], `an ${mjs} entry point is an ES module: ${keyword} works, ${requireName} does not exist`);
    const plain = await runNode({ [`entry${js}`]: moduleKind }, [`entry${js}`]);
    t.equal(plain.stdout, 'function\n', `positive control: a plain ${js} file is CommonJS`);
    const typed = await runNode({ [manifest]: typeModule, [`entry${js}`]: moduleKind }, [`entry${js}`]);
    t.equal(typed.stdout, 'undefined\n', `${js} next to a ${manifest} with ${q.tok('"type": "module"')} is an ES module`);
    const typedAwait = await runNode({ [manifest]: typeModule, [`entry${js}`]: topLevel }, [`entry${js}`]);
    t.deepEqual([typedAwait.code, typedAwait.stdout], [0, 'undefined\n'], `so ${keyword} works in it`);
    const detected = await runNode({ [`entry${js}`]: topLevel }, [`entry${js}`]);
    t.deepEqual([detected.code, detected.stdout], [0, 'undefined\n'], `a plain ${js} file with a top-level ${keyword} is detected as ESM`);
    const commonjs = await runNode({ [`entry${cjs}`]: topLevel }, [`entry${cjs}`]);
    t.notEqual(commonjs.code, 0, `in a ${cjs} file it is a syntax error`);
    t.match(commonjs.stderr, /SyntaxError|await is only valid/);
    const requiring = await runNode({ [`entry${js}`]: `const fs = ${requireName}('node:fs'); ${topLevel}` }, [`entry${js}`]);
    t.notEqual(requiring.code, 0, `${requireName} next to a top-level ${keyword} does not work`);
    const wrapped = await runNode({ [`entry${cjs}`]: `const fs = ${requireName}('node:fs'); (${asyncKeyword} () => { ${topLevel} })();` }, [`entry${cjs}`]);
    t.deepEqual([wrapped.code, wrapped.stdout], [0, 'function\n'], `wrapped in an ${asyncKeyword} function it works in CommonJS`);
  },
);

// ===================================================================== render(tree, options?)

s.fact(
  F,
  ['`options` is `Writable | RenderOptions` — passing a writable stream is shorthand for `{stdout}`.'],
  { kind: 'R', ctx: ['options'] },
  async (t, q) => {
    const [writableName, optionsName] = q.tok('Writable | RenderOptions').split('|').map((name) => name.trim());
    const [stdoutKey] = names(q.tok('{stdout}'));
    const stream = await import('node:stream');
    t.equal(optionsName, 'RenderOptions');
    const collect = () => {
      const chunks = [];
      const out = new stream[writableName]({ write(chunk, encoding, done) { chunks.push(String(chunk)); done(); } });
      return { out, chunks };
    };
    const shorthand = collect();
    const explicit = collect();
    ink.render(FRAME, shorthand.out).unmount();
    ink.render(FRAME, { [stdoutKey]: explicit.out }).unmount();
    await waitFor(() => shorthand.chunks.length > 0 && explicit.chunks.length > 0);
    t.deepEqual(shorthand.chunks, explicit.chunks, 'the same output either way');
    t.equal(shorthand.chunks.join(''), 'frame\n', 'on the stream that was passed');
    t.ok(shorthand.out instanceof stream[writableName]);
  },
);

s.types(
  F,
  ['`options` is `Writable | RenderOptions` — passing a writable stream is shorthand for `{stdout}`.'],
  tsx`
import {Writable} from 'node:stream';
import {render, Text, type RenderOptions} from 'ink';

type Options = Writable | RenderOptions; // Writable | RenderOptions
export const stream = render(<Text>x</Text>, new Writable());
export const object = render(<Text>x</Text>, {stdout: new Writable()});
export const accepted: Options[] = [new Writable(), {stdout: new Writable()}];
export const wrong = render(<Text>x</Text>, 'process.stdout'); //! TS2345
`,
  { ctx: ['options', 'Writable | RenderOptions', '{stdout}'] },
);

s.types(
  F,
  ['Key options (all optional):'],
  tsx`
import {render, Text, type RenderOptions} from 'ink';

export const none: RenderOptions = {};
export const withoutOptions = render(<Text>x</Text>);
export const emptyOptions = render(<Text>x</Text>, {});
`,
);

s.fact(
  F,
  ['`stdout` / `stderr` | `NodeJS.WritableStream` | `process.stdout` / `process.stderr` | Swap streams, for example to capture output in tests (see `ink-testing`). Any `Writable` works; no TTY type is required.'],
  { kind: 'D', ctx: ['ink-testing', 'NodeJS.WritableStream'], timeout: 20_000 },
  async (t, q) => {
    const [outKey, errKey] = [q.tok('stdout'), q.tok('stderr')];
    const run = await runIsolated({ probe: 'ink-terminal-io-streams', env: { ...ENV, PROBE_SCENARIO: 'identity', PROBE_STDOUT: q.tok('process.stdout'), PROBE_STDERR: q.tok('process.stderr') }, tty: TTY });
    t.deepEqual([run.json.sameStdout, run.json.sameStderr], [true, true], 'without options the hooks hand out the process streams');
    const WritableClass = (await import('node:stream'))[q.tok('Writable')];
    const captured = [];
    const errors = [];
    const capture = (into) => new WritableClass({ write(chunk, encoding, done) { into.push(String(chunk)); done(); } });
    let write;
    const App = () => {
      write = ink.useStderr().write;
      return FRAME;
    };
    const instance = ink.render(h(App), { [outKey]: capture(captured), [errKey]: capture(errors), stdin: fakeStdin({ isTTY: false }), patchConsole: false });
    write('to stderr');
    instance.unmount();
    await waitFor(() => captured.length > 0);
    t.equal(captured.join(''), 'frame\n', 'any Writable receives the output, so tests can capture it (it has no isTTY, so Ink writes just the final frame)');
    t.deepEqual(errors, ['to stderr'], 'and the other one the stderr writes');
  },
);

s.types(
  F,
  ['`stdout` / `stderr` | `NodeJS.WritableStream` | `process.stdout` / `process.stderr`'],
  tsx`
import {PassThrough} from 'node:stream';
import {render, Text, type RenderOptions} from 'ink';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const stdoutType: Same<NonNullable<RenderOptions['stdout']>, NodeJS.WritableStream> = true; // NodeJS.WritableStream
export const stderrType: Same<NonNullable<RenderOptions['stderr']>, NodeJS.WritableStream> = true;
export const plain = render(<Text>x</Text>, {stdout: new PassThrough(), stderr: new PassThrough()});
export const notAStream = render(<Text>x</Text>, {stdout: 'process.stdout'}); //! TS2322
`,
  { ctx: ['stdout', 'stderr', 'NodeJS.WritableStream', 'process.stdout', 'process.stderr'] },
);

s.fact(
  F,
  ['`stdin` | `NodeJS.ReadableStream` | `process.stdin` | Any `Readable` works for rendering. Raw mode, which `useInput` needs, requires a TTY with `setRawMode` and throws without one.'],
  { kind: 'D', ctx: ['NodeJS.ReadableStream', 'process.stdin'] },
  async (t, q) => {
    const key = q.tok('stdin');
    const ReadableClass = (await import('node:stream'))[q.tok('Readable')];
    const useInput = q.api(ink, 'useInput');
    const rawMode = q.tok('setRawMode');
    const readable = () => new ReadableClass({ read() {} });
    const outputs = [];
    const out = new Writable({ write(chunk, encoding, done) { outputs.push(String(chunk)); done(); } });
    const plain = ink.render(FRAME, { stdout: out, [key]: readable(), patchConsole: false });
    plain.unmount();
    await plain.waitUntilExit();
    t.equal(outputs.join(''), 'frame\n', 'a plain Readable as stdin: the app renders');

    const Listening = () => (useInput(() => {}), FRAME);
    const piped = ink.render(h(Listening), { stdout: new PassThrough(), [key]: readable(), patchConsole: false });
    await t.rejects(piped.waitUntilExit(), /Raw mode is not supported on the stdin provided to Ink/, 'but useInput on it throws: raw mode needs a TTY');
    const withoutMethod = fakeStdin({ isTTY: true });
    delete withoutMethod[rawMode];
    const noMethod = ink.render(h(Listening), { stdout: new PassThrough(), [key]: withoutMethod, patchConsole: false });
    await t.rejects(noMethod.waitUntilExit(), /Raw mode is not supported/, `a TTY without ${rawMode} does not do either`);

    await withApps(async (make) => {
      const app = make(h(Listening), {}, { stdin: fakeStdin({ isTTY: true }) });
      await app.instance.waitUntilRenderFlush();
      t.deepEqual(app.stdin.rawModeCalls, [true], `positive control: a TTY with ${rawMode} gets raw mode`);
    });
  },
);

s.types(
  F,
  ['`stdin` | `NodeJS.ReadableStream` | `process.stdin`'],
  tsx`
import {Readable} from 'node:stream';
import {render, Text, type RenderOptions} from 'ink';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const stdinType: Same<NonNullable<RenderOptions['stdin']>, NodeJS.ReadableStream> = true; // NodeJS.ReadableStream
export const readable = render(<Text>x</Text>, {stdin: new Readable()});
export const notAStream = render(<Text>x</Text>, {stdin: 42}); //! TS2322
`,
  { ctx: ['stdin', 'NodeJS.ReadableStream', 'process.stdin'] },
);

s.fact(
  F,
  ['`exitOnCtrlC` | `boolean` | `true` | Exits on Ctrl+C. Needed in raw mode, where the terminal no longer turns Ctrl+C into SIGINT.'],
  { kind: 'D', timeout: 60_000 },
  async (t, q) => {
    const option = q.tok('exitOnCtrlC');
    const dflt = JSON.parse(q.tok('true'));
    t.equal(typeof dflt, q.tok('boolean'));
    const run = (scenario, options = {}) => ptyRun({ argv: [process.execPath, 'tests/probes/ink-terminal-io-tty.mjs'], env: { FORCE_COLOR: '0', TERM: 'xterm-256color', PROBE_SCENARIO: scenario, PROBE_OPTIONS: JSON.stringify(options) } });

    const cooked = run('idle');
    try {
      await cooked.waitFor('@@ ready tty=true raw=false');
      cooked.write('\x03');
      t.deepEqual(await cooked.end, { code: null, signal: 2 }, 'without raw mode the terminal itself turns Ctrl+C into SIGINT');
    } finally {
      cooked.kill();
    }
    const byDefault = run('keys');
    try {
      await byDefault.waitFor('@@ ready tty=true raw=true');
      byDefault.write('\x03');
      t.deepEqual(await byDefault.end, { code: 0, signal: null }, `in raw mode ${option} (${dflt} by default) exits: a clean exit, no signal`);
    } finally {
      byDefault.kill();
    }
    const off = run('keys', { [option]: !dflt });
    try {
      await off.waitFor('@@ ready tty=true raw=true');
      off.write('\x03');
      await off.waitFor('@@ key ctrl-c');
      off.write('q');
      t.deepEqual(await off.end, { code: 0, signal: null }, 'positive control: with it off, raw mode swallows Ctrl+C: no SIGINT, no exit, just a keypress');
      t.deepEqual(logged(off).slice(1, 2), ['key ctrl-c']);
    } finally {
      off.kill();
    }
  },
);

s.fact(
  F,
  ["`patchConsole` | `boolean` | `true` | Intercepts `console.*` so it doesn't tear the live output; restored automatically before unmount's React cleanup runs."],
  { kind: 'D' },
  async (t, q) => {
    const option = q.tok('patchConsole');
    t.equal(typeof JSON.parse(q.tok('true')), q.tok('boolean'));
    const target = globalThis[q.tok('console.*').split('.')[0]];
    const original = process.stdout.write;
    const written = [];
    const React = await import('react');
    const Component = () => {
      React.useEffect(() => () => console.log('from cleanup'), []);
      return FRAME;
    };
    await withApps(async (make) => {
      const before = target.log;
      const app = make(h(Component), { [option]: undefined });
      await app.instance.waitUntilRenderFlush();
      console.log('while mounted');
      await app.instance.waitUntilRenderFlush();
      t.equal(app.screen(), 'while mounted\nframe', 'default: console output is printed above the live frame');
      t.notEqual(target.log, before, 'console methods are replaced while mounted');
      process.stdout.write = (chunk) => (written.push(String(chunk)), true);
      try {
        app.instance.unmount();
      } finally {
        process.stdout.write = original;
      }
      t.equal(target.log, before, 'and restored by unmount');
      t.deepEqual(written, ['from cleanup\n'], "a console.log in the component's cleanup already goes to the real console");
      t.ok(!app.bytes().includes('from cleanup'), 'not through Ink');
    });
    await withApps(async (make) => {
      const before = target.log;
      const app = make(h(Component), { [option]: false });
      await app.instance.waitUntilRenderFlush();
      t.equal(target.log, before, `positive control: with ${option}: false console is left alone`);
      process.stdout.write = (chunk) => (written.push(String(chunk)), true);
      try {
        console.log('not intercepted');
        app.instance.unmount();
      } finally {
        process.stdout.write = original;
      }
      t.ok(written.includes('not intercepted\n'));
    });
  },
);

s.fact(
  F,
  ["`onRender` | `({renderTime}) => void` | — | Fires after each frame Ink renders, with `renderTime` in milliseconds; commits that land within one `maxFps` interval share a frame. Doesn't wait for the stream write — use `waitUntilRenderFlush()` for that."],
  { kind: 'R', ctx: ['({renderTime}) => void'] },
  async (t, q) => {
    const option = q.tok('onRender');
    const [timeKey] = [q.tok('renderTime')];
    const maxFps = q.tok('maxFps');
    const flush = method(q.tok('waitUntilRenderFlush()'));
    await withFakeTime(async (timers) => {
      await withApps(async (make) => {
        const calls = [];
        const app = make(h(Counter, { n: 0 }), { [option]: (metrics) => calls.push(metrics), [maxFps]: 0.001 });
        t.equal(calls.length, 1, 'the first frame');
        t.deepEqual(Object.keys(calls[0]), [timeKey]);
        t.equal(typeof calls[0][timeKey], 'number', `${timeKey} is a number of milliseconds`);
        t.ok(calls[0][timeKey] >= 0 && calls[0][timeKey] < 5000);
        for (let n = 1; n <= 3; n++) {
          app.instance.rerender(h(Counter, { n }));
          timers.tick(5000);
        }
        await app.instance[flush]();
        t.equal(calls.length, 2, 'three more commits, seconds apart, but within one maxFps interval: one more frame');
        t.equal(app.screen().split('\n')[1], 'count 3', 'showing the last of them');
      });
      await withApps(async (make) => {
        const calls = [];
        const app = make(h(Counter, { n: 0 }), { [option]: (metrics) => calls.push(metrics) });
        for (let n = 1; n <= 3; n++) {
          app.instance.rerender(h(Counter, { n }));
          timers.tick(1000);
        }
        t.equal(calls.length, 4, 'positive control: with the default maxFps, commits that are seconds apart each get a frame');
      });
    });
    // the stream write is not awaited
    const out = slowStdout();
    const calls = [];
    const instance = ink.render(FRAME, { stdout: out, stderr: fakeStdout(), stdin: fakeStdin(), patchConsole: false, [option]: () => calls.push(1) });
    try {
      let flushed = false;
      const waiting = instance[flush]().then(() => (flushed = true));
      await waitFor(() => out.pending() === 1, { message: 'the flush to wait for the stream' });
      t.equal(calls.length, 1, 'onRender has run');
      t.equal(out.pending(), 1, 'while the stream still has an unfinished write');
      t.equal(flushed, false, `${flush}() is still waiting for it`);
      out.release();
      await waiting;
      t.equal(flushed, true, `and settles once the stream has taken everything`);
    } finally {
      out.release();
      instance.unmount();
    }
  },
);

s.types(
  F,
  ['`onRender` | `({renderTime}) => void`'],
  tsx`
import {render, Text, type RenderOptions} from 'ink';

export const handler: NonNullable<RenderOptions['onRender']> = ({renderTime}) => {
	const milliseconds: number = renderTime;
	void milliseconds;
}; // ({renderTime}) => void
export const app = render(<Text>x</Text>, {onRender: ({renderTime}) => void renderTime});
export const wrong = render(<Text>x</Text>, {onRender: (metrics: string) => void metrics}); //! TS2322
`,
  { ctx: ['onRender', '({renderTime}) => void'] },
);

s.fact(
  F,
  ['`isScreenReaderEnabled` | `boolean` | `INK_SCREEN_READER=true` in the environment | See `ink-accessibility`.'],
  { kind: 'D', ctx: ['ink-accessibility'] },
  async (t, q) => {
    const option = q.tok('isScreenReaderEnabled');
    const [variable, value] = q.tok('INK_SCREEN_READER=true').split('=');
    t.equal(typeof JSON.parse(value), q.tok('boolean'));
    const saved = process.env[variable];
    const enabled = async (env, options = {}) => {
      if (env === undefined) delete process.env[variable];
      else process.env[variable] = env;
      let seen;
      const App = () => ((seen = ink.useIsScreenReaderEnabled()), FRAME);
      const app = mount(h(App), { render: options });
      await app.flush();
      await app.unmount();
      return seen;
    };
    try {
      t.equal(await enabled(undefined), false, 'off by default');
      t.equal(await enabled(value), true, `${variable}=${value} turns it on`);
      t.equal(await enabled('1'), false, 'only that value does');
      t.equal(await enabled(undefined, { [option]: true }), true, 'the option turns it on');
      t.equal(await enabled(value, { [option]: false }), false, 'and wins over the environment');
    } finally {
      if (saved === undefined) delete process.env[variable];
      else process.env[variable] = saved;
    }
  },
);

s.fact(
  F,
  ['`debug` | `boolean` | `false` | Each update is written as a separate full frame instead of overwriting the previous one.'],
  { kind: 'D' },
  async (t, q) => {
    const option = q.tok('debug');
    const off = JSON.parse(q.tok('false'));
    t.equal(typeof off, q.tok('boolean'));
    await withApps(async (make) => {
      const debug = make(h(Counter, { n: 0 }), { [option]: true });
      await debug.instance.waitUntilRenderFlush();
      debug.instance.rerender(h(Counter, { n: 1 }));
      await debug.instance.waitUntilRenderFlush();
      const frames = debug.stdout.writes.filter((chunk) => chunk !== '');
      t.deepEqual(frames, ['line one\ncount 0\nline three', 'line one\ncount 1\nline three'], 'two updates, two complete frames');
      t.ok(!debug.bytes().includes('\x1b['), 'with no erase or cursor sequences between them');

      const normal = make(h(Counter, { n: 0 }), { [option]: off });
      await normal.instance.waitUntilRenderFlush();
      normal.instance.rerender(h(Counter, { n: 1 }));
      await normal.instance.waitUntilRenderFlush();
      t.ok(normal.bytes().includes('\x1b[2K\x1b[1A\x1b[2K\x1b[1A\x1b[2K\x1b[1A\x1b[2K\x1b[G'), 'by default the next frame erases the previous one first');
      t.equal(normal.screen(), 'line one\ncount 1\nline three');
    });
  },
);

s.fact(
  F,
  ['`maxFps` | `number` | `30` | Caps how often frames are written: at most `maxFps` per second.'],
  { kind: 'D' },
  async (t, q) => {
    const option = q.tok('maxFps');
    const fps = Number(q.tok('30'));
    t.equal(typeof fps, q.tok('number'));
    // how long after a frame does the next update reach the screen? (the clock is the test's own)
    const interval = (options) =>
      withFakeTime((timers) =>
        withApps(async (make) => {
          const app = make(h(Counter, { n: 0 }), options);
          app.instance.rerender(h(Counter, { n: 1 }));
          for (let elapsed = 0; elapsed <= 2500; elapsed++) {
            if (app.screen().includes('count 1')) return elapsed;
            timers.tick(1);
          }
          return Infinity;
        }),
      );
    const byDefault = await interval({});
    t.equal(await interval({ [option]: fps }), byDefault, `${fps} is the default`);
    for (const limit of [1, 5, 10, fps, 60]) {
      const wait = await interval({ [option]: limit });
      t.ok(wait > 0 && 1000 / wait <= limit, `maxFps ${limit}: the next frame comes ${wait} ms later, which is at most ${limit} per second`);
    }
    t.ok((await interval({ [option]: 1 })) > (await interval({ [option]: 10 })) && (await interval({ [option]: 10 })) > byDefault, 'and a lower value waits longer');
  },
);

s.fact(
  F,
  ['`incrementalRendering` | `boolean` | `false` | Only redraws changed lines, and skips each changed line\'s unchanged prefix when safe. Lines with unsupported terminal controls fall back to a whole-line redraw.'],
  { kind: 'D' },
  async (t, q) => {
    const option = q.tok('incrementalRendering');
    const off = JSON.parse(q.tok('false'));
    t.equal(typeof off, q.tok('boolean'));
    const link = (label) => `\x1b]8;;https://example.com\x07${label}\x1b]8;;\x07`;
    const Frame = ({ n, linked }) => h(Box, { flexDirection: 'column' }, h(Text, null, 'first line'), h(Text, null, linked ? `${link('link')} count ${n}` : `count ${n}`), h(Text, null, 'last line'));
    const update = async (options, linked) => {
      let result;
      await withApps(async (make) => {
        const app = make(h(Frame, { n: 0, linked }), options);
        await app.instance.waitUntilRenderFlush();
        const before = app.bytes().length;
        app.instance.rerender(h(Frame, { n: 1, linked }));
        await app.instance.waitUntilRenderFlush();
        result = app.bytes().slice(before);
      });
      return result;
    };
    const full = await update({ [option]: off }, false);
    t.equal(stripAnsi(full), 'first line\ncount 1\nlast line\n', 'by default every line is written again');
    const incremental = await update({ [option]: true }, false);
    t.equal(stripAnsi(incremental), '1\n', 'incrementally: only the changed line, and of that only the characters after its unchanged prefix');
    t.ok(incremental.includes('\x1b[7G\x1b[K1'), 'written at column 7, right after "count "');
    const withLink = await update({ [option]: true }, true);
    t.ok(withLink.includes(`\x1b[1G\x1b[K${link('link')} count 1`), 'a line holding an OSC 8 hyperlink is erased and written whole');
    t.ok(!withLink.includes('first line'), 'while the unchanged lines are still skipped');
  },
);

s.fact(
  F,
  ['`concurrent` | `boolean` | `false` | React Concurrent Mode — React schedules rendering itself, so `render()` and `rerender()` return before the new output is written; by default they flush it synchronously (see `ink-async-and-suspense`).'],
  { kind: 'D', ctx: ['ink-async-and-suspense'] },
  async (t, q) => {
    const option = q.tok('concurrent');
    const off = JSON.parse(q.tok('false'));
    t.equal(typeof off, q.tok('boolean'));
    const render = q.api(ink, 'render()');
    const rerender = method(q.tok('rerender()'));
    const live = [];
    // unthrottled (debug), so that only React's own scheduling can delay the output
    const open = (options) => {
      const stdout = fakeStdout({ isTTY: true });
      const instance = render(h(Text, null, 'first'), { stdout, stderr: fakeStdout(), stdin: fakeStdin(), patchConsole: false, debug: true, ...options });
      live.push(instance);
      return { instance, written: () => stdout.bytes() };
    };
    try {
      const sync = open({ [option]: off });
      t.equal(sync.written(), 'first', `by default render() has written the output when it returns`);
      sync.instance[rerender](h(Text, null, 'second'));
      t.match(sync.written(), /second$/, `and so has ${rerender}()`);

      const scheduled = open({ [option]: true });
      t.equal(scheduled.written(), '', 'concurrent: render() returns before anything is written');
      await scheduled.instance.waitUntilRenderFlush();
      t.equal(scheduled.written(), 'first', 'the output follows once React has done the work');
      scheduled.instance[rerender](h(Text, null, 'second'));
      t.equal(scheduled.written(), 'first', `${rerender}() returns before the new output is written as well`);
      await scheduled.instance.waitUntilRenderFlush();
      t.match(scheduled.written(), /second$/, 'which then arrives');
    } finally {
      for (const instance of live) instance.unmount();
    }
  },
);

s.fact(
  F,
  ['`interactive` | `boolean` | auto (not in CI and `stdout.isTTY` is true) | Overrides the auto-detection.'],
  { kind: 'D', timeout: 60_000 },
  async (t, q) => {
    const option = q.tok('interactive');
    const [stream, property] = q.tok('stdout.isTTY').split('.');
    t.equal(stream, 'stdout');
    t.deepEqual([true, false].map((value) => typeof value), [q.tok('boolean'), q.tok('boolean')]);
    const tty = { [property]: true, columns: 80, rows: 24 };
    const run = (env, options = {}, terminal = tty) => renderProbe({ PROBE_OPTIONS: JSON.stringify(options), ...env }, terminal);
    const isInteractive = (result) => result.json.resizeListeners === 1 && result.stdout.includes('\x1b[2K');

    t.equal(isInteractive(await run({})), true, 'a TTY and no CI: interactive (erases and redraws its frame, listens for resize)');
    const ci = await run({ CI: '1' });
    t.equal(isInteractive(ci), false, 'in CI it is not');
    t.equal(stripAnsi(ci.stdout).split('\n')[0], 'count 1', 'only the final frame is written');
    t.equal(isInteractive(await run({}, {}, { columns: 80, rows: 24 })), false, 'without a TTY it is not');
    t.equal(isInteractive(await run({ CI: '1' }, { [option]: true })), true, `${option}: true overrides CI`);
    t.equal(isInteractive(await run({}, { [option]: true }, { columns: 80, rows: 24 })), true, 'and a missing TTY');
    t.equal(isInteractive(await run({}, { [option]: false })), false, `${option}: false overrides a TTY`);
  },
);

s.fact(
  F,
  ["`alternateScreen` | `boolean` | `false` | Renders on the terminal's alternate screen, for full-screen apps — see `ink-fullscreen-layouts`."],
  { kind: 'D', ctx: ['ink-fullscreen-layouts'] },
  async (t, q) => {
    const option = q.tok('alternateScreen');
    const off = JSON.parse(q.tok('false'));
    t.equal(typeof off, q.tok('boolean'));
    await withApps(async (make) => {
      const on = make(h(Counter), { [option]: true });
      await on.instance.waitUntilRenderFlush();
      t.ok(on.bytes().startsWith('\x1b[?1049h'), 'the alternate screen is entered before the first frame');
      t.ok(on.bytes().indexOf('\x1b[?1049h') < on.bytes().indexOf('line one'));
      on.instance.unmount();
      t.ok(on.bytes().endsWith('\x1b[?1049l\x1b[?25h'), 'and left again when the app unmounts, with the cursor shown');
      const normal = make(h(Counter), { [option]: off });
      await normal.instance.waitUntilRenderFlush();
      normal.instance.unmount();
      t.ok(!normal.bytes().includes('\x1b[?1049'), 'by default the primary screen is used');
    });
  },
);

s.fact(
  F,
  ['`kittyKeyboard` | `KittyKeyboardOptions` | `undefined` | Asks the terminal for the kitty keyboard protocol (enhanced key reporting) — see `ink-input-handling`. Enabling the `reportAssociatedText` flag automatically turns on `reportAllKeysAsEscapeCodes`.'],
  { kind: 'D', ctx: ['KittyKeyboardOptions', 'ink-input-handling'] },
  async (t, q) => {
    const option = q.tok('kittyKeyboard');
    const [associated, allKeys] = [q.tok('reportAssociatedText'), q.tok('reportAllKeysAsEscapeCodes')];
    const none = q.tok('undefined');
    t.ok(none in globalThis);
    const sent = async (value) => {
      let result;
      await withApps(async (make) => {
        const app = make(FRAME, { [option]: value });
        await app.instance.waitUntilRenderFlush();
        result = app.bytes();
      });
      return result;
    };
    const flags = async (...names) => (await sent({ mode: 'enabled', flags: names })).match(/\x1b\[>(\d+)u/)?.[1];
    t.equal((await sent({ mode: 'enabled' })).match(/\x1b\[>(\d+)u/)?.[1], '1', 'the protocol is requested from the terminal (CSI > 1 u: the default flag, disambiguate escape codes)');
    t.ok((await sent({})).includes('\x1b[?u'), 'or, without a mode, queried first (CSI ? u) and enabled when the terminal answers');
    t.equal(await flags(associated), '24', 'reportAssociatedText sends flag 16 and also flag 8');
    t.equal(await flags(allKeys), '8', 'positive control: flag 8 is reportAllKeysAsEscapeCodes');
    t.equal(await flags(associated), await flags(associated, allKeys), 'so naming reportAllKeysAsEscapeCodes as well changes nothing');
    const omitted = await sent(globalThis[none]);
    t.ok(!/\x1b\[(>\d+u|\?u)/.test(omitted), 'by default nothing is sent to the terminal');
    t.ok(/\x1b\[(>\d+u|\?u)/.test(await sent({})), 'positive control: any kittyKeyboard object makes Ink talk to the terminal');
  },
);

s.types(
  F,
  ['`kittyKeyboard` | `KittyKeyboardOptions` | `undefined`'],
  tsx`
import {render, Text, type KittyKeyboardOptions, type RenderOptions} from 'ink';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const type: Same<RenderOptions['kittyKeyboard'], KittyKeyboardOptions | undefined> = true; // KittyKeyboardOptions
export const none = render(<Text>x</Text>, {kittyKeyboard: undefined}); // undefined
export const some = render(<Text>x</Text>, {kittyKeyboard: {mode: 'enabled', flags: ['reportAssociatedText']}});
export const bad = render(<Text>x</Text>, {kittyKeyboard: {flags: ['reportNothing']}}); //! TS2322
`,
  { ctx: ['kittyKeyboard', 'KittyKeyboardOptions', 'undefined'] },
);

s.fence(F, 1, {
  run: async (t, fence) => {
    const { apps } = await runFenceLikeInk(fence);
    t.equal(apps[0].screen(), '', 'in concurrent mode render() does not draw synchronously');
    await apps[0].flush();
    t.equal(apps[0].screen(), 'Hello');
    const { mod, apps: legacy } = await runFenceLikeInk({ ...fence, code: fence.code.replace(', {concurrent: true}', '') });
    t.equal(legacy[0].screen(), 'Hello', 'positive control: without the option the first frame is there right away');
    t.equal(typeof mod.MyApp, 'function');
  },
});

s.fact(
  F,
  ['**Important constraint:** reusing the same `stdout` across multiple `render()` calls without unmounting first is unsupported — call `unmount()` before changing `interactive`, `alternateScreen`, or `concurrent` on the same stream, or create a fresh one.'],
  { kind: 'R', ctx: ['Important constraint:'] },
  async (t, q) => {
    const stdoutKey = q.tok('stdout');
    const render = q.api(ink, 'render()');
    const unmount = method(q.tok('unmount()'));
    const [interactive, alternateScreen, concurrent] = [q.tok('interactive'), q.tok('alternateScreen'), q.tok('concurrent')];
    const original = process.stderr.write;
    const warnings = [];
    const live = [];
    const open = (stdout, options) => {
      const instance = render(FRAME, { [stdoutKey]: stdout, stderr: fakeStdout(), stdin: fakeStdin(), patchConsole: false, ...options });
      live.push(instance);
      return instance;
    };
    const resizeListeners = (stdout) => stdout.listenerCount('resize');
    const checks = {
      // the option, what a stream that ignored it looks like, and what an instance that honours it looks like
      [alternateScreen]: {
        tty: true,
        ignored: (stdout) => t.ok(!stdout.bytes().includes('\x1b[?1049h'), `${alternateScreen}: the second call did not move the app to the alternate screen`),
        applied: (stdout) => t.ok(stdout.bytes().includes('\x1b[?1049h'), `${alternateScreen}: but a fresh instance does`),
      },
      [interactive]: {
        tty: false,
        ignored: (stdout) => t.equal(resizeListeners(stdout), 0, `${interactive}: the second call did not make the app interactive (a stream without isTTY)`),
        applied: (stdout) => t.equal(resizeListeners(stdout), 1, `${interactive}: but a fresh instance is`),
      },
      [concurrent]: {
        tty: true,
        base: { debug: true }, // unthrottled, so a synchronous render shows at once
        ignored: (stdout, instance) => {
          const before = stdout.bytes().length;
          instance.rerender(h(Text, null, 'changed'));
          t.match(screenOf(stdout.bytes().slice(before)), /changed/, `${concurrent}: the second call did not switch the running app to concurrent rendering (it still draws synchronously)`);
        },
        applied: (stdout, instance) => {
          const before = stdout.bytes().length;
          instance.rerender(h(Text, null, 'changed again'));
          t.equal(stdout.bytes().length, before, `${concurrent}: but a fresh instance does (nothing is drawn until React gets to it)`);
        },
      },
    };
    process.stderr.write = (chunk) => (warnings.push(String(chunk)), true);
    try {
      for (const [name, check] of Object.entries(checks)) {
        warnings.length = 0;
        const stdout = fakeStdout({ isTTY: check.tty });
        const first = open(stdout, { ...check.base });
        const second = open(stdout, { ...check.base, [name]: true });
        t.equal(second.waitUntilExit, first.waitUntilExit, `${name}: the second render() call hands back the running instance`);
        t.match(warnings.join(''), /render\(\) was called again for the same stdout before the previous Ink instance was unmounted/, `${name}: and warns`);
        check.ignored(stdout, second);
        first[unmount]();
        warnings.length = 0;
        const fresh = open(stdout, { ...check.base, [name]: true });
        t.deepEqual(warnings, [], `${name}: after ${unmount}() a new render() call on the same stream is a fresh instance`);
        check.applied(stdout, fresh);
        fresh[unmount]();
      }
    } finally {
      process.stderr.write = original;
      for (const instance of live) instance.unmount();
    }
  },
);

// ===================================================================== Instance

s.fact(F, ['`rerender(tree)` | Replace the root node or update its props.'], { kind: 'R' }, async (t, q) => {
  const name = method(q.tok('rerender(tree)'));
  const React = await import('react');
  const Stateful = ({ label }) => {
    const [clicks] = React.useState(() => ({ n: 0 }));
    clicks.n += 1;
    return h(Text, null, `${label} render ${clicks.n}`);
  };
  const Other = ({ label }) => h(Text, null, `other ${label}`);
  await withApps(async (make) => {
    const app = make(h(Stateful, { label: 'a' }));
    await app.instance.waitUntilRenderFlush();
    app.instance[name](h(Stateful, { label: 'b' }));
    await app.instance.waitUntilRenderFlush();
    t.equal(app.screen(), 'b render 2', 'same component, new props: it updates and keeps its state');
    app.instance[name](h(Other, { label: 'c' }));
    await app.instance.waitUntilRenderFlush();
    t.equal(app.screen(), 'other c', 'a different root replaces it');
    app.instance[name](h(Stateful, { label: 'd' }));
    await app.instance.waitUntilRenderFlush();
    t.equal(app.screen(), 'd render 1', 'and what it replaced starts over');
  });
});

s.fact(F, ['`unmount()` | Manually unmount the app.'], { kind: 'R' }, async (t, q) => {
  const name = method(q.tok('unmount()'));
  const React = await import('react');
  const log = [];
  const App = () => {
    React.useEffect(() => () => log.push('cleaned up'), []);
    return FRAME;
  };
  await withApps(async (make) => {
    const app = make(h(App));
    await app.instance.waitUntilRenderFlush();
    let exited = false;
    app.instance.waitUntilExit().then(() => (exited = true));
    t.deepEqual(log, [], 'mounted');
    app.instance[name]();
    t.deepEqual(log, ['cleaned up'], "the components' cleanups ran");
    await waitFor(() => exited);
    t.ok(app.bytes().endsWith('\x1b[?25h'), 'and the terminal is left with the cursor shown');
    t.equal(app.screen(), 'frame', 'the last frame stays on screen');
  });
});

s.fact(
  F,
  ["`waitUntilExit()` | Promise settling on unmount — resolves with `exit(value)`'s value, rejects with `exit(error)`'s error."],
  { kind: 'R' },
  async (t, q) => {
    const wait = method(q.tok('waitUntilExit()'));
    const exitName = method(q.tok('exit(value)'));
    t.equal(method(q.tok('exit(error)')), exitName);
    let exit;
    const App = () => ((exit = ink.useApp()[exitName]), FRAME);
    const outcome = async (end) => {
      let result;
      await withApps(async (make) => {
        const app = make(h(App));
        await app.instance.waitUntilRenderFlush();
        const settled = app.instance[wait]().then((value) => ['resolved', value], (error) => ['rejected', error]);
        end(app.instance);
        result = await settled;
      });
      return result;
    };
    t.deepEqual(await outcome(() => exit('done')), ['resolved', 'done'], 'exit(value) resolves with the value');
    t.deepEqual(await outcome(() => exit({ code: 3 })), ['resolved', { code: 3 }], 'whatever it is');
    const failure = new Error('boom');
    const [state, reason] = await outcome(() => exit(failure));
    t.equal(state, 'rejected', 'exit(error) rejects');
    t.equal(reason, failure, 'with that error');
    t.deepEqual(await outcome(() => exit()), ['resolved', undefined], 'exit() resolves with nothing');
    t.deepEqual(await outcome((instance) => instance.unmount()), ['resolved', undefined], 'as does unmounting from outside');
  },
);

s.fact(
  F,
  ['`waitUntilRenderFlush()` | Promise settling once the pending frame is actually flushed to the stream — use this (not `onRender`) to sequence code after output is visible.'],
  { kind: 'R', ctx: [] },
  async (t, q) => {
    const flush = method(q.tok('waitUntilRenderFlush()'));
    const onRender = q.tok('onRender');
    await withApps(async (make) => {
      // a frame that is still waiting for its throttle interval is written when you ask
      const app = make(h(Counter, { n: 0 }), { maxFps: 0.001 });
      await app.instance[flush]();
      app.instance.rerender(h(Counter, { n: 1 }));
      t.equal(app.screen().split('\n')[1], 'count 0', 'the new frame is pending');
      await app.instance[flush]();
      t.equal(app.screen().split('\n')[1], 'count 1', 'after waiting it is on the stream');
    });
    // a slow stream: onRender is no signal that the output went out
    const out = slowStdout();
    const events = [];
    const instance = ink.render(FRAME, { stdout: out, stderr: fakeStdout(), stdin: fakeStdin(), patchConsole: false, [onRender]: () => events.push('onRender') });
    try {
      instance[flush]().then(() => events.push('flushed'));
      await waitFor(() => out.pending() === 1, { message: 'the flush to wait for the stream' });
      t.deepEqual(events, ['onRender'], 'onRender has fired, the flush has not');
      out.release();
      await waitFor(() => events.length === 2);
      t.deepEqual(events, ['onRender', 'flushed'], 'it settles after the stream has taken the output');
    } finally {
      out.release();
      instance.unmount();
    }
  },
);

s.fact(
  F,
  ['`cleanup()` | Unmount and delete the internal instance tied to this stdout, also tearing down alt-screen state, so the same stream can be rendered to again with different options.'],
  { kind: 'R' },
  async (t, q) => {
    const name = method(q.tok('cleanup()'));
    const stdout = fakeStdout({ isTTY: true });
    const streams = () => ({ stdout, stderr: fakeStdout(), stdin: fakeStdin(), patchConsole: false });
    const original = process.stderr.write;
    const warnings = [];
    process.stderr.write = (chunk) => (warnings.push(String(chunk)), true);
    const live = [];
    try {
      const first = ink.render(FRAME, { ...streams(), alternateScreen: true });
      live.push(first);
      t.ok(stdout.bytes().startsWith('\x1b[?1049h'), 'rendered on the alternate screen');
      first[name]();
      t.ok(stdout.bytes().endsWith('\x1b[?1049l\x1b[?25h'), 'cleanup() left it again');
      const second = ink.render(h(Text, null, 'second'), { ...streams(), alternateScreen: false });
      live.push(second);
      const before = stdout.bytes().length;
      t.deepEqual(warnings, [], 'the same stream can be rendered to again');
      t.ok(!stdout.bytes().slice(before - 20).includes('\x1b[?1049h'), 'with different options: no alternate screen this time');
      second[name]();
    } finally {
      process.stderr.write = original;
      for (const instance of live) instance.unmount();
    }
  },
);

s.fact(F, ['`clear()` | Clear the rendered output.'], { kind: 'R' }, async (t, q) => {
  const name = method(q.tok('clear()'));
  await withApps(async (make) => {
    const app = make(h(Counter, { n: 0 }));
    await app.instance.waitUntilRenderFlush();
    t.equal(app.screen(), 'line one\ncount 0\nline three');
    const before = app.bytes().length;
    app.instance[name]();
    t.equal(app.bytes().slice(before), '\x1b[2K\x1b[1A\x1b[2K\x1b[1A\x1b[2K\x1b[1A\x1b[2K\x1b[G', 'the three rows of the frame are erased');
    t.equal(app.screen(), '', 'nothing is left on the screen');
    app.instance.rerender(h(Counter, { n: 0 }));
    await app.instance.waitUntilRenderFlush();
    t.equal(app.screen(), 'line one\ncount 0\nline three', 'and the same frame can be drawn again');
  });
});

s.fence(F, 2, {
  run: async (t, fence) => {
    const { apps } = await runFenceLikeInk(fence);
    await apps[0].flush();
    t.equal(apps[0].screen(), '2', 'the second frame replaced the first');
    t.ok(apps[0].bytes().includes('1'), 'which showed the initial count');
  },
});

// ===================================================================== renderToString

s.fact(F, ['`renderToString(tree, options?)` — render without a terminal'], { kind: 'R' }, async (t, q) => {
  const renderToStringFn = q.api(ink, 'renderToString(tree, options?)');
  const writes = [];
  const [out, err] = [process.stdout.write, process.stderr.write];
  process.stdout.write = (chunk) => (writes.push(String(chunk)), true);
  process.stderr.write = (chunk) => (writes.push(String(chunk)), true);
  let output;
  try {
    output = renderToStringFn(h(Box, { padding: 1 }, h(Text, null, 'hello')));
  } finally {
    process.stdout.write = out;
    process.stderr.write = err;
  }
  t.equal(output, '\n hello\n', 'it returns the rendering as a string');
  t.deepEqual(writes, [], 'and writes to no stream');
  const probe = await runIsolated({ probe: 'ink-rendering-and-lifecycle-render', env: { ...ENV, PROBE_MODE: 'string' }, tty: {} });
  t.deepEqual(probe.json, { output: 'count 0', resizeListeners: 0, stdinListeners: 0 }, 'in a process with no terminal at all');
});

s.fact(
  F,
  ['Synchronously renders to a string — no stdout writes, no terminal listeners, no persistent process.'],
  { kind: 'R', timeout: 30_000 },
  async (t) => {
    const result = renderToString(h(Text, { color: 'green' }, 'x'));
    t.equal(typeof result, 'string', 'the result is a string, not a promise');
    const writes = [];
    const original = process.stdout.write;
    process.stdout.write = (chunk) => (writes.push(String(chunk)), true);
    try {
      renderToString(FRAME);
    } finally {
      process.stdout.write = original;
    }
    t.deepEqual(writes, [], 'nothing is written to stdout');
    const before = ['resize', 'data', 'readable'].map((event) => process.stdout.listenerCount(event) + process.stdin.listenerCount(event));
    renderToString(FRAME);
    t.deepEqual(['resize', 'data', 'readable'].map((event) => process.stdout.listenerCount(event) + process.stdin.listenerCount(event)), before, 'no listener is added to stdout or stdin');
    const asString = await runIsolated({ probe: 'ink-rendering-and-lifecycle-render', env: { ...ENV, PROBE_MODE: 'string' }, tty: TTY });
    t.deepEqual([asString.json.resizeListeners, asString.json.stdinListeners], [0, 0], 'not even on a real terminal');
    const asApp = await renderProbe({});
    t.equal(asApp.json.resizeListeners, 1, 'positive control: render() on the same terminal does listen for resize');
    const ended = await processProbe('string');
    t.deepEqual(ended.json, { scenario: 'string', alive: false }, 'and the process is free to end right away');
  },
);

s.guidance(F, ['Useful for docs generation, writing to a file, or snapshot-style tests.'], 'suggested uses; a recommendation that asserts nothing about behaviour');

s.fence(F, 3, {
  run: async (t, fence) => {
    const { logs } = await runFenceLikeInk(fence);
    t.equal(logs.length, 1, 'one console.log');
    t.equal(logs[0], renderToString(h(Box, { padding: 1 }, h(Text, { color: 'green' }, 'Hello World'))), 'of the rendering');
    t.equal(stripAnsi(logs[0]), '\n Hello World\n', 'a box with padding 1 around the text');
  },
});

s.fact(
  F,
  ['Only option: `columns` (`number`, default `80`) — the virtual terminal width text wraps against.'],
  { kind: 'D' },
  async (t, q) => {
    const option = q.tok('columns');
    const fallback = Number(q.tok('80'));
    t.equal(typeof fallback, q.tok('number'));
    const lines = (options) => renderToString(h(Text, null, 'x'.repeat(100)), options).split('\n').map((line) => line.length);
    t.deepEqual(lines(undefined), [fallback, 100 - fallback], 'without the option text wraps at 80');
    t.deepEqual(lines({ [option]: fallback }), lines(undefined), 'which is the default');
    t.deepEqual(lines({ [option]: 30 }), [30, 30, 30, 10], 'a number wraps text at that width');
    t.deepEqual(lines({ [option]: 120 }), [100], 'wider than the text: no wrapping');
  },
);

s.types(
  F,
  ['Only option: `columns` (`number`, default `80`)'],
  tsx`
import {renderToString, Text, type RenderToStringOptions} from 'ink';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const keys: Same<keyof RenderToStringOptions, 'columns'> = true; // columns
export const type: Same<RenderToStringOptions['columns'], number | undefined> = true; // number
export const ok = renderToString(<Text>x</Text>, {columns: 40});
export const rows = renderToString(<Text>x</Text>, {rows: 10}); //! TS2353
export const text = renderToString(<Text>x</Text>, {columns: '40'}); //! TS2322
`,
  { ctx: ['columns', 'number', '80'] },
);

s.fact(
  F,
  ['Caveats: terminal-only hooks (`useInput`, `useStdin`, `useStdout`, `useStderr`, `useApp`, `useFocus`, `useFocusManager`) return no-op defaults rather than throwing.'],
  { kind: 'R' },
  async (t, q) => {
    const hooks = ['useInput', 'useStdin', 'useStdout', 'useStderr', 'useApp', 'useFocus', 'useFocusManager'].map((name) => q.api(ink, name));
    const writes = [];
    const [out, err] = [process.stdout.write, process.stderr.write];
    process.stdout.write = (chunk) => (writes.push(String(chunk)), true);
    process.stderr.write = (chunk) => (writes.push(String(chunk)), true);
    const results = [];
    try {
      const App = () => {
        for (const hook of hooks) results.push(hook(() => {}));
        return h(Text, null, 'ok');
      };
      t.equal(renderToString(h(App)), 'ok', 'rendering with every one of them does not throw');
      for (const result of results.filter((value) => value && typeof value === 'object')) {
        for (const member of Object.values(result).filter((value) => typeof value === 'function')) {
          let returned;
          t.doesNotThrow(() => (returned = member(() => {})), 'calling what they return does not throw either');
          await returned;
        }
      }
    } finally {
      process.stdout.write = out;
      process.stderr.write = err;
    }
    t.deepEqual(writes, [], 'and none of them does anything: no writes');
    const [, stdin, stdout, , app, focus] = results;
    t.equal(stdin.isRawModeSupported, false, 'there is no terminal to read from');
    t.equal(stdin.setRawMode(true), undefined);
    t.equal(stdout.write('x'), undefined, 'writing goes nowhere');
    t.equal(app.exit(), undefined, 'exit() ends nothing');
    t.equal(focus.isFocused, false, 'nothing has focus');
  },
);

s.fact(
  F,
  ['`useWindowSize` is not one of them: it reads the real `process.stdout` size (with the fallbacks described in `ink-terminal-io`) and ignores the `columns` option, so size a `renderToString` layout with explicit widths or `columns`, not `useWindowSize`.'],
  { kind: 'R', ctx: ['ink-terminal-io'], timeout: 20_000 },
  async (t, q) => {
    const hook = q.tok('useWindowSize');
    const option = q.tok('columns');
    const renderToStringFn = q.api(ink, 'renderToString');
    const [stream, property] = q.tok('process.stdout').split('.');
    t.equal(stream, 'process');
    const run = await runIsolated({ probe: 'ink-rendering-and-lifecycle-render-to-string', env: { ...ENV, PROBE_COLUMNS: JSON.stringify([40, 25]), PROBE_HOOK: hook, PROBE_OPTION: option }, tty: { isTTY: true, columns: 100, rows: 30 } });
    t.equal(run.json[40].size, '100x30', `${hook} reports the size of process.${property} (100×30 here) ...`);
    t.equal(run.json[25].size, '100x30', `... whatever ${option} says`);
    t.deepEqual(run.json[25].wrapped.split('\n').map((line) => line.length), [25, 25, 25, 25], `while the ${option} option does set the width text wraps at`);
    t.deepEqual(renderToStringFn(h(Box, { width: 10 }, h(Text, null, 'x'.repeat(25)))).split('\n').map((line) => line.length), [10, 10, 5], 'and so does an explicit width');
    const bare = await runIsolated({ probe: 'ink-rendering-and-lifecycle-render-to-string', env: { ...ENV, PROBE_COLUMNS: '[40]' }, tty: {} });
    t.equal(bare.json[40].size, '80x24', 'without a terminal it is the fallback size, not the columns option');
  },
);

s.fact(
  F,
  ["`useEffect` runs during the synchronous render but its state updates don't show up in the returned string (it reflects the initial render only); `useLayoutEffect` updates **do** show up, since it fires synchronously during commit."],
  { kind: 'R', ctx: ['do'] },
  async (t, q) => {
    const React = await import('react');
    const effect = React[q.tok('useEffect')];
    const layout = React[q.tok('useLayoutEffect')];
    const ran = [];
    const Passive = () => {
      const [value, setValue] = React.useState('initial');
      effect(() => {
        ran.push('effect');
        setValue('changed by useEffect');
      }, []);
      return h(Text, null, value);
    };
    const Layout = () => {
      const [value, setValue] = React.useState('initial');
      layout(() => {
        setValue('changed by useLayoutEffect');
      }, []);
      return h(Text, null, value);
    };
    t.equal(renderToString(h(Passive)), 'initial', 'the output is the initial render');
    t.deepEqual(ran, ['effect'], 'although the effect did run');
    t.equal(renderToString(h(Layout)), 'changed by useLayoutEffect', 'a layout effect that sets state is part of the output');
  },
);

// ===================================================================== CI behavior

s.fact(
  F,
  ["When `CI` is set (Ink's [`is-in-ci`](https://github.com/sindresorhus/is-in-ci) detection), Ink assumes a non-interactive terminal: only the final frame is written on exit (no continuous overwriting), and resize events aren't listened to."],
  { kind: 'R', timeout: 30_000 },
  async (t, q) => {
    const variable = q.tok('CI');
    const detector = q.tok('is-in-ci');
    t.ok(detector in pkg('ink').dependencies, `Ink depends on ${detector}`);
    const inCi = await renderProbe({ [variable]: '1' });
    t.equal(inCi.stdout.split('\n')[0], 'count 1', 'only the final frame is written: no earlier frame, no erase sequences, just the last text');
    t.ok(!inCi.stdout.includes('\x1b['), 'nothing but text');
    t.equal(inCi.json.resizeListeners, 0, 'no resize listener on stdout');
    const normal = await renderProbe({});
    t.ok(normal.stdout.includes('count 0') && normal.stdout.includes('\x1b[2K'), 'positive control: without CI both frames are drawn, the second over the first');
    t.equal(normal.json.resizeListeners, 1, 'and Ink listens for resize');
  },
);

s.fact(
  F,
  ['Force full interactive rendering in CI with `CI=false node my-cli.js`, or pass `{interactive: true}` to `render()`.'],
  { kind: 'R', timeout: 30_000 },
  async (t, q) => {
    const [variable, value] = q.tok('CI=false node my-cli.js').split(' ')[0].split('=');
    const [key, flag] = q.tok('{interactive: true}').match(/^\{(\w+): (\w+)\}$/).slice(1);
    const renderApi = method(q.tok('render()'));
    t.equal(typeof ink[renderApi], 'function', `${renderApi}() is the function that takes the option`);
    const viaEnvironment = await renderProbe({ [variable]: value, PROBE_RENDER: renderApi });
    t.equal(viaEnvironment.json.resizeListeners, 1, `${variable}=${value} is not CI: interactive again`);
    t.ok(viaEnvironment.stdout.includes('\x1b[2K'));
    const viaOption = await renderProbe({ [variable]: '1', PROBE_RENDER: renderApi, PROBE_OPTIONS: JSON.stringify({ [key]: JSON.parse(flag) }) });
    t.equal(viaOption.json.resizeListeners, 1, `{${key}: ${flag}} makes it interactive although ${variable} is set`);
    t.ok(viaOption.stdout.includes('\x1b[2K'));
    const stillCi = await renderProbe({ [variable]: '1' });
    t.equal(stillCi.json.resizeListeners, 0, 'positive control: with CI set and neither, it is not');
    t.equal((await renderProbe({ [variable]: '' })).json.resizeListeners, 0, 'even an empty CI counts as CI');
  },
);
