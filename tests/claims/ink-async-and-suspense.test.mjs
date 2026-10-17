// Claims for skills/patterns/ink-async-and-suspense/SKILL.md.
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import semver from 'semver';
import { skill, ink, React, h, mount, keys, waitFor, fakeStdout, fakeStdin, pkg } from '../lib/index.mjs';
import { runFenceWithRenderOptions, spySpawn, probe, REPORT_PID_AND_WAIT } from './ink-async-and-suspense.helpers.mjs';

const s = skill('ink-async-and-suspense');
const F = 'SKILL.md';
const { Text, Box } = ink;
const PID_LINE = /^\d+$/m;

/** Silence a console method while `work` runs (React warns about the cases below on purpose). */
async function quietly(method, work) {
  const original = console[method];
  console[method] = () => {};
  try {
    return await work();
  } finally {
    console[method] = original;
  }
}

// ===================================================================== description

s.guidance(
  F,
  ['Async data fetching in Ink with React Suspense and the concurrent render option, rendering output from a subprocess, and cleaning up timers/listeners/child processes on unmount.'],
  'the topics the skill covers; each is proven where it is taught below, and the sentence itself asserts nothing about behaviour',
);

s.guidance(
  F,
  ['Use when the user needs to load data asynchronously, run a subprocess and stream its output, or fix a resource leak / "still running after exit" bug.'],
  'a trigger for loading the skill; "still running after exit" is the symptom a user would describe in their own words, not a message the code prints',
  { exempt: ['still running after exit'] },
);

// ===================================================================== Suspense and use()

s.fact(
  F,
  ["`<Suspense>`, `use()` and `React.lazy` behave the same with Ink's default renderer and with `{concurrent: true}`: the fallback shows while the promise is pending, and the content replaces it once the promise has resolved."],
  { kind: 'R', timeout: 30_000 },
  async (t, q) => {
    const Suspense = q.el(React, '<Suspense>');
    const use = q.api(React, 'use()');
    const lazy = React[q.tok('React.lazy').split('.')[1]];
    const [option, value] = q.tok('{concurrent: true}').slice(1, -1).split(': ');
    const concurrent = { [option]: JSON.parse(value) };
    const modes = [
      ['default renderer', {}],
      ['concurrent renderer', concurrent],
    ];
    // the option is the one that switches the renderer: only then is the first frame not yet written
    t.ok(mount(h(Text, null, 'x'), { render: {} }).bytes().includes('x'), 'by default the first frame is written at once');
    t.equal(mount(h(Text, null, 'x'), { render: concurrent }).bytes(), '', `with ${option}: ${value} it is not`);
    for (const [mode, render] of modes) {
      for (const kind of ['use', 'lazy']) {
        let resolve;
        const promise = new Promise((done) => (resolve = done));
        const Content = kind === 'use' ? () => h(Text, null, use(promise)) : lazy(() => promise.then((text) => ({ default: () => h(Text, null, text) })));
        const app = mount(h(Suspense, { fallback: h(Text, null, 'Loading…') }, h(Content)), { render });
        await app.flush();
        t.equal(app.screen(), 'Loading…', `${mode}, ${kind}: the fallback shows while the promise is pending`);
        resolve('ready');
        await waitFor(() => app.screen() === 'ready', { timeout: 5000, message: `${mode}, ${kind}: the content` });
        t.equal(app.screen(), 'ready', `${mode}, ${kind}: and the content replaces it once the promise has resolved`);
      }
    }
  },
);

s.fact(
  F,
  ['What `concurrent: true` changes is when the initial output is written: by default `render()` has written it before it returns, with `concurrent: true` it returns first (see `ink-rendering-and-lifecycle`).'],
  { kind: 'R', ctx: ['ink-rendering-and-lifecycle'] },
  async (t, q) => {
    const render = q.api(ink, 'render()');
    const [option, value] = q.tok('concurrent: true').split(': ');
    const open = (options) => {
      const stdout = fakeStdout();
      const instance = render(h(Text, null, 'hello'), { stdout, stderr: fakeStdout(), stdin: fakeStdin(), patchConsole: false, exitOnCtrlC: false, ...options });
      return { stdout, instance };
    };
    const byDefault = open({});
    t.match(byDefault.stdout.bytes(), /hello/, 'by default the frame is already written when render() returns');
    const concurrent = open({ [option]: JSON.parse(value) });
    t.equal(concurrent.stdout.bytes(), '', 'with concurrent: true render() returns before anything is written');
    await concurrent.instance.waitUntilRenderFlush();
    t.match(concurrent.stdout.bytes(), /hello/, 'the first frame follows');
    byDefault.instance.unmount();
    concurrent.instance.unmount();
  },
);

s.fence(F, 0, {
  run: async (t, fence) => {
    const { apps, writtenOnReturn } = await runFenceWithRenderOptions(fence);
    t.equal(writtenOnReturn[0], '', 'the concurrent option reaches Ink: nothing is written yet when render() returns');
    await apps[0].flush();
    t.equal(apps[0].screen(), 'Hello');
  },
});

s.fact(
  F,
  ["React 19's `use()` hook reads a promise inside a component that's wrapped in `<Suspense>` — pass a **cached** promise: one created anew on every render that takes time to resolve keeps the fallback on screen."],
  { kind: 'R', ctx: ['cached'] },
  async (t, q) => {
    t.equal(semver.major(pkg('react').version), Number(q.tok('19')), 'the React in use');
    const use = q.api(React, 'use()');
    const Suspense = q.el(React, '<Suspense>');
    const boundary = (Content) => h(Suspense, { fallback: h(Text, null, 'Loading…') }, h(Content));
    const cachedPromise = new Promise((resolve) => setTimeout(() => resolve('cached data'), 5));
    const Cached = () => h(Text, null, use(cachedPromise));
    const cached = mount(boundary(Cached));
    await cached.flush();
    await waitFor(() => cached.screen() === 'cached data', { message: 'the cached promise to show its data' });
    t.equal(cached.screen(), 'cached data', 'a cached promise: the content replaces the fallback');
    let renders = 0;
    const Fresh = () => {
      renders++;
      return h(Text, null, use(new Promise((resolve) => setTimeout(() => resolve('fresh data'), 5))));
    };
    const fresh = await quietly('error', async () => {
      const app = mount(boundary(Fresh));
      await waitFor(() => renders >= 20, { message: 'twenty renders' });
      return app;
    });
    t.equal(fresh.screen(), 'Loading…', `a promise created anew on every render: after ${renders} renders the fallback is still there`);
  },
);

s.fence(F, 1, {
  run: async (t, fence) => {
    const { runFence } = await import('../lib/index.mjs');
    const { mod } = await runFence(fence);
    const app = mount(h(mod.Screen));
    t.match(app.bytes(), /Loading…/, 'the fallback is the first thing drawn');
    await waitFor(() => app.screen() === 'loaded data', { message: 'the loaded data' });
    t.equal(app.screen(), 'loaded data', 'and the data replaces it');
  },
});

s.fact(F, ['A single cached promise like this one holds one result for every caller'], { kind: 'R' }, async (t) => {
  const { mod } = await s.runFence(F, 1);
  t.equal(mod.fetchData(), mod.fetchData(), 'every call of fetchData() returns the same promise');
  t.equal(await mod.fetchData(), 'loaded data');
  t.equal(await mod.fetchData(), await mod.fetchData(), 'and so the same result');
});

s.guidance(
  F,
  ['for several requests, request deduplication, caching across renders, or request cancellation, reach for a data-fetching library rather than hand-rolling a cache.'],
  'a recommendation about when to reach for a library; it asserts nothing about behaviour',
);

// ===================================================================== streaming subprocess output

s.fact(
  F,
  ["`child_process.spawn`'s stdout/stderr are Node readable streams — write their chunks into component state to render them as they arrive:"],
  { kind: 'R', timeout: 20_000 },
  async (t, q) => {
    const [, method] = q.tok('child_process.spawn').split('.');
    const spy = spySpawn({ method });
    try {
      const { mod } = await s.runFence(F, 2);
      const app = mount(h(mod.CommandOutput, { command: process.execPath, args: ['-e', REPORT_PID_AND_WAIT] }));
      await waitFor(() => PID_LINE.test(app.screen()), { message: 'the first line of output' });
      const [child] = spy.children;
      t.ok(child.stdout instanceof Readable && child.stderr instanceof Readable, 'stdout and stderr of a spawned process are readable streams');
      t.equal(child.exitCode, null, 'the line is on screen while the process is still running');
      t.equal(app.screen(), String(child.pid), 'and it is what the process wrote');
    } finally {
      spy.restore();
    }
  },
);

s.fact(
  F,
  ['`args` is usually an inline array literal — a new identity every render — so // key the effect on its contents, or the process is killed and re-spawned on // every render.'],
  { kind: 'R', timeout: 20_000 },
  async (t, q) => {
    const argsProp = q.tok('args');
    const spawnsAfterRerenders = async (replace) => {
      const spy = spySpawn();
      try {
        const { mod } = await s.runFence(F, 2, { replace });
        // an inline array literal: a different array, with the same contents, at every render
        const element = () => h(mod.CommandOutput, { command: process.execPath, [argsProp]: ['-e', REPORT_PID_AND_WAIT] });
        const app = mount(element());
        await waitFor(() => PID_LINE.test(app.screen()), { message: 'the first process' });
        for (let i = 0; i < 3; i++) await app.rerender(element());
        return { spy, app };
      } catch (error) {
        spy.restore();
        throw error;
      }
    };
    // as written: three re-renders with the same contents spawn nothing new
    const keyed = await spawnsAfterRerenders();
    try {
      t.equal(keyed.spy.children.length, 1, 'keyed on the contents: one process, however often the component renders');
    } finally {
      keyed.spy.restore();
    }
    // the same fence keyed on the array itself: every render kills the process and starts another
    const unkeyed = await spawnsAfterRerenders([[/\[command, argsKey\]/, '[command, args]']]);
    try {
      await waitFor(() => unkeyed.spy.children.length >= 3, { message: 'a new process for each render' });
      t.ok(unkeyed.spy.children.length >= 3, 'keyed on the array: a new process for the renders');
      await waitFor(() => unkeyed.spy.children[0].killed, { message: 'the first process to be killed' });
      t.equal(unkeyed.spy.children[0].killed, true, 'and the earlier ones are killed');
    } finally {
      unkeyed.spy.restore();
    }
  },
);

s.fact(F, ["One buffer per stream so partial lines from stdout and stderr don't interleave."], { kind: 'R', timeout: 20_000 }, async (t) => {
  // each stream gets half a line, then the other stream does, then both finish: 100 ms apart
  const script = `
    process.stdout.write('out-');
    setTimeout(() => process.stderr.write('err-'), 100);
    setTimeout(() => process.stdout.write('1\\n'), 200);
    setTimeout(() => process.stderr.write('2\\n'), 300);
  `;
  const { mod } = await s.runFence(F, 2);
  const app = mount(h(mod.CommandOutput, { command: process.execPath, args: ['-e', script] }));
  await waitFor(() => app.screen().includes('err-2'), { message: 'both lines' });
  t.deepEqual(app.screen().split('\n'), ['out-1', 'err-2'], 'each line is made of one stream\'s chunks only');
});

s.fact(F, ["Flush each stream's trailing unterminated line once the process is done."], { kind: 'R', timeout: 20_000 }, async (t) => {
  const { mod } = await s.runFence(F, 2);
  const run = async (script) => {
    const app = mount(h(mod.CommandOutput, { command: process.execPath, args: ['-e', script] }));
    await waitFor(() => app.screen().trim() !== '', { message: 'some output' });
    return app;
  };
  const unterminated = await run(`console.log('done'); process.stdout.write('tail'); process.stderr.write('etail')`);
  await waitFor(() => unterminated.screen().includes('etail'), { message: 'the unterminated lines' });
  t.deepEqual(unterminated.screen().split('\n'), ['done', 'tail', 'etail'], 'what the process wrote without a newline still appears, stdout first');
  const terminated = await run(`console.log('only line')`);
  await terminated.flush();
  await waitFor(() => terminated.screen() === 'only line', { message: 'the line' });
  t.equal(terminated.screen(), 'only line', 'and nothing is added when the output ended with a newline');
});

s.fact(
  F,
  ['Without an `error` listener, a failed spawn (e.g. ENOENT) crashes the app.'],
  { kind: 'R', timeout: 60_000 },
  async (t, q) => {
    const event = q.tok('error');
    const missing = 'ink-skills-no-such-command';
    const withListener = await probe('ink-async-and-suspense-spawn', ['with-listener']);
    t.equal(withListener.code, 0, 'as written the app carries on');
    t.equal(withListener.json.screen, `spawn ${missing} ${'ENOENT'}`, 'and the error is the line it shows');
    const without = await probe('ink-async-and-suspense-spawn', ['without-listener']);
    t.equal(without.code, 1, 'with the listener removed the process dies');
    t.match(without.stderr, new RegExp(`Unhandled '${event}' event[\\s\\S]*Error: spawn ${missing} ENOENT`), `from an unhandled '${event}' event`);
  },
);

s.fence(F, 2);

s.fact(
  F,
  ['Interactive children that need the terminal itself (`$EDITOR`, `less`, `fzf`) are different: spawn them with `stdio: \'inherit\'` inside `useApp().suspendTerminal(async () => {…})`, which hands the terminal over and then restores Ink\'s terminal state with a full redraw.'],
  { kind: 'R', ctx: ['$EDITOR', 'less', 'fzf'], timeout: 60_000 },
  async (t, q) => {
    const useApp = q.api(ink, "useApp().suspendTerminal(async () => {…})");
    const method = q.tok("useApp().suspendTerminal(async () => {…})").match(/^useApp\(\)\.(\w+)\(/)[1];
    const stdio = q.tok("stdio: 'inherit'").split(': ')[1].replace(/'/g, '');
    // the terminal is handed over: raw mode off, Ink's frame erased, nothing drawn meanwhile ...
    let hooks;
    const App = () => {
      hooks = useApp();
      ink.useInput(() => {});
      return h(Text, null, 'frame');
    };
    const app = mount(h(App));
    await app.flush();
    t.deepEqual(app.stdin.rawModeCalls, [true], 'while the app owns the terminal its input is in raw mode');
    const before = app.bytes().length;
    let during;
    let finish;
    const suspended = hooks[method](async () => {
      during = { raw: [...app.stdin.rawModeCalls], written: app.bytes().slice(before) };
      await new Promise((resolve) => (finish = resolve));
    });
    await waitFor(() => during, { message: 'the callback to start' });
    t.deepEqual(during.raw, [true, false], 'raw mode is off while the callback runs');
    t.equal(during.written, '\x1b[2K\x1b[1A\x1b[2K\x1b[G\x1b[?25h', 'Ink has erased its frame and shown the cursor');
    // ... and taken back afterwards, with the whole frame drawn again
    finish();
    await suspended;
    t.deepEqual(app.stdin.rawModeCalls, [true, false, true], 'raw mode is back on afterwards');
    t.match(app.bytes().slice(before + during.written.length), /frame/, 'and the full frame is drawn again');
    // with stdio 'inherit' the child writes to the very stdout Ink draws on, between the erase and the redraw
    const inherit = await probe('ink-async-and-suspense-suspend', [stdio]);
    t.match(inherit.stdout, /phase before[\s\S]*\x1b\[2K\x1b\[1A\x1b\[2K\x1b\[G\x1b\[\?25hFROM CHILD\n[\s\S]*phase before[\s\S]*phase after/, 'its output lands between the erase and the redraw');
    const piped = await probe('ink-async-and-suspense-suspend', ['pipe']);
    t.doesNotMatch(piped.stdout.split('\n{')[0], /FROM CHILD/, 'with the default stdio it does not reach that stdout ...');
    t.equal(piped.json.piped, 'FROM CHILD\n', '... it goes to a pipe instead');
  },
);

s.fact(
  F,
  ['For output that is append-only and never revisited, `<Static>` (see `ink-static-output`) is an alternative to plain state: it writes each line once and does not render the earlier lines again as the list grows.'],
  { kind: 'R', ctx: ['ink-static-output'] },
  async (t, q) => {
    const Static = q.el(ink, '<Static>');
    const lines = ['alpha', 'beta', 'gamma'];
    const grow = async (view) => {
      const shown = [];
      let renders = 0;
      const app = mount(view(shown, () => renders++));
      for (const line of lines) {
        shown.push(line);
        await app.rerender(view(shown, () => renders++));
      }
      const written = (needle) => app.bytes().split(needle).length - 1;
      return { renders, written: lines.map(written) };
    };
    const asStatic = await grow((shown, count) => h(Static, { items: [...shown] }, (line) => (count(), h(Text, { key: line }, line))));
    t.deepEqual(asStatic.written, [1, 1, 1], '<Static> writes every line once');
    t.equal(asStatic.renders, lines.length, 'and renders each line once');
    const asState = await grow((shown, count) => h(Box, { flexDirection: 'column' }, ...shown.map((line) => (count(), h(Text, { key: line }, line)))));
    t.deepEqual(asState.written, [3, 2, 1], 'plain state writes the earlier lines again with every update');
    t.equal(asState.renders, 1 + 2 + 3, 'and renders them all again');
  },
);

// ===================================================================== cleanup on unmount

s.fact(
  F,
  ['The `useEffect` return function above (`child.kill()`, removing listeners) is the general pattern for anything that outlives a single render: timers, event listeners, child processes.'],
  { kind: 'R', timeout: 60_000 },
  async (t, q) => {
    q.api(React, 'useEffect');
    const killName = q.tok('child.kill()').split('.')[1].replace('()', '');
    // the fence's own cleanup: the child is killed and every listener is taken off
    const spy = spySpawn({ watch: killName });
    try {
      const { mod } = await s.runFence(F, 2);
      const app = mount(h(mod.CommandOutput, { command: process.execPath, args: ['-e', REPORT_PID_AND_WAIT] }));
      await waitFor(() => PID_LINE.test(app.screen()), { message: 'the process to report' });
      const [child] = spy.children;
      const listeners = () => [child.stdout.listenerCount('data'), child.stderr.listenerCount('data'), child.listenerCount('close'), child.listenerCount('error')];
      t.deepEqual(listeners(), [1, 1, 1, 1], 'while mounted, the component listens to the process');
      await app.unmount();
      t.deepEqual(spy.calls, [killName], 'unmounting kills the process');
      t.deepEqual(listeners(), [0, 0, 0, 0], 'and takes every listener off');
    } finally {
      spy.restore();
    }
    // an event listener without a cleanup stays on its emitter after the component is gone
    const listen = async (cleanup) => {
      const emitter = new EventEmitter();
      const Listener = () => {
        React.useEffect(() => {
          const onTick = () => {};
          emitter.on('tick', onTick);
          return cleanup ? () => emitter.off('tick', onTick) : undefined;
        }, []);
        return h(Text, null, 'listening');
      };
      const app = mount(h(Listener));
      await app.flush();
      await waitFor(() => emitter.listenerCount('tick') === 1, { message: 'the listener' });
      await app.unmount();
      return emitter.listenerCount('tick');
    };
    t.equal(await listen(true), 0, 'a listener removed in the cleanup is gone after unmount');
    t.equal(await listen(false), 1, 'one that is not removed is still attached');
    // a timer and a child process left running keep a real process alive: see the claim below
  },
);

s.fact(
  F,
  ["**Skipping this leaves an Ink CLI that doesn't exit** — a live subprocess or an active timer keeps the Node event loop occupied even after the component tree unmounts (see `ink-rendering-and-lifecycle`'s process model)."],
  { kind: 'R', ctx: ["Skipping this leaves an Ink CLI that doesn't exit", 'ink-rendering-and-lifecycle'], timeout: 60_000 },
  async (t) => {
    // a leak is only proven if the process is still there when the parent stops waiting, after the app has unmounted
    const stillThere = { signal: 'SIGTERM', killAfter: 3000 };
    const [timerLeak, subprocessLeak, timerClean, subprocessClean] = await Promise.all([
      probe('ink-async-and-suspense-lifecycle', ['timer-leak'], stillThere),
      probe('ink-async-and-suspense-lifecycle', ['subprocess-leak'], stillThere),
      probe('ink-async-and-suspense-lifecycle', ['timer-clean']),
      probe('ink-async-and-suspense-lifecycle', ['subprocess-clean']),
    ]);
    for (const [what, run] of [['an active timer', timerLeak], ['a live subprocess', subprocessLeak]]) {
      t.equal(run.json?.unmounted, true, `${what}: the app had unmounted`);
      t.equal(run.signal, 'SIGTERM', `${what}: and the process was still running when it was stopped`);
    }
    for (const [what, run] of [['a timer cleared in the cleanup', timerClean], ['a subprocess killed in the cleanup', subprocessClean]]) {
      t.equal(run.json?.unmounted, true, `${what}: the app unmounted`);
      t.deepEqual([run.code, run.signal], [0, null], `${what}: and the process ended by itself`);
    }
  },
);

s.fact(
  F,
  ["Ink releases a `useInput` handler's stdin listener and raw mode itself when the tree unmounts, so a process that stays alive afterwards is held by something of your own: check for exactly this."],
  { kind: 'R', timeout: 60_000 },
  async (t, q) => {
    const useInput = q.api(ink, 'useInput');
    const Input = () => {
      useInput(() => {});
      return h(Text, null, 'listening');
    };
    const app = mount(h(Input));
    await app.flush();
    t.deepEqual(app.stdin.rawModeCalls, [true], 'a mounted handler holds stdin in raw mode');
    t.equal(app.stdin.listenerCount('readable'), 1, 'and listens to it');
    await app.unmount();
    t.deepEqual(app.stdin.rawModeCalls, [true, false], 'unmounting puts raw mode back');
    t.equal(app.stdin.listenerCount('readable'), 0, 'and takes the listener off');
    // a whole process: with only a useInput handler mounted it ends by itself once the app has unmounted
    const input = await probe('ink-async-and-suspense-lifecycle', ['input-clean']);
    t.deepEqual([input.json?.unmounted, input.code, input.signal], [true, 0, null], 'the process ends by itself');
  },
);
