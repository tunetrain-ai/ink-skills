// Claims for skills/ecosystem/interaction/ink-task-runners/SKILL.md.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import semver from 'semver';
import { skill, tsx, ink, React, h, mount, waitFor, runFence, runExternal, extPkg, extPackageDir, extReadFile, stripAnsi, pkg, packageDir } from '../lib/index.mjs';
import { emptyFile, fakeNpm, glyphs, signalRun, stdinRun, withEndableStdin } from './ink-task-runners.helpers.mjs';

const s = skill('ink-task-runners');
const F = 'SKILL.md';
const { Text } = ink;
const SPINNER = /[⠀-⣿]/;
const onWindows = process.platform === 'win32';

/** The Ink output of an element, SGR removed. */
const draw = (element, columns = 60) => stripAnsi(ink.renderToString(element, { columns }));

/** The lines of an app's screen that report a Spawn's status, with the spinner frame replaced. */
const statuses = (app) =>
  app
    .screen()
    .split('\n')
    .filter((line) => /(Running|Ran|Failed to run) '/.test(line))
    .map((line) => line.replace(SPINNER, '…'));

/** The lines of a bordered output box on the screen. */
const boxed = (app) => app.screen().split('\n').filter((line) => line.startsWith('│')).map((line) => line.replace(/^│\s*|\s*│$/g, ''));

// commands are mounted 400 columns wide: the path of this Node would otherwise wrap the status line
/** A fact whose body runs a <Spawn> in this process: see withEndableStdin. */
const spawnFact = (file, quotes, opts, fn) => s.fact(file, quotes, opts, (t, q) => withEndableStdin(() => fn(t, q)));

const NODE = process.execPath;
/** A node command that prints `text` and then stays alive. */
const printAndWait = (text, newline) => [NODE, ['-e', `process.stdout.write(${JSON.stringify(text)}${newline ? " + '\\n'" : ''}); setInterval(() => {}, 1000)`]];

// ===================================================================== description

s.guidance(
  F,
  ['Task-list UIs with per-step status (ink-task-list) and composing and running child processes with live status (ink-spawn).'],
  'the topics the skill covers; each is proven where it is taught below, and the sentence itself asserts nothing about behaviour',
);

s.guidance(F, ['Use when the user wants a live list of tasks, each with its own status, or needs to spawn and display subprocess output with status;'], 'a trigger for loading the skill; it asserts nothing about behaviour');

// ===================================================================== ink-task-list

s.fence(F, 0, {
  run: async (t, fence) => {
    const { apps } = await runFence(fence, { mountOptions: { columns: 60, rows: 30 } });
    await apps[0].flush();
    const lines = apps[0].screen().split('\n');
    const shown = lines.map((line) => line.replace(SPINNER, '…'));
    if (onWindows) return t.equal(shown.length, 7);
    t.deepEqual(shown, ['◼ Pending', '… Installing', '✔ Built', '⚠ Deprecated flag', '✖ Tests failed', '❯ Nested step', '  … Sub-step'], 'one line per task, the nested one indented under the expanded task');
  },
});

s.fact(F, ["`state`: `'pending' | 'loading' | 'success' | 'warning' | 'error'`."], { kind: 'D' }, async (t, q) => {
  const { Task, TaskList } = await import('ink-task-list');
  const stateProp = q.tok('state');
  const states = q.tok("'pending' | 'loading' | 'success' | 'warning' | 'error'").split(' | ').map((name) => name.replace(/'/g, ''));
  const spinner = { interval: 1000, frames: ['*'] };
  const lineOf = (props) => draw(h(TaskList, null, h(Task, { label: 'x', spinner, ...props }))).split('\n')[0];
  const drawn = states.map((state) => lineOf({ [stateProp]: state }));
  t.equal(new Set(drawn).size, states.length, 'each state draws something of its own');
  t.equal(lineOf({}), lineOf({ [stateProp]: 'pending' }), 'and a task without a state is pending');
  if (!onWindows) t.deepEqual(drawn, ['◼ x', '* x', '✔ x', '⚠ x', '✖ x'], 'a square, the spinner, a tick, a warning sign, a cross');
});

s.types(
  F,
  ["`state`: `'pending' | 'loading' | 'success' | 'warning' | 'error'`."],
  tsx`
import React from 'react';
import {Task} from 'ink-task-list';
import spinners from 'cli-spinners';

type States = 'pending' | 'loading' | 'success' | 'warning' | 'error';
type Accepted = NonNullable<React.ComponentProps<typeof Task>['state']>;
export const everyStateIsAccepted: States extends Accepted ? true : false = true;
export const nothingElseIsAccepted: Accepted extends States ? true : false = true;

export const pending = <Task label="a" state="pending" />;
export const loading = <Task label="b" state="loading" spinner={spinners.dots} />;
export const success = <Task label="c" state="success" />;
export const warning = <Task label="d" state="warning" />;
export const error = <Task label="e" state="error" />;
export const unknown = <Task label="f" state="done" />; //! TS2322
`,
);

s.fact(
  F,
  ['**`state="loading"` requires a `spinner`** (`{interval, frames}` — the shape of a [`cli-spinners`](https://github.com/sindresorhus/cli-spinners) entry); the types reject it without one.'],
  { kind: 'R', ctx: ['`state="loading"` requires a `spinner`'] },
  async (t, q) => {
    const { Task, TaskList } = await import('ink-task-list');
    const [stateProp, stateValue] = q.tok('state="loading"').split('=');
    const loading = { [stateProp]: JSON.parse(stateValue) };
    const spinnerProp = q.tok('spinner');
    const [interval, frames] = q.tok('{interval, frames}').slice(1, -1).split(', ');
    const { default: spinners } = await import(q.tok('cli-spinners'));
    // a cli-spinners entry has that shape
    t.deepEqual(Object.keys(spinners.dots).sort(), [frames, interval].sort(), 'a cli-spinners entry is {interval, frames}');
    t.equal(typeof spinners.dots[interval], 'number');
    t.ok(Array.isArray(spinners.dots[frames]));
    // without a spinner a loading task cannot be drawn
    t.throws(() => draw(h(TaskList, null, h(Task, { label: 'x', ...loading }))), /Cannot read properties of undefined \(reading 'frames'\)/, 'a loading task without a spinner throws when it is drawn');
    t.match(draw(h(TaskList, null, h(Task, { label: 'x', ...loading, [spinnerProp]: spinners.dots }))), new RegExp(`^${SPINNER.source} x$`), 'and with one it shows a frame of it');
    // any {interval, frames} works, and it is what animates
    const own = { [interval]: 5, [frames]: ['a', 'b'] };
    const app = mount(h(TaskList, null, h(Task, { label: 'x', ...loading, [spinnerProp]: own })), { columns: 20 });
    await waitFor(() => app.screen() === 'a x', { message: 'the first frame' });
    await waitFor(() => app.screen() === 'b x', { message: 'the second frame' });
    t.equal(app.screen(), 'b x', 'the frames follow one another');
  },
);

s.types(
  F,
  ['**`state="loading"` requires a `spinner`** (`{interval, frames}` — the shape of a [`cli-spinners`](https://github.com/sindresorhus/cli-spinners) entry); the types reject it without one.'],
  tsx`
import React from 'react';
import {Task} from 'ink-task-list';
import spinners from 'cli-spinners';

export const withSpinner = <Task label="a" state="loading" spinner={spinners.dots} />;
export const ownSpinner = <Task label="b" state="loading" spinner={{interval: 80, frames: ['-', '|']}} />;
export const withoutSpinner = <Task label="c" state="loading" />; //! TS2322
export const missingInterval = <Task label="d" state="loading" spinner={{frames: ['-']}} />; //! TS2741
export const spinnerOnAnyState = <Task label="e" state="success" spinner={spinners.dots} />;
export const noState = <Task label="f" />;
`,
  { ctx: ['`state="loading"` requires a `spinner`', '{interval, frames}'] },
);

s.fact(
  F,
  ['`Task` also takes `status` and `output` strings — `status` renders in brackets after the label (`✔ Build [3/10]`) and `output` as an indented `→ …` line below it — and nested `Task` children for a sub-step breakdown, shown when `isExpanded` (an expanded task shows `❯` in place of its state glyph).'],
  { kind: 'R' },
  async (t, q) => {
    const { Task, TaskList } = await import('ink-task-list');
    const Row = q.api({ Task }, 'Task');
    const [statusProp, outputProp, expandedProp] = [q.tok('status'), q.tok('output'), q.tok('isExpanded')];
    const [glyph, label, bracketed] = q.tok('✔ Build [3/10]').split(' ');
    const [arrow] = q.tok('→ …').split(' ');
    const pointer = q.tok('❯');
    const lines = (...tasks) => draw(h(TaskList, null, ...tasks)).split('\n');
    // status: in brackets after the label
    t.deepEqual(lines(h(Row, { label, state: 'success', [statusProp]: bracketed.slice(1, -1) })), [`${glyph} ${label} ${bracketed}`], 'a status follows the label in brackets');
    t.deepEqual(lines(h(Row, { label, state: 'success' })), [`${glyph} ${label}`], 'and without one there are none');
    // output: an indented line below, with an arrow
    t.deepEqual(lines(h(Row, { label: 'Lint', [outputProp]: 'warning: x' })), [`${onWindows ? '■' : '◼'} Lint`, `  ${arrow} warning: x`], 'output is a line below the task, indented, behind an arrow');
    // children: only when expanded
    const child = h(Row, { key: 'child', label: 'Child' });
    t.deepEqual(lines(h(Row, { label: 'Parent' }, child)), [`${onWindows ? '■' : '◼'} Parent`], 'sub-steps of a task that is not expanded are not shown');
    t.deepEqual(lines(h(Row, { label: 'Parent', [expandedProp]: true }, child)), [`${pointer} Parent`, `  ${onWindows ? '■' : '◼'} Child`], 'an expanded task shows them, indented, and a pointer instead of its state glyph');
    t.deepEqual(lines(h(Row, { label: 'Parent', state: 'error', [expandedProp]: true }, child))[0], `${pointer} Parent`, 'whatever its state');
  },
);

s.fact(
  F,
  ['Peer `ink >=3.0.0` covers Ink 8, and it renders there (`✔ Built`, `◼ Pending`, an animated spinner for `loading`).'],
  { kind: 'P', timeout: 20_000 },
  async (t, q) => {
    const [peer, range] = q.tok('ink >=3.0.0').split(' ');
    t.equal(pkg('ink-task-list').peerDependencies[peer], range, 'its peer range for Ink');
    t.equal(semver.major(pkg('ink').version), Number(q.tok('8')), 'the Ink in use');
    t.ok(semver.satisfies(pkg('ink').version, range), 'is covered by it');
    const [successGlyph, successLabel] = q.tok('✔ Built').split(' ');
    const [pendingGlyph, pendingLabel] = q.tok('◼ Pending').split(' ');
    const drawn = await glyphs({}, [successLabel, pendingLabel]);
    if (!onWindows) {
      t.equal(drawn.success, q.tok('✔ Built'), 'a finished task draws a tick before its label');
      t.equal(drawn.pending, q.tok('◼ Pending'), 'a pending one a square');
    }
    t.ok(drawn.success.startsWith(successGlyph) && drawn.pending.startsWith(pendingGlyph));
    // the spinner of a loading task moves
    const { Task, TaskList } = await import('ink-task-list');
    const loading = q.tok('loading');
    const app = mount(h(TaskList, null, h(Task, { label: 'x', state: loading, spinner: { interval: 5, frames: ['a', 'b'] } })), { columns: 20 });
    const seen = new Set();
    await waitFor(() => (seen.add(app.screen()), seen.size >= 2), { message: 'two frames' });
    t.deepEqual([...seen].sort(), ['a x', 'b x'], 'a loading task animates its spinner');
  },
);

s.fact(
  F,
  ['Outside Windows the glyphs are Unicode unless `TERM` is `linux`, where it draws `√ Built` and `■ Pending`.'],
  { kind: 'R', timeout: 30_000 },
  async (t, q) => {
    const term = q.tok('TERM');
    const linux = q.tok('linux');
    const [successGlyph, successLabel] = q.tok('√ Built').split(' ');
    const [pendingGlyph, pendingLabel] = q.tok('■ Pending').split(' ');
    const labels = [successLabel, pendingLabel];
    if (onWindows) {
      t.match(readFileSync(join(packageDir('ink-task-list'), 'dist', 'index.mjs'), 'utf8'), /"win32"/, 'on Windows another rule decides');
      return;
    }
    const fallback = await glyphs({ [term]: linux }, labels);
    t.equal(fallback.success, `${successGlyph} ${successLabel}`, 'on the Linux console a finished task is a check mark without the heavy stroke');
    t.equal(fallback.pending, `${pendingGlyph} ${pendingLabel}`);
    t.deepEqual([fallback.warning, fallback.error, fallback.expanded], ['‼ x', '× x', '> x'], 'and the others are plain too');
    const unicode = await glyphs({ [term]: 'xterm-256color' }, labels);
    t.deepEqual([unicode.success, unicode.pending], [`✔ ${successLabel}`, `◼ ${pendingLabel}`], 'in any other terminal it is Unicode');
    t.notEqual(unicode.success, fallback.success);
    t.equal((await glyphs({}, labels)).success, unicode.success, 'which is also what no TERM at all gives');
    t.equal(fallback.output, unicode.output, 'only the state glyphs differ: the arrow of an output line stays');
  },
);

s.fact(
  F,
  ['`<Static>` (`ink-static-output`) writes each item once and never updates it, so it fits items that are done the moment they appear; `ink-task-list` redraws a `Task` in place when its `state` changes.'],
  { kind: 'R', ctx: ['ink-static-output'] },
  async (t, q) => {
    const Static = q.el(ink, '<Static>');
    const { Task, TaskList } = await import(pkg(q.tok('ink-task-list')).name);
    q.api({ Task }, 'Task');
    const stateProp = q.tok('state');
    // a Static item is printed once: changing it afterwards changes nothing on screen
    const items = (text) => [{ id: 1, text }];
    const view = (text) => h(Static, { items: items(text) }, (item) => h(Text, { key: item.id }, item.text));
    const fixed = mount(view('pending'), { columns: 40 });
    await fixed.flush();
    await fixed.rerender(view('done'));
    t.equal(fixed.screen(), 'pending', 'an item already printed stays as it was printed');
    t.equal(fixed.bytes().includes('done'), false, 'and the new text is never written');
    // a Task is redrawn where it is
    const row = (state) => h(TaskList, null, h(Task, { label: 'step', [stateProp]: state }));
    const live = mount(row('pending'), { columns: 40 });
    await live.flush();
    t.equal(live.screen(), `${onWindows ? '■' : '◼'} step`);
    await live.rerender(row('success'));
    t.equal(live.screen(), `${onWindows ? '√' : '✔'} step`, 'a task whose state changes is drawn again on the same line');
  },
);

// ===================================================================== ink-spawn

s.fence(F, 1, {
  run: (t, fence) => withEndableStdin(async () => {
    // `npm` is a stand-in that finishes a command only when the test says so
    const npm = fakeNpm();
    try {
      const { mod } = await runFence(fence);
      const app = mount(h(mod.App), { columns: 60, rows: 30 });
      await waitFor(() => npm.started('lint'), { message: 'lint to start' });
      await waitFor(() => statuses(app).length === 1, { message: 'its line' });
      t.deepEqual(statuses(app), ["… Running 'npm run lint'"], 'first only lint runs and shows');
      t.match(app.screen(), /Running build steps/);
      npm.release('lint');
      await waitFor(() => npm.started('test') && npm.started('typecheck'), { message: 'test and typecheck to start together' });
      await waitFor(() => statuses(app).length === 3, { message: 'their lines' });
      t.deepEqual(statuses(app), ["✔ Ran 'npm run lint'", "… Running 'npm run test'", "… Running 'npm run typecheck'"], 'then test and typecheck run side by side, neither waiting for the other');
      npm.release('test');
      await waitFor(() => statuses(app)[1] === "✔ Ran 'npm run test'", { message: 'test to finish' });
      t.equal(npm.started('build'), false, 'build waits for typecheck as well');
      t.deepEqual(statuses(app), ["✔ Ran 'npm run lint'", "✔ Ran 'npm run test'", "… Running 'npm run typecheck'"], 'and is not shown yet');
      npm.release('typecheck');
      await waitFor(() => npm.started('build'), { message: 'build to start' });
      npm.release('build');
      await waitFor(() => statuses(app).length === 4 && statuses(app).every((line) => line.startsWith('✔')), { message: 'all four to finish' });
      t.deepEqual(statuses(app), ["✔ Ran 'npm run lint'", "✔ Ran 'npm run test'", "✔ Ran 'npm run typecheck'", "✔ Ran 'npm run build'"], 'in the end every step shows as done');
      t.match(app.screen(), /Done/);
    } finally {
      npm.restore();
    }
  }),
});

spawnFact(F, ['`<Spawn>` starts its process on mount and does not stop it on unmount.'], { kind: 'R', timeout: 20_000 }, async (t, q) => {
  const { Spawn, useSpawn } = await import('ink-spawn');
  const Component = q.el({ Spawn }, '<Spawn>');
  const { spySpawn } = await import('./ink-async-and-suspense.helpers.mjs');
  const spy = spySpawn({ watch: 'kill' });
  try {
    const [command, args] = printAndWait('up', true);
    const app = mount(h(Component, { command, args }), { columns: 400 });
    t.equal(spy.children.length, 1, 'mounting starts the process');
    await waitFor(() => boxed(app).includes('up'), { message: 'the process to be running' });
    await app.unmount();
    const [child] = spy.children;
    t.deepEqual(spy.calls, [], 'unmounting kills nothing');
    t.equal(child.killed, false, 'no signal was sent');
    t.equal(child.exitCode, null, 'the process is still running');
    // control: the hook it is built on does return the way to stop it
    let stop;
    const Runner = () => {
      const { spawn } = useSpawn();
      React.useEffect(() => {
        stop = spawn(command, args);
      }, []);
      return h(Text, null, 'runner');
    };
    const runner = mount(h(Runner));
    await runner.flush();
    stop();
    t.deepEqual(spy.calls, ['kill'], 'a kill is seen by the spy when one is made');
    t.equal(spy.children[1].killed, true);
    process.kill(child.pid); // the process left running above
  } finally {
    spy.restore();
  }
});

spawnFact(
  F,
  ['It shows a status (running, succeeded or failed); while running it also shows the tail of the output — at most `maxOutputLines` lines, 5 by default, the empty line after a final newline included — and after a failure the stderr.'],
  { kind: 'D', timeout: 20_000 },
  async (t, q) => {
    const { Spawn } = await import('ink-spawn');
    const limit = q.tok('maxOutputLines');
    const byDefault = Number(q.tok('5'));
    const eight = Array.from({ length: 8 }, (_, i) => `line ${i + 1}`).join('\n');
    const running = async (text, newline, props = {}) => {
      const [command, args] = printAndWait(text, newline);
      const app = mount(h(Spawn, { command, args, ...props }), { columns: 400 });
      await waitFor(() => boxed(app).some((line) => line.startsWith('line 8')), { message: 'the output' });
      return app;
    };
    // running: a spinner, the command, the tail of the output
    const unterminated = await running(eight, false);
    t.match(unterminated.screen(), new RegExp(`^${SPINNER.source} Running '`), 'while running it says so');
    t.deepEqual(boxed(unterminated), eight.split('\n').slice(-byDefault), 'the last 5 lines of the output, by default');
    const terminated = await running(eight, true);
    t.deepEqual(boxed(terminated), eight.split('\n').slice(-(byDefault - 1)), 'one fewer when the output ends with a newline: the empty line after it takes a place');
    const two = await running(eight, false, { [limit]: 2 });
    t.deepEqual(boxed(two), ['line 7', 'line 8'], 'maxOutputLines changes how many');
    // succeeded: the status only
    const done = mount(h(Spawn, { command: NODE, args: ['-e', "console.log('all good')"] }), { columns: 400 });
    await waitFor(() => /Ran '/.test(done.screen()), { message: 'the process to finish' });
    t.match(done.screen(), /^✔ Ran '/, 'a process that succeeded shows a tick');
    t.deepEqual(boxed(done), [], 'and no output');
    // failed: the status and the stderr
    const saved = process.exitCode;
    try {
      const failed = mount(h(Spawn, { command: NODE, args: ['-e', "console.log('stdout text'); console.error('stderr text'); process.exit(1)"] }), { columns: 400 });
      await waitFor(() => /Failed to run '/.test(failed.screen()), { message: 'the process to fail' });
      t.match(failed.screen(), /^✗ Failed to run '/, 'a process that failed shows a cross');
      t.deepEqual(boxed(failed), ['stderr text'], 'and what it wrote to stderr, not to stdout');
    } finally {
      process.exitCode = saved;
    }
  },
);

spawnFact(F, ["A failure sets `process.exitCode` to the process's exit code."], { kind: 'R', timeout: 20_000 }, async (t, q) => {
  const { Spawn } = await import('ink-spawn');
  const property = q.tok('process.exitCode').split('.')[1];
  const saved = process[property];
  try {
    process[property] = undefined;
    const ok = mount(h(Spawn, { command: NODE, args: ['-e', 'process.exit(0)'] }), { columns: 400 });
    await waitFor(() => /Ran '/.test(ok.screen()), { message: 'the process to succeed' });
    t.equal(process[property], undefined, 'a process that succeeds leaves it alone');
    const failing = mount(h(Spawn, { command: NODE, args: ['-e', 'process.exit(7)'] }), { columns: 400 });
    await waitFor(() => /Failed to run '/.test(failing.screen()), { message: 'the process to fail' });
    t.equal(process[property], 7, 'one that fails with 7 makes it 7');
  } finally {
    process[property] = saved;
  }
});

s.fact(
  F,
  ['`<Spawn>` forwards `SIGINT` and `SIGTERM` received by the Node process to its process, and sends it `SIGTERM` when the Node process exits.'],
  { kind: 'R', timeout: 90_000 },
  async (t, q) => {
    const { Spawn } = await import('ink-spawn');
    q.el({ Spawn }, '<Spawn>');
    const [first, second] = [q.tok('SIGINT'), q.tok('SIGTERM')];
    const interrupted = await signalRun('wait', first);
    t.equal(interrupted.received, first, 'a SIGINT sent to the Node process reaches the command as SIGINT');
    t.equal(interrupted.code, 0, 'and the app ends normally once the command has');
    const terminated = await signalRun('wait', second);
    t.equal(terminated.received, second, 'a SIGTERM reaches it as SIGTERM');
    const exited = await signalRun('exit');
    t.equal(exited.received, second, 'when the Node process exits, the command gets a SIGTERM');
  },
);

s.fact(
  F,
  ['`<Spawn>` crashes the Node process with `TypeError: dest.end is not a function` when stdin is a file or `/dev/null`; with a pipe it is fine.'],
  { kind: 'R', timeout: 60_000 },
  async (t, q) => {
    const { Spawn } = await import('ink-spawn');
    q.el({ Spawn }, '<Spawn>');
    const message = q.tok('TypeError: dest.end is not a function');
    const devNull = q.tok('/dev/null');
    const outcome = (run) => [run.code, run.stderr.includes(message), run.stdout.includes('finished')];
    const pipe = await stdinRun('pipe');
    t.match(pipe.stdout, /stdin is a Socket/);
    t.deepEqual(outcome(pipe), [0, false, true], 'with stdin a pipe the app runs the command and finishes');
    const nothing = await stdinRun(devNull);
    t.match(nothing.stdout, /stdin is a ReadStream/);
    t.deepEqual(outcome(nothing), [1, true, false], 'with stdin /dev/null the process dies of that error');
    const file = await stdinRun(emptyFile());
    t.match(file.stdout, /stdin is a ReadStream/);
    t.deepEqual(outcome(file), [1, true, false], 'and so it does with a file');
  },
);

spawnFact(
  F,
  ['A finished `<Spawn command="echo" args={[\'hi\']} />` renders `✔ Ran \'echo hi\'`.'],
  { kind: 'R', timeout: 20_000 },
  async (t, q) => {
    const { Spawn } = await import('ink-spawn');
    const source = q.tok('<Spawn command="echo" args={[\'hi\']} />');
    const command = source.match(/command="([^"]*)"/)[1];
    const args = JSON.parse(source.match(/args=\{(.*)\}/)[1].replace(/'/g, '"'));
    const app = mount(h(Spawn, { command, args }), { columns: 60 });
    await waitFor(() => /Ran '/.test(app.screen()), { message: 'the command to finish' });
    t.equal(app.screen(), q.tok("✔ Ran 'echo hi'"));
  },
);

spawnFact(
  F,
  ['`<Script>` composes multiple `<Spawn>`/`<Script>` children — sequential by default (renders only completed steps plus the currently running one), or `parallel` to run all children at once.'],
  { kind: 'R', timeout: 30_000 },
  async (t, q) => {
    const { Script, Spawn } = await import('ink-spawn');
    const Group = q.el({ Script }, '<Script>');
    const Step = q.el({ Spawn }, '<Spawn>');
    const parallel = q.tok('parallel');
    const npm = fakeNpm();
    try {
      const step = (name) => h(Step, { key: name, command: 'npm', args: ['run', name] });
      const sequential = mount(h(Group, null, step('one'), step('two'), step('three')), { columns: 60 });
      await waitFor(() => npm.started('one'), { message: 'the first step' });
      t.deepEqual(statuses(sequential), ["… Running 'npm run one'"], 'by default only the first step is there, and the others have not started');
      t.equal(npm.started('two'), false);
      npm.release('one');
      await waitFor(() => npm.started('two'), { message: 'the second step' });
      await waitFor(() => statuses(sequential).length === 2, { message: 'its line' });
      t.deepEqual(statuses(sequential), ["✔ Ran 'npm run one'", "… Running 'npm run two'"], 'the finished one stays, the running one is added, the rest wait');
      t.equal(npm.started('three'), false);
      npm.release('two');
      await waitFor(() => npm.started('three'));
      npm.release('three');
      await waitFor(() => statuses(sequential).length === 3 && statuses(sequential).every((line) => line.startsWith('✔')), { message: 'all three' });
      // parallel: all of them are running before any one finishes
      const side = mount(h(Group, { [parallel]: true }, step('a'), step('b'), step('c')), { columns: 60 });
      await waitFor(() => npm.started('a') && npm.started('b') && npm.started('c'), { message: 'all three started with none finished' });
      await waitFor(() => statuses(side).length === 3, { message: 'three lines' });
      t.deepEqual(statuses(side), ["… Running 'npm run a'", "… Running 'npm run b'", "… Running 'npm run c'"], 'with parallel all children run at once');
      for (const name of ['a', 'b', 'c']) npm.release(name);
    } finally {
      npm.restore();
    }
  },
);

spawnFact(F, ['Scripts nest (parallel inside sequential inside parallel...),'], { kind: 'R', timeout: 30_000 }, async (t) => {
  const { Script, Spawn } = await import('ink-spawn');
  const npm = fakeNpm();
  try {
    const step = (name) => h(Spawn, { key: name, command: 'npm', args: ['run', name] });
    // parallel [ a, sequential [ b, parallel [ c, d ] ] ]
    const app = mount(
      h(Script, { parallel: true }, step('a'), h(Script, { key: 'inner' }, step('b'), h(Script, { parallel: true }, step('c'), step('d')))),
      { columns: 60 },
    );
    await waitFor(() => npm.started('a') && npm.started('b'), { message: 'a and b to start together' });
    t.equal(npm.started('c') || npm.started('d'), false, 'c and d wait for b, inside the sequence');
    npm.release('b');
    await waitFor(() => npm.started('c') && npm.started('d'), { message: 'c and d to start together' });
    t.equal(npm.done('a'), false, 'while a, in the outer parallel, is still running');
    await waitFor(() => statuses(app).length === 4, { message: 'four lines' });
    t.deepEqual(statuses(app), ["… Running 'npm run a'", "✔ Ran 'npm run b'", "… Running 'npm run c'", "… Running 'npm run d'"], 'three levels deep, in the order they were written');
    for (const name of ['a', 'c', 'd']) npm.release(name);
    await waitFor(() => statuses(app).length === 4 && statuses(app).every((line) => line.startsWith('✔')), { message: 'everything to finish' });
  } finally {
    npm.restore();
  }
});

s.guidance(
  F,
  ['so once you need more than one subprocess with dependencies between them, `ink-spawn` handles the sequencing that your own `useEffect` chain (see `ink-async-and-suspense`\'s subprocess pattern) would otherwise have to.'],
  'a recommendation about when to reach for the package; the sequencing it refers to is proven by the claims about <Script> above. `ink-spawn` is the package name and `useEffect` the React hook the alternative would be written with, not facts to check',
  { exempt: ['ink-spawn', 'useEffect'] },
);

s.fact(F, ['Peer `ink >=4.0.0`.'], { kind: 'P' }, async (t, q) => {
  const [peer, range] = q.tok('ink >=4.0.0').split(' ');
  t.equal(pkg('ink-spawn').peerDependencies[peer], range, 'its peer range for Ink');
  t.ok(semver.satisfies(pkg('ink').version, range), `which Ink ${pkg('ink').version} satisfies`);
});

// ===================================================================== ink-progress-bar

s.fact(
  F,
  [
    'also covers why ink-progress-bar does not work on Ink 8.',
    "`ink-progress-bar` — don't use it on Ink 8",
    '`ink-progress-bar` is a CommonJS package that `require()`s Ink, so it throws `ERR_REQUIRE_ASYNC_MODULE` on Ink 8 (see `ink-ecosystem-overview`) — its README also still imports `<Color>` from Ink, which Ink no longer exports.',
  ],
  { kind: 'P', ctx: ['ink-ecosystem-overview'], timeout: 30_000 },
  async (t, q) => {
    const name = q.tok('ink-progress-bar');
    const meta = extPkg(name);
    t.notEqual(meta.type, 'module', 'a CommonJS package');
    const source = extReadFile(name, meta.main);
    t.ok(source.includes(q.tok('require()').replace('()', '("ink")')), 'that require()s Ink');
    const removed = q.tok('<Color>').replace(/[<>]/g, '');
    t.match(extReadFile(name, 'README.md'), new RegExp(`import \\{ ${removed} \\} from 'ink'`), `whose README imports ${removed} from Ink`);
    t.equal(removed in ink, false, 'which Ink does not export');
    t.equal(semver.major(pkg('ink').version), Number(q.tok('8')), 'the Ink in use');
    const run = await runExternal({ code: `try { await import('${name}'); console.log(JSON.stringify({loaded: true})); } catch (e) { console.log(JSON.stringify({loaded: false, code: e.code})); }` });
    t.equal(run.json?.loaded, false, 'importing it fails');
    if (semver.gte(process.versions.node, '22.12.0')) t.equal(run.json?.code, q.tok('ERR_REQUIRE_ASYNC_MODULE'), 'with that code');
  },
);

s.fact(
  F,
  ["Use `@inkjs/ui`'s `ProgressBar` (`inkjs-ui-feedback`) instead: it takes `value` as a number from `0` to `100`."],
  { kind: 'R', ctx: ['inkjs-ui-feedback'] },
  async (t, q) => {
    const ui = await import(q.tok('@inkjs/ui'));
    const ProgressBar = q.api(ui, 'ProgressBar');
    const value = q.tok('value');
    const [low, high] = [Number(q.tok('0')), Number(q.tok('100'))];
    const filled = async (number) => {
      const app = mount(h(ProgressBar, { [value]: number }), { columns: 20 });
      await app.flush();
      await app.flush();
      return [...app.screen()];
    };
    const [empty, half, full] = [await filled(low), await filled((low + high) / 2), await filled(high)];
    t.deepEqual([empty.length, half.length, full.length], [20, 20, 20], 'the bar fills the width');
    const [remaining, complete] = [empty[0], full[0]];
    t.notEqual(remaining, complete, 'with one character for done and another for what remains');
    t.deepEqual(empty, Array(20).fill(remaining), 'empty at 0');
    t.deepEqual(half, [...Array(10).fill(complete), ...Array(10).fill(remaining)], 'half at 50');
    t.deepEqual(full, Array(20).fill(complete), 'and full at 100');
  },
);

s.fact(
  F,
  ['(If you meet old code using `ink-progress-bar`, its `percent` prop was a *fraction* between 0 and 1 — don\'t carry that scale over to `value`.)'],
  { kind: 'R', timeout: 20_000 },
  async (t, q) => {
    const name = q.tok('ink-progress-bar');
    const percent = q.tok('percent');
    const value = q.tok('value');
    const [low, high] = [Number(q.tok('0')), Number(q.tok('1'))];
    // the CommonJS build, evaluated against this project's Ink and React: render the bar at 20 columns
    const dir = extPackageDir(name);
    const require = createRequire(join(dir, 'package.json'));
    const exported = { exports: {} };
    const source = extReadFile(name, extPkg(name).main);
    new Function('require', 'module', 'exports', source)((id) => (id === 'ink' ? ink : id === 'react' ? React : require(id)), exported, exported.exports);
    const Bar = exported.exports.default;
    const cells = (fraction) => draw(h(Bar, { [percent]: fraction, columns: 20 })).length;
    t.deepEqual([cells(low), cells((low + high) / 2), cells(high)], [0, 10, 20], 'ink-progress-bar fills a share of the width given by a fraction between 0 and 1');
    t.equal(cells(50), 20, 'so 50, the half of a 0-100 scale, already fills it');
    // ... while the replacement takes 0-100
    const ui = await import('@inkjs/ui');
    const bar = async (number) => {
      const app = mount(h(ui.ProgressBar, { [value]: number }), { columns: 20 });
      await app.flush();
      await app.flush();
      return [...app.screen()];
    };
    const [fullBar, halfBar] = [await bar(100), await bar(50)];
    t.equal(halfBar.filter((c) => c === fullBar[0]).length, 10, 'where 50 is half');
  },
);
