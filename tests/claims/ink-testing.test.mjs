// Claims for skills/patterns/ink-testing/SKILL.md. This is the one skill about ink-testing-library, so
// these claims (and only these) use it; everything else in the suite runs Ink on its own fake TTY.
import { EventEmitter } from 'node:events';
import { Readable, Writable } from 'node:stream';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import semver from 'semver';
import React from 'react';
import * as itl from 'ink-testing-library';
import { skill, tsx, runFence, loadEcosystem, pkg, stripAnsi, ink, h, mount, ROOT } from '../lib/index.mjs';
import { loadFile } from '../lib/claims.mjs';
import { itlProbe, itlProbeWithoutTerminal, realProbe, inputProbe, attachProbe } from './ink-testing.helpers.mjs';
import { instances } from './ink-testing.itl-spy.mjs';

const s = skill('ink-testing');
const F = 'SKILL.md';
const { Text, Box, useInput } = ink;
const { useEffect } = React;
const MD = loadFile('ink-testing', F).raw.replace(/\s+/g, ' ');
const skillText = (name) => loadFile(name, 'SKILL.md').raw.replace(/\s+/g, ' ');
const EQ = `type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;`;

const tick = () => new Promise((resolve) => setImmediate(resolve));
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Does the shipped declaration of ink-testing-library declare `member: type;`? */
const declares = (member, type) => new RegExp(`\\b${escapeRegExp(member)}: ${escapeRegExp(type)};`).test(readFileSync(join(ROOT, 'node_modules/ink-testing-library/build/index.d.ts'), 'utf8'));
/** `\x1b` / `\u001B` / `\r` as written in the skill text, turned into the characters. */
const unescape = (text) => text.replace(/\\x([0-9a-f]{2})|\\u([0-9a-f]{4})|\\([rnt])/gi, (_, hex, uni, c) => (hex ? String.fromCharCode(parseInt(hex, 16)) : uni ? String.fromCharCode(parseInt(uni, 16)) : { r: '\r', n: '\n', t: '\t' }[c]));
/** Run `fn`, then unmount every instance ink-testing-library created. */
const withLibrary = async (fn) => {
  try {
    return await fn();
  } finally {
    itl.cleanup();
  }
};
/** A component that logs what `useInput` hands it. */
const Listener = ({ log }) => {
  useInput((input, key) => log.push({ input, key: Object.keys(key).filter((name) => key[name] === true).sort() }));
  return h(Text, null, 'listening');
};
const Counter = () => {
  const [count, setCount] = React.useState(0);
  useInput((input, key) => {
    if (key.upArrow) setCount((c) => c + 1);
  });
  return h(Text, null, String(count));
};

// ===================================================================== description

s.fact(
  F,
  ['Test Ink components with ink-testing-library — render(), lastFrame()/frames for asserting on output, stdin.write() to simulate keypresses, unmount/cleanup, and why CI=false matters when a test needs full interactive rendering.'],
  { kind: 'R' },
  async (t) =>
    withLibrary(async () => {
      t.equal(typeof itl.render, 'function', 'render() is exported');
      const app = itl.render(h(Counter));
      t.equal(typeof app.lastFrame, 'function', 'lastFrame()');
      t.ok(Array.isArray(app.frames), 'and frames');
      t.equal(app.lastFrame(), '0', 'assert on the output');
      app.stdin.write('\u001B[A');
      await tick();
      t.equal(app.lastFrame(), '1', 'stdin.write() simulates a keypress');
      t.equal(typeof app.unmount, 'function', 'unmount');
      t.equal(typeof app.cleanup, 'function', 'and cleanup on the instance');
      t.equal(typeof itl.cleanup, 'function', 'and as a standalone export');
      // CI=false: a real render() in a subprocess draws every frame only when CI is false
      const [ci, notCi] = [await realProbe({ CI: 'true' }), await realProbe({ CI: 'false' })];
      t.ok(!ci.writes.join('').includes('frame 1'), 'with CI set a real render() writes only the last frame');
      t.ok(['frame 1', 'frame 2', 'frame 3'].every((frame) => notCi.writes.join('').includes(frame)), 'with CI=false it draws all of them: full interactive rendering');
    }),
);

s.guidance(F, ['Use when the user wants to write or debug tests for an Ink component.'], 'a recommendation about when to reach for the skill; it asserts nothing about behaviour (the testing API is exercised by the claims below)');

// ===================================================================== intro

s.fact(
  F,
  ['[`ink-testing-library`](https://github.com/vadimdemedes/ink-testing-library) provides its own `render()` that returns fake in-memory streams instead of attaching to a real terminal — no TTY needed, safe to run in CI.'],
  { kind: 'R' },
  async (t, q) => {
    const name = q.tok('ink-testing-library');
    const library = await import(name);
    const renderName = q.tok('render()').replace('()', '');
    t.equal(typeof library[renderName], 'function', 'the package exports its own render');
    t.notEqual(library[renderName], ink[renderName], 'which is not the one Ink exports');
    const link = MD.match(/\[`ink-testing-library`\]\((https:\/\/github\.com\/[^)]+)\)/)[1];
    const repository = pkg(name).repository;
    t.equal(link, `https://github.com/${typeof repository === 'string' ? repository : repository.url}`, 'the link goes to the package repository');
    await withLibrary(async () => {
      const spies = [];
      for (const stream of [process.stdout, process.stderr]) {
        const original = stream.write;
        const calls = [];
        stream.write = (...args) => (calls.push(args), true);
        spies.push({ stream, original, calls });
      }
      let app;
      try {
        app = library[renderName](h(Text, null, 'Hello'));
        app.rerender(h(Text, null, 'Hello again'));
        app.unmount();
      } finally {
        for (const { stream, original } of spies) stream.write = original;
      }
      t.deepEqual(spies.map(({ calls }) => calls.length), [0, 0], 'rendering, updating and unmounting write nothing to the process stdout or stderr');
      for (const stream of [app.stdout, app.stderr, app.stdin]) {
        t.ok(stream instanceof EventEmitter && !(stream instanceof Writable) && !(stream instanceof Readable), 'the streams it returns are plain event emitters, not Node streams');
        t.equal(stream.fd, undefined, 'with no file descriptor behind them');
      }
      t.ok(app.frames.length > 0 && app.frames.every((frame) => typeof frame === 'string'), 'what was drawn is kept in memory, as strings');
    });
    // a real render() writes to the stdout of the process, the fake one does not
    const [real, fake] = [await attachProbe('real'), await attachProbe('fake')];
    t.ok(real.stdoutWrites.join('').includes('drawn on the terminal'), 'positive control: Ink render() draws on the process stdout');
    t.deepEqual(fake.stdoutWrites, [], 'ink-testing-library draws nothing there');
    t.equal(fake.frame, 'drawn on the terminal', 'the text is in lastFrame() instead');
    t.equal(fake.isTTY, null, 'in a process whose stdout is not a TTY');
    t.equal(fake.stdinIsTTY, null, 'nor its stdin');
    const ci = await itlProbe({ env: { CI: 'true' } });
    t.equal(ci.hello, 'Hello World', 'it works with no TTY and with CI set');
  },
);

s.fact(
  F,
  ['Use `ink-testing-library@^4.0.0` — it works with Ink 8 (its only peer is `@types/react`).'],
  { kind: 'P' },
  async (t, q) => {
    const [name, range] = q.tok('ink-testing-library@^4.0.0').split(/(?<=\w)@/);
    const version = pkg(name).version;
    t.ok(semver.satisfies(version, range), `the installed ${name} ${version} is in ${range}`);
    const { packages } = await loadEcosystem();
    t.ok(semver.satisfies(packages.find((p) => p.name === name).version, range), 'and so is the latest published version');
    t.equal(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).devDependencies[name], range, 'which is the range the repository itself installs');
    t.deepEqual(Object.keys(pkg(name).peerDependencies ?? {}), [q.tok('@types/react')], 'its only peer is @types/react');
    t.equal(semver.major(pkg('ink').version), Number(q.tok('8')), 'the Ink it runs on here is 8');
    await withLibrary(async () => {
      const app = itl.render(h(Text, null, 'Hello World'));
      t.equal(app.lastFrame(), 'Hello World', 'and it renders on it');
    });
  },
);

s.fence(F, 0, {
  run: async (t, fence) => {
    instances.length = 0;
    await withLibrary(async () => {
      await runFence(fence, { replace: [[/from\s+(['"])ink-testing-library\1/, `from '${new URL('./ink-testing.itl-spy.mjs', import.meta.url).href}'`]] });
      t.equal(instances.length, 1, 'the fence renders once');
      const [expression, shown] = fence.code.match(/^(.*lastFrame\(\).*);\s*\/\/ => (\w+)$/m).slice(1, 3);
      t.equal(String(new Function('lastFrame', `return ${expression}`)(instances[0].lastFrame)), shown, 'the expression the comment shows evaluates to what it says');
    });
  },
});
s.fact(F, ["lastFrame() === 'Hello World'; // => true"], { kind: 'R' }, async (t) =>
  withLibrary(async () => {
    const { lastFrame } = itl.render(h(() => h(Text, null, 'Hello World')));
    t.equal(lastFrame() === 'Hello World', true, 'rendering <Text>Hello World</Text> gives exactly that frame');
    t.equal(itl.render(h(Text, null, 'Hello')).lastFrame() === 'Hello World', false, 'positive control: another text does not');
  }),
);

// ===================================================================== what render() returns

const ROW = {
  lastFrame: '`lastFrame()` | `() => string | undefined` | The most recent write to stdout — normally the latest frame — as the raw string Ink wrote; already set when `render()` returns.',
  frames: '`frames` | `string[]` | Every stdout write so far — the rendered frames, and `useStdout().write(text)` as an entry holding `text` followed by the current frame — assert on intermediate states, not just the final one.',
  stdin: '`stdin` | fake stream | Has its own `write(data: string)` — see below.',
  stdout: '`stdout` | fake stream | Same array and function as the top-level `frames`/`lastFrame()` (`stdout.frames === frames`).',
  stderr: '`stderr` | fake stream | Own `frames`/`lastFrame()`; `useStderr().write` output lands here (and the current frame is written to `frames` again).',
  rerender: "`rerender(tree)` | `(tree) => void` | Update props / replace the root, same as the real `Instance.rerender`.",
  unmount: "`unmount()` | `() => void` | Unmount the component under test; the writes it makes while unmounting end with an empty string, so `lastFrame()` is `''` afterwards.",
  cleanup: '`cleanup()` | `() => void` | Same as `unmount()` on Ink 8 (Ink\'s own `cleanup` unmounts). The standalone `cleanup` export unmounts every instance created so far — call it in an `afterEach`.',
};

// --- lastFrame()
s.types(F, [ROW.lastFrame], tsx`
import React from 'react';
import {render} from 'ink-testing-library';
${EQ}
type Instance = ReturnType<typeof render>;
export const type: Equal<Instance['lastFrame'], () => string | undefined> = true;
export const checked: string | undefined = render(<></>).lastFrame();
export const unchecked: string = render(<></>).lastFrame(); //! TS2322
`, { ctx: ['lastFrame()', 'render()'] });
s.fact(F, [ROW.lastFrame], { kind: 'R' }, async (t, q) =>
  withLibrary(async () => {
    const render = q.api(itl, 'render()');
    const signature = q.tok('() => string | undefined');
    const [params, returns] = signature.split(' => ');
    t.ok(declares(q.tok('lastFrame()').replace('()', ''), signature), 'the declared type of lastFrame in the package');
    const tree = (color) => h(Text, { color }, 'Hello');
    const app = render(tree('green'));
    const lastFrame = q.api(app, 'lastFrame()');
    t.equal(lastFrame.length, params.match(/\w+/g)?.length ?? 0, 'it takes no arguments');
    t.ok(returns.split(' | ').includes(typeof lastFrame()), 'and returns a string');
    t.equal(lastFrame(), ink.renderToString(tree('green'), { columns: 100 }), 'already set when render() returns: the frame, as the raw string (with its escape codes)');
    t.ok(lastFrame().includes('\x1b[32m'), 'raw: the colour codes are in it');
    const written = [];
    const original = app.stdout.write;
    app.stdout.write = (frame) => (written.push(frame), original(frame));
    app.rerender(tree('red'));
    app.rerender(h(Text, null, 'later'));
    app.stdout.write = original;
    t.deepEqual(written.map((frame) => stripAnsi(frame)), ['Hello', 'later'], 'two updates, two writes');
    t.equal(lastFrame(), written.at(-1), 'it is the most recent write');
    t.equal(lastFrame(), 'later', 'which is normally the latest frame');
  }),
);

// --- frames
s.types(F, [ROW.frames], tsx`
import React from 'react';
import {render} from 'ink-testing-library';
${EQ}
type Instance = ReturnType<typeof render>;
export const type: Equal<Instance['frames'], string[]> = true;
`, { ctx: ['useStdout().write(text)', 'text'] });
s.fact(F, [ROW.frames], { kind: 'R' }, async (t, q) =>
  withLibrary(async () => {
    const frames = q.tok('frames');
    const element = q.tok('string[]').replace('[]', '');
    const [hook, method, parameter] = q.tok('useStdout().write(text)').match(/^(\w+)\(\)\.(\w+)\((\w+)\)$/).slice(1);
    t.equal(q.tok('text'), parameter, 'the text the call is given');
    let stdout;
    const Writer = () => {
      stdout = ink[hook]();
      return h(Text, null, 'body');
    };
    const app = itl.render(h(Writer));
    t.ok(Array.isArray(app[frames]) && app[frames].every((frame) => typeof frame === element), 'an array of strings');
    // every write the stream receives, in order
    const received = [];
    const original = app.stdout.write;
    app.stdout.write = (frame) => (received.push(frame), original(frame));
    const before = app[frames].length;
    app.rerender(h(Text, null, 'second'));
    app.rerender(h(Text, null, 'third'));
    t.deepEqual(app[frames].slice(before), received, 'it holds exactly the writes the stdout received');
    const current = app.lastFrame();
    stdout[method]('written by the component\n');
    app.stdout.write = original;
    t.equal(app[frames].at(-1), `written by the component\n${current}`, `${hook}().${method}(${parameter}) is one entry: the text, then the current frame`);
    const kept = [...app[frames]];
    app.rerender(h(Text, null, 'fourth'));
    t.deepEqual(app[frames].slice(0, kept.length), kept, 'frames only ever grows: intermediate states stay readable');
  }),
);

// --- stdin
s.types(F, [ROW.stdin], tsx`
import React from 'react';
import {render} from 'ink-testing-library';
${EQ}
type Instance = ReturnType<typeof render>;
export const write: Equal<Instance['stdin']['write'], (data: string) => void> = true;
export const ok = render(<></>).stdin.write('a');
export const wrong = render(<></>).stdin.write(1); //! TS2345
`, { ctx: ['write(data: string)'] });
s.fact(F, [ROW.stdin], { kind: 'R' }, async (t, q) =>
  withLibrary(async () => {
    const stdin = q.tok('stdin');
    const [method, parameter, type] = q.tok('write(data: string)').match(/^(\w+)\((\w+): (\w+)\)$/).slice(1);
    const app = itl.render(h(Text, null, 'x'));
    const fake = app[stdin];
    t.ok(fake instanceof EventEmitter && !(fake instanceof Readable), 'a fake stream: an event emitter, not a Node stream');
    t.ok(Object.hasOwn(fake, method) && typeof fake[method] === 'function', `with a ${method} of its own (a property, not a Readable method)`);
    t.match(String(fake[method]), new RegExp(`^\\(?${parameter}\\)?\\s*=>`), `taking ${parameter}`);
    const received = [];
    fake.on('data', (data) => received.push(data));
    const payload = 'typed';
    t.equal(typeof payload, type, `a ${type}`);
    fake[method](payload);
    t.deepEqual(received, [payload], 'which is emitted to the listeners as it is');
    t.equal(fake.read(), payload, 'and can be read back once');
    t.equal(fake.read(), null, 'and only once');
  }),
);

// --- stdout
s.types(F, [ROW.stdout], tsx`
import React from 'react';
import {render} from 'ink-testing-library';
${EQ}
type Instance = ReturnType<typeof render>;
export const frames: Equal<Instance['stdout']['frames'], Instance['frames']> = true;
export const lastFrame: Equal<Instance['stdout']['lastFrame'], Instance['lastFrame']> = true;
`, { ctx: ['stdout', 'frames', 'lastFrame()', 'stdout.frames === frames'] });
s.fact(F, [ROW.stdout], { kind: 'R' }, async (t, q) =>
  withLibrary(async () => {
    const app = itl.render(h(Text, null, 'x'));
    const { [q.tok('stdout')]: stdout, [q.tok('frames')]: frames } = app;
    t.equal(new Function('stdout', 'frames', `return ${q.tok('stdout.frames === frames')}`)(stdout, frames), true, 'the array is the same one');
    const lastFrame = q.api(app, 'lastFrame()');
    t.equal(stdout.lastFrame, lastFrame, 'and so is the function');
    app.rerender(h(Text, null, 'y'));
    t.deepEqual(frames, ['x', 'y'], 'a write through the stream shows up in the top-level array');
    t.equal(stdout.lastFrame(), 'y');
    t.notEqual(frames, app.stderr.frames, 'positive control: stderr has an array of its own');
  }),
);

// --- stderr
s.types(F, [ROW.stderr], tsx`
import React from 'react';
import {render} from 'ink-testing-library';
${EQ}
type Instance = ReturnType<typeof render>;
export const frames: Equal<Instance['stderr']['frames'], string[]> = true;
export const lastFrame: Equal<Instance['stderr']['lastFrame'], () => string | undefined> = true;
`, { ctx: ['stderr', 'frames', 'lastFrame()', 'useStderr().write'] });
s.fact(F, [ROW.stderr], { kind: 'R' }, async (t, q) =>
  withLibrary(async () => {
    const hook = q.tok('useStderr().write').match(/^(\w+)\(\)\.(\w+)$/).slice(1);
    let stderr;
    const Writer = () => {
      stderr = ink[hook[0]]();
      return h(Text, null, 'body');
    };
    const app = itl.render(h(Writer));
    const { [q.tok('stderr')]: err } = app;
    t.notEqual(err[q.tok('frames')], app[q.tok('frames')], 'its frames are an array of its own');
    t.notEqual(err.lastFrame, app.lastFrame, 'and so is its lastFrame()');
    const errLastFrame = q.api(err, 'lastFrame()');
    t.equal(errLastFrame(), undefined, 'empty until something is written to it');
    const before = app.frames.length;
    stderr[hook[1]]('a warning\n');
    t.deepEqual(err.frames, ['a warning\n'], 'the written text lands there');
    t.equal(errLastFrame(), 'a warning\n');
    t.ok(!app.frames.some((frame) => frame.includes('a warning')), 'and not in the stdout frames');
    t.deepEqual(app.frames.slice(before), ['body'], 'where the current frame is written again instead');
    t.equal(app.lastFrame(), 'body');
  }),
);

// --- rerender
s.types(F, [ROW.rerender], tsx`
import React from 'react';
import {render} from 'ink-testing-library';
${EQ}
type Instance = ReturnType<typeof render>;
export const type: Equal<Instance['rerender'], (tree: React.ReactElement) => void> = true;
export const ok = render(<></>).rerender(<></>);
export const wrong = render(<></>).rerender('text'); //! TS2345
`, { ctx: ['rerender(tree)', '(tree) => void', 'Instance.rerender'] });
s.fact(F, [ROW.rerender], { kind: 'R' }, async (t, q) => {
  const method = q.tok('rerender(tree)').match(/^(\w+)\((\w+)\)$/)[1];
  const [params, returns] = q.tok('(tree) => void').split(' => ');
  const [typeName, member] = q.tok('Instance.rerender').split('.');
  t.match(readFileSync(join(ROOT, 'node_modules/ink/build/render.d.ts'), 'utf8'), new RegExp(`export type ${typeName} = \\{[\\s\\S]*?\\n    ${member}: `), `Ink's ${typeName} type has a ${member}`);
  // the same scenario against ink-testing-library and against Ink's own instance
  const scenario = async (start, update) => {
    const events = [];
    const Probe = ({ label }) => {
      useEffect(() => {
        events.push('mounted');
        return () => events.push('unmounted');
      }, []);
      return h(Text, null, label);
    };
    const first = start(h(Probe, { label: 'one' }));
    const frames = [first.frame()];
    await update(first, h(Probe, { label: 'two' }));
    frames.push(first.frame());
    await update(first, h(Box, null, h(Probe, { label: 'three' })));
    frames.push(first.frame());
    return { events: [...events], frames: frames.map((frame) => stripAnsi(frame).trim()) };
  };
  const viaLibrary = await withLibrary(() => scenario((tree) => {
    const app = itl.render(tree);
    app.frame = () => app.lastFrame();
    t.equal(typeof app[method], 'function', 'the instance has the method');
    t.equal(app[method].length, params.match(/\w+/g).length, 'with one parameter, the tree');
    return app;
  }, async (app, tree) => {
    t.equal(app[method](tree), undefined, `and returns ${returns}`);
  }));
  const viaInk = await scenario((tree) => {
    const app = mount(tree);
    app.frame = () => app.screen();
    return app;
  }, (app, tree) => app[method](tree));
  t.deepEqual(viaLibrary.frames, ['one', 'two', 'three'], 'the output follows each tree');
  t.deepEqual(viaLibrary.events, ['mounted', 'unmounted', 'mounted'], 'the same component type with new props is updated in place; a different root replaces the old one');
  t.deepEqual(viaLibrary, viaInk, 'exactly what Ink own instance does');
});

// --- unmount
s.types(F, [ROW.unmount], tsx`
import React from 'react';
import {render} from 'ink-testing-library';
${EQ}
type Instance = ReturnType<typeof render>;
export const type: Equal<Instance['unmount'], () => void> = true;
`, { ctx: ['unmount()', 'lastFrame()', "''"] });
s.fact(F, [ROW.unmount], { kind: 'R' }, async (t, q) =>
  withLibrary(async () => {
    const signature = q.tok('() => void');
    const [params, returns] = signature.split(' => ');
    t.ok(declares(q.tok('unmount()').replace('()', ''), signature), 'the declared type of unmount in the package');
    const empty = q.tok("''").slice(1, -1);
    const log = [];
    const Probe = () => {
      useEffect(() => () => log.push('cleaned up'), []);
      return h(Text, null, 'body');
    };
    const app = itl.render(h(Probe));
    const unmount = q.api(app, 'unmount()');
    t.equal(unmount.length, params.match(/\w+/g)?.length ?? 0, 'it takes no arguments');
    t.equal(app.lastFrame(), 'body');
    const before = [...app.frames];
    t.equal(unmount(), undefined, `it returns ${returns}`);
    t.deepEqual(log, ['cleaned up'], 'the component is unmounted: its effects are cleaned up');
    t.equal(app[q.tok('lastFrame()').replace('()', '')](), empty, 'what lastFrame() returns afterwards is an empty string');
    t.deepEqual(app.frames.slice(0, before.length), before, 'while the frames written earlier are all still there');
    t.equal(app.frames.at(-1), empty, 'the unmounting writes end with the empty string');
    const total = app.frames.length;
    app.stdin.write('\u001B[A');
    await tick();
    app.rerender(h(Text, null, 'late'));
    t.equal(app.frames.length, total, 'and nothing is drawn after it');
  }),
);

// --- cleanup
s.types(F, [ROW.cleanup], tsx`
import React from 'react';
import {render, cleanup} from 'ink-testing-library';
${EQ}
type Instance = ReturnType<typeof render>;
export const type: Equal<Instance['cleanup'], () => void> = true;
export const standalone: Equal<typeof cleanup, () => void> = true;
`, { ctx: ['cleanup()', 'unmount()', 'cleanup', 'afterEach', '8'] });
s.fact(F, [ROW.cleanup], { kind: 'R', ctx: ['afterEach'] }, async (t, q) => {
  t.equal(semver.major(pkg('ink').version), Number(q.tok('8')), 'Ink 8');
  const signature = q.tok('() => void');
  const [params, returns] = signature.split(' => ');
  const standalone = q.api(itl, 'cleanup');
  const method = q.tok('cleanup()').replace('()', '');
  const unmountName = q.tok('unmount()').replace('()', '');
  t.ok(declares(method, signature), 'the declared type of cleanup on an instance in the package');
  const log = [];
  const Probe = ({ name }) => {
    useEffect(() => () => log.push(`unmounted ${name}`), []);
    return h(Text, null, name);
  };
  try {
    // Ink's own instance, which ink-testing-library hands out as `cleanup`
    const own = mount(h(Probe, { name: 'own' }));
    await own.flush();
    own.instance.cleanup();
    t.deepEqual(log, ['unmounted own'], "Ink's own cleanup unmounts the app");
    log.length = 0;
    const a = itl.render(h(Probe, { name: 'a' }));
    const b = itl.render(h(Probe, { name: 'b' }));
    const c = itl.render(h(Probe, { name: 'c' }));
    t.deepEqual(log, [], 'instances stay mounted until something unmounts them');
    t.equal(a[method].length, params.match(/\w+/g)?.length ?? 0, 'the instance cleanup takes no arguments');
    t.equal(a[method](), undefined, `and returns ${returns}`);
    t.deepEqual(log, ['unmounted a'], 'cleanup() on an instance unmounts that instance and no other');
    b[unmountName]();
    const framesAfterUnmount = JSON.stringify(b.frames);
    t.deepEqual(log, ['unmounted a', 'unmounted b'], 'unmount() does the same');
    const unmounted = (instance) => JSON.stringify(instance.frames);
    const reference = itl.render(h(Probe, { name: 'r' }));
    reference.cleanup();
    const other = itl.render(h(Probe, { name: 'r' }));
    other[unmountName]();
    t.deepEqual(reference.frames, other.frames, 'with the same frames written: the two are the same operation on Ink 8');
    log.length = 0;
    a[method]();
    t.deepEqual(log, [], 'calling it again changes nothing');
    t.equal(unmounted(b), framesAfterUnmount, 'and writes nothing');
    t.equal(standalone(), undefined, 'the standalone cleanup returns nothing too');
    t.ok(log.includes('unmounted c'), 'the standalone one unmounts every instance created so far: c, which was still mounted');
    t.equal(log.filter((entry) => entry === 'unmounted c').length, 1);
    t.equal(c.lastFrame(), '', 'and its output ends as an unmounted one does');
    t.equal(log.filter((entry) => entry === 'unmounted a').length, 0, 'those already unmounted are not unmounted a second time');
    log.length = 0;
    const later = itl.render(h(Probe, { name: 'd' }));
    t.deepEqual(log, [], 'positive control: a new instance is mounted');
    standalone();
    t.deepEqual(log, ['unmounted d'], 'and the standalone export reaches it too');
    t.equal(later.lastFrame(), '');
  } finally {
    itl.cleanup();
  }
});

// ===================================================================== simulating keyboard input

s.fact(
  F,
  ['Write raw bytes/escape sequences to the fake `stdin` — `useInput` in the component under test receives them exactly as if a real terminal sent them:'],
  { kind: 'R' },
  async (t, q) =>
    withLibrary(async () => {
      const stdin = q.tok('stdin');
      const useInputHook = q.api(ink, 'useInput');
      const sequences = ['a', 'Z', 'hello', '\x1b[A', '\x1b[B', '\x1b[D', '\x1b[C', '\r', '\t', '\x1b[Z', '\x7f', '\x1b[3~', ' ', '\x03', '\x01', '\x1ba', 'é', '\x1b[5~', '\x1b[H'];
      const { viaLibrary, viaStream } = await inputProbe(sequences);
      t.equal(viaLibrary.length, sequences.length, 'every write reached the handler once');
      t.deepEqual(viaLibrary, viaStream, 'the handler gets the same (input, key) as from a real stream fed the same bytes');
      t.ok(viaLibrary.some((entry) => entry.key.includes('upArrow')) && viaLibrary.some((entry) => entry.input === 'hello'), 'escape sequences become keys, text arrives as typed');
      // and in this process, through the same hook
      const log = [];
      const app = itl.render(h(Listener, { log }));
      t.ok(stdin in app, 'the stream is on the instance');
      app[stdin].write('x');
      await tick();
      t.deepEqual(log, [{ input: 'x', key: [] }]);
      t.equal(typeof useInputHook, 'function');
    }),
);

s.fence(F, 1, {
  run: async (t, fence) => {
    instances.length = 0;
    await withLibrary(async () => {
      await runFence(fence, { replace: [[/from\s+(['"])ink-testing-library\1/, `from '${new URL('./ink-testing.itl-spy.mjs', import.meta.url).href}'`]] });
      const [expression, shown] = fence.code.match(/^(.*lastFrame\(\).*);\s*\/\/ => (\w+)$/m).slice(1, 3);
      t.equal(instances.length, 1);
      t.equal(String(new Function('lastFrame', `return ${expression}`)(instances[0].lastFrame)), shown, 'after the keypress the frame reads what the comment says');
    });
  },
});
s.fact(F, ["lastFrame() === '1'; // => true"], { kind: 'R' }, async (t, q) =>
  withLibrary(async () => {
    const one = q.tok('1');
    const { lastFrame, stdin } = itl.render(h(Counter));
    t.equal(lastFrame() === one, false, 'positive control: before any key the counter does not read it');
    stdin.write('\u001B[A');
    await tick();
    t.equal(lastFrame() === one, true, 'one Up arrow later the frame is exactly that');
    stdin.write('\u001B[A');
    await tick();
    t.equal(lastFrame() === one, false, 'and a second one moves it on');
  }),
);
s.fact(F, ["stdin.write('\\u001B[A'); // up arrow escape sequence"], { kind: 'R' }, async (t) =>
  withLibrary(async () => {
    const log = [];
    const app = itl.render(h(Listener, { log }));
    app.stdin.write('\u001B[A');
    await tick();
    t.deepEqual(log, [{ input: '', key: ['upArrow'] }], 'the sequence ESC [ A is the up arrow');
    app.stdin.write('\u001B[B');
    await tick();
    t.deepEqual(log.at(-1).key, ['downArrow'], 'positive control: B is the down arrow');
  }),
);
s.fact(F, ['await delay(0); // Ink applies input asynchronously — let it render before asserting'], { kind: 'R' }, async (t, q) =>
  withLibrary(async () => {
    const milliseconds = Number(q.tok('0'));
    t.equal(milliseconds, 0, 'the shortest possible wait');
    const { lastFrame, stdin } = itl.render(h(Counter));
    stdin.write('\u001B[A');
    t.equal(lastFrame(), '0', 'right after the write nothing has been rendered yet');
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
    t.equal(lastFrame(), '1', 'after that wait it has');
  }),
);

s.fact(F, ["For a single printable character, `stdin.write('a')` is enough — no escape sequence needed."], { kind: 'R' }, async (t, q) =>
  withLibrary(async () => {
    const [path, character] = q.tok("stdin.write('a')").match(/^([\w.]+)\('(.*)'\)$/).slice(1, 3);
    const [object, method] = path.split('.');
    const log = [];
    const app = itl.render(h(Listener, { log }));
    app[object][method](character);
    await tick();
    t.deepEqual(log, [{ input: character, key: [] }], 'the character arrives as the input, with no key flag set');
    t.equal(character.length, 1, 'one printable character');
    t.ok(!character.includes('\x1b'), 'and no escape sequence');
  }),
);

s.fact(
  F,
  ['For special keys (arrows, Enter, Tab), write the raw bytes the terminal would have sent (`\\u001B[A` for Up, `\\r` for Enter, `\\t` for Tab); check `key.*` in your handler matches what you expect the sequence to produce.'],
  { kind: 'R' },
  async (t, q) =>
    withLibrary(async () => {
      const [up, enter, tab] = [q.tok('\\u001B[A'), q.tok('\\r'), q.tok('\\t')].map(unescape);
      const [parameter] = q.tok('key.*').split('.');
      t.match(readFileSync(join(ROOT, 'node_modules/ink/build/hooks/use-input.d.ts'), 'utf8'), new RegExp(`type Handler = \\(input: string, ${parameter}: Key\\) => void;`), 'the handler receives the key object as its second argument');
      const log = [];
      const app = itl.render(h(Listener, { log }));
      for (const bytes of [up, enter, tab]) {
        app.stdin.write(bytes);
        await tick();
      }
      t.deepEqual(log.map((entry) => entry.key), [['upArrow'], ['return'], ['tab']], 'Up, Enter and Tab: the bytes in the text produce those keys');
      const received = [];
      const Capture = () => {
        useInput((input, key) => received.push(key));
        return h(Text, null, 'capturing');
      };
      const capturing = itl.render(h(Capture));
      capturing.stdin.write(up);
      await tick();
      t.equal(typeof received[0].upArrow, 'boolean', 'key.upArrow and its siblings are booleans on the object the handler is given');
      t.equal(received[0].upArrow, true);
      t.equal(received[0].downArrow, false);
    }),
);

s.fact(
  F,
  ['Ink 8 drops unrecognized control sequences (mouse, focus, cursor reports) before `useInput`, so writing them via `stdin.write` in tests never reaches the handler.'],
  { kind: 'R' },
  async (t, q) =>
    withLibrary(async () => {
      t.equal(semver.major(pkg('ink').version), Number(q.tok('8')), 'Ink 8');
      const [object, method] = q.tok('stdin.write').split('.');
      const ignored = { 'a mouse report': '\x1b[<0;10;5M', 'focus in': '\x1b[I', 'focus out': '\x1b[O', 'a cursor position report': '\x1b[12;40R' };
      const log = [];
      const app = itl.render(h(Listener, { log }));
      for (const bytes of ['a', '\x1b[A']) {
        app[object][method](bytes);
        await tick();
      }
      t.equal(log.length, 2, 'positive control: a character and an arrow key reach the handler');
      log.length = 0;
      for (const [what, bytes] of Object.entries(ignored)) {
        app[object][method](bytes);
        await tick();
        t.equal(log.length, 0, `${what} does not`);
      }
      app[object][method]('b');
      await tick();
      t.equal(log.length, 1, 'and the handler still works afterwards');
      t.equal(typeof q.api(ink, 'useInput'), 'function');
    }),
);

// ===================================================================== asserting on styled output

s.fact(
  F,
  ['`lastFrame()` returns exactly what Ink wrote — colors appear as ANSI codes (`\\x1b[32m…`) when chalk detects color support (a color-capable local terminal, `FORCE_COLOR`).'],
  { kind: 'R' },
  async (t, q) =>
    withLibrary(async () => {
      const prefix = unescape(q.tok('\\x1b[32m…').replace('…', ''));
      const variable = q.tok('FORCE_COLOR');
      const app = itl.render(h(Text, { color: 'green' }, 'ok'));
      const lastFrame = q.api(app, 'lastFrame()');
      t.equal(lastFrame(), ink.renderToString(h(Text, { color: 'green' }, 'ok'), { columns: 100 }), 'lastFrame() is exactly the string Ink rendered');
      t.ok(lastFrame().startsWith(prefix), 'in a process where color is supported (FORCE_COLOR is set) it carries the ANSI code');
      const capable = { TERM: 'xterm-256color' };
      const withColor = await itlProbe({ env: { [variable]: '3' } });
      t.equal(withColor.greenFrame, `${prefix}ok\x1b[39m`, 'with color support the green text is wrapped in the ANSI codes');
      t.equal(withColor.greenFrame, withColor.greenFrames.at(-1), 'lastFrame() is the last write: exactly what Ink wrote');
      t.equal(withColor.greenFrame, withColor.greenRendered, 'the same string Ink renders on its own');
      const terminal = await itlProbe({ env: capable, tty: { isTTY: true, columns: 100, rows: 30 } });
      t.equal(terminal.greenFrame, `${prefix}ok\x1b[39m`, 'a color-capable terminal (a TTY with a color TERM) is enough');
      t.equal((await itlProbe({ env: { ...capable, TERM: 'dumb' }, tty: { isTTY: true, columns: 100, rows: 30 } })).greenFrame, 'ok', 'positive control: a dumb terminal gets plain text');
      t.equal((await itlProbe({})).greenFrame, 'ok', 'and so does a process with no terminal and no FORCE_COLOR');
    }),
);

s.fact(F, ['For stable assertions run tests with `FORCE_COLOR=0` or strip ANSI first.'], { kind: 'R' }, async (t, q) => {
  const [variable, value] = q.tok('FORCE_COLOR=0').split('=');
  const terminal = { isTTY: true, columns: 100, rows: 30 };
  const color = await itlProbe({ env: { TERM: 'xterm-256color' }, tty: terminal });
  const off = await itlProbe({ env: { TERM: 'xterm-256color', [variable]: value }, tty: terminal });
  t.ok(color.greenFrame.includes('\x1b['), 'positive control: on a color terminal the frame has escape codes');
  t.equal(off.greenFrame, 'ok', `with ${variable}=${value} the same terminal gives plain text`);
  t.equal(stripAnsi(color.greenFrame), off.greenFrame, 'and stripping the ANSI codes from the colored frame gives that same text');
});

s.guidance(F, ["If a test genuinely needs to verify color was applied, that's a sign to test at a lower level (the component's props) rather than the rendered string."], 'a testing-strategy recommendation, not a statement about behaviour; the environment dependence of the rendered string that motivates it is proven by the claims on the sentences before it');

s.fact(
  F,
  ['The fake `stdout` reports `columns` as `100` but has no `rows` or `isTTY`, so `useWindowSize()` returns 100 columns and a row count taken from the host terminal (else 24).'],
  { kind: 'R' },
  async (t, q) =>
    withLibrary(async () => {
      const [stdoutName, columnsName, rowsName, isTTYName] = [q.tok('stdout'), q.tok('columns'), q.tok('rows'), q.tok('isTTY')];
      const hook = q.api(ink, 'useWindowSize()');
      const app = itl.render(h(Text, null, 'x'));
      const fake = app[stdoutName];
      t.equal(fake[columnsName], Number(q.tok('100')), 'columns is 100');
      t.ok(!(rowsName in fake) && fake[rowsName] === undefined, 'there is no rows');
      t.ok(!(isTTYName in fake) && fake[isTTYName] === undefined, 'and no isTTY');
      t.equal(app.stdin[isTTYName], true, 'positive control: the fake stdin does have an isTTY');
      let seen;
      const Probe = () => {
        seen = hook();
        return h(Text, null, 'p');
      };
      const inProcess = itl.render(h(Probe));
      t.equal(seen[columnsName], Number(q.tok('100')), 'useWindowSize() returns the 100 columns');
      t.equal(inProcess.stdout[columnsName], seen[columnsName], 'the ones the fake stdout reports');
      // the rows come from the process the test runs in
      for (const rows of [30, 41]) {
        const run = await itlProbe({ tty: { isTTY: true, columns: 120, rows } });
        t.deepEqual(run.size, { columns: 100, [rowsName]: rows }, `with a ${rows}-row terminal: 100 columns and ${rows} rows`);
        t.equal(run.hostRows, rows);
      }
      const noTerminal = await itlProbeWithoutTerminal();
      t.equal(noTerminal.hostRows, null, 'in a process with no terminal there is nothing to read');
      t.deepEqual(noTerminal.size, { columns: 100, [rowsName]: Number(q.tok('24')) }, 'the rows are 24');
    }),
);

s.fact(
  F,
  ['That makes `rows`-dependent layouts vary across machines — pass the size into such components as a prop so tests can pin it.'],
  { kind: 'R' },
  async (t, q) => {
    const rows = q.tok('rows');
    const small = await itlProbe({ tty: { isTTY: true, columns: 120, rows: 30 } });
    const large = await itlProbe({ tty: { isTTY: true, columns: 120, rows: 41 } });
    t.equal(small.rowsFrame, `${rows}=30`, 'a component that reads the rows draws 30 on one machine');
    t.equal(large.rowsFrame, `${rows}=41`, 'and 41 on another');
    t.equal(small.pinnedFrame, `${rows}=10`, 'a component given the rows as a prop');
    t.equal(small.pinnedFrame, large.pinnedFrame, 'draws the same on both');
  },
);

// ===================================================================== CI=false

const CI_RUN = (writes) => writes.join('');
s.fact(F, ['`CI=false` for tests that need full interactive rendering'], { kind: 'R' }, async (t, q) => {
  const [variable, value] = q.tok('CI=false').split('=');
  const interactive = await realProbe({ [variable]: value });
  const output = CI_RUN(interactive.writes);
  t.ok(['frame 1', 'frame 2', 'frame 3'].every((frame) => output.includes(frame)), 'with CI=false every frame is drawn');
  t.ok(output.includes('\x1b[2K'), 'each over the previous one (the erase-line sequences are there)');
  t.ok(interactive.writes.includes('\x1b[?25l'), 'with the cursor hidden while the app runs: an interactive session');
  const ci = await realProbe({ [variable]: 'true' });
  t.ok(!CI_RUN(ci.writes).includes('\x1b[?25l') && !CI_RUN(ci.writes).includes('\x1b[2K'), 'positive control: with CI=true none of that happens');
});

s.fact(
  F,
  ['Ink detects `CI` and switches to writing only the final frame instead of continuously overwriting (see `ink-rendering-and-lifecycle`).'],
  { kind: 'R' },
  async (t, q) => {
    const variable = q.tok('CI');
    t.ok(skillText(q.tok('ink-rendering-and-lifecycle')).includes(variable), 'the skill it points to covers it');
    const inCi = await realProbe({ [variable]: 'true' });
    const written = inCi.writes.filter((write) => write.trim());
    t.deepEqual(written, ['frame 3\n'], 'with CI set only the final frame is written, once, at unmount');
    const local = await realProbe({});
    const frames = local.writes.filter((write) => /frame \d/.test(write));
    t.equal(frames.length, 3, 'without it every frame is written');
    t.ok(frames.slice(1).every((frame) => frame.startsWith('\x1b[2K')), 'each one erasing the previous: continuously overwriting');
    t.equal(local.screen, inCi.screen, 'while the screen ends up the same');
  },
);

s.fact(
  F,
  [
    '`frames` accumulates every render regardless of interactive mode, so it makes no difference to `ink-testing-library` tests — it matters when snapshot-testing a real `render()` (not the testing-library one) by spawning the CLI as a subprocess in CI and expecting to see intermediate frames; set `CI=false` in that subprocess\'s environment if the test depends on seeing more than the final frame.',
  ],
  { kind: 'R' },
  async (t, q) => {
    const frames = q.tok('frames');
    const [variable, value] = q.tok('CI=false').split('=');
    const library = q.tok('ink-testing-library');
    t.equal(typeof (await import(library)).render, 'function');
    const environments = [{}, { [variable]: 'true' }, { [variable]: value }];
    const runs = await Promise.all(environments.map((env) => itlProbe({ env })));
    for (const run of runs) t.deepEqual(run[frames], ['frame 1', 'frame 2', 'frame 3'], 'ink-testing-library: every render is in frames, whatever CI is');
    t.deepEqual(runs[0][frames], runs[1][frames], 'the same with CI set and without');
    t.equal(typeof q.api(ink, 'render()'), 'function', 'the real render() is Ink own');
    const [ci, notCi] = [await realProbe({ [variable]: 'true' }), await realProbe({ [variable]: value })];
    const drawn = (probe) => ['frame 1', 'frame 2', 'frame 3'].filter((frame) => probe.writes.join('').includes(frame));
    t.deepEqual(drawn(ci), ['frame 3'], 'a real render() in a subprocess run in CI shows only the final frame');
    t.deepEqual(drawn(notCi), ['frame 1', 'frame 2', 'frame 3'], 'and the intermediate ones once CI=false is set in that subprocess environment');
  },
);
