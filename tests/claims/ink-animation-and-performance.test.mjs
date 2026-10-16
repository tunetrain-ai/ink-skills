// Claims for skills/core/ink-animation-and-performance/SKILL.md.
import * as React from 'react';
import { skill, tsx, h, ink, mount, keys, tick, waitFor, stripAnsi, fakeStdout, fakeStdin } from '../lib/index.mjs';
import { skillText } from './ink-input-handling.helpers.mjs';
import { animation, until, timerProbe, hammer, secondWrite } from './ink-animation-and-performance.helpers.mjs';

const { Text, useAnimation, useInput } = ink;
const s = skill('ink-animation-and-performance');
const F = 'SKILL.md';

const evaluate = (expression, vars = {}) => new Function(...Object.keys(vars), `return (${expression})`)(...Object.values(vars));
const written = (app) => app.bytes().replace(/\x1b\[\?2026[hl]/g, '');
const close = (a, b, tolerance = 1e-6) => Math.abs(a - b) < tolerance;

// Suspense, useTransition and useDeferredValue in one render mode: what the screen shows and what the hooks report.
// Two claims need the same evidence, and the Suspense reveal takes about 300 ms, so each mode is run once.
const featureRuns = new Map();
function featuresIn(concurrent) {
  if (!featureRuns.has(concurrent)) {
    featureRuns.set(
      concurrent,
      (async () => {
        const out = {};
        // Suspense: the fallback shows while the promise is pending, then the content replaces it
        let resolve;
        const promise = new Promise((done) => (resolve = done));
        const Data = () => h(Text, null, `data:${React.use(promise)}`);
        const suspense = mount(h(React.Suspense, { fallback: h(Text, null, 'loading') }, h(Data)), { debug: true, render: { concurrent } });
        await suspense.flush();
        out.fallbackShown = suspense.stdout.writes.includes('loading');
        resolve('ok');
        await waitFor(() => suspense.stdout.writes.includes('data:ok'), { timeout: 5000, message: 'the content to replace the fallback' });
        out.contentShown = true;
        await suspense.unmount();
        // useTransition: pending while the transition runs, then not
        const pending = [];
        let start;
        let setValue;
        const Transition = () => {
          const [value, set] = React.useState(0);
          const [isPending, startTransition] = React.useTransition();
          setValue = set;
          start = startTransition;
          pending.push(`${value}:${isPending}`);
          return h(Text, null, `${value}`);
        };
        const transition = mount(h(Transition), { debug: true, render: { concurrent } });
        await transition.flush();
        pending.length = 0;
        start(() => setValue(1));
        await transition.flush();
        out.transition = [...pending];
        await transition.unmount();
        // useDeferredValue: the deferred value lags one render behind
        const deferred = [];
        let setSource;
        const Deferred = () => {
          const [value, set] = React.useState('a');
          setSource = set;
          const lagging = React.useDeferredValue(value);
          deferred.push(`${value}/${lagging}`);
          return h(Text, null, lagging);
        };
        const deferredApp = mount(h(Deferred), { debug: true, render: { concurrent } });
        await deferredApp.flush();
        deferred.length = 0;
        setSource('b');
        await deferredApp.flush();
        out.deferred = [...deferred];
        await deferredApp.unmount();
        return out;
      })(),
    );
  }
  return featureRuns.get(concurrent);
}

/** The assertions both claims make about the three features in both modes. */
async function assertFeaturesInEitherMode(t) {
  for (const concurrent of [false, true]) {
    const mode = concurrent ? 'concurrent: true' : 'by default';
    const features = await featuresIn(concurrent);
    t.ok(features.fallbackShown, `${mode}: Suspense shows the fallback while the promise is pending`);
    t.ok(features.contentShown, `${mode}: and swaps in the content once it has resolved`);
    t.deepEqual(features.transition, ['0:true', '1:false'], `${mode}: useTransition is pending, then done`);
    t.deepEqual(features.deferred, ['b/a', 'b/b'], `${mode}: useDeferredValue lags one render, then catches up`);
  }
}

// ===================================================================== description

s.fact(
  F,
  ['Animate Ink components with useAnimation (frame/time/delta/reset, a single shared internal timer), and tune how Ink renders with maxFps, incrementalRendering, and the concurrent option (Suspense, useTransition and useDeferredValue work with or without it).'],
  { kind: 'R', timeout: 20_000 },
  async (t) => {
    const probe = animation({ interval: 10 });
    await probe.app.flush();
    t.deepEqual(Object.keys(probe.api).sort(), ['delta', 'frame', 'reset', 'time'], 'useAnimation returns frame, time, delta and reset');
    const none = await timerProbe('static', []);
    const four = await timerProbe('static', [100, 100, 100, 50].map((interval) => ({ interval })));
    t.equal(four.mounted - none.mounted, 1, 'any number of animated components share one timer');
    await assertFeaturesInEitherMode(t);
  },
);

s.types(
  F,
  ['Animate Ink components with useAnimation (frame/time/delta/reset, a single shared internal timer), and tune how Ink renders with maxFps, incrementalRendering, and the concurrent option (Suspense, useTransition and useDeferredValue work with or without it).'],
  tsx`
import {render, useAnimation} from 'ink';

const App = () => null;
render(<App />, {maxFps: 10, incrementalRendering: true, concurrent: true});
render(<App />, {maxFps: '10'}); //! TS2322
render(<App />, {incrementalRendering: 'yes'}); //! TS2322
render(<App />, {concurrent: 1}); //! TS2322
const {frame, time, delta, reset} = useAnimation();
export const result: [number, number, number, () => void] = [frame, time, delta, reset];
`,
);

s.guidance(F, ['Use for spinners, progress animations, or "my UI updates too fast/flickers" performance questions.'], 'trigger phrases for when to load the skill; what the skill teaches is proven by the other claims of this file', {
  exempt: ['my UI updates too fast/flickers'],
});

// ===================================================================== useAnimation

s.fact(F, ['Drives frame-based animation.'], { kind: 'R' }, async (t) => {
  const probe = animation({ interval: 10 });
  t.deepEqual([probe.latest().frame, probe.latest().time], [0, 0], 'it starts at frame 0');
  await until(probe, (state) => state.frame >= 3, 'the frame to reach 3');
  const frames = probe.states.map((state) => state.frame);
  t.deepEqual(frames, [...frames].sort((a, b) => a - b), 'the frame only goes up');
  t.ok(probe.latest().frame >= 3, 'and keeps going without anything driving it');
});

s.fact(
  F,
  ['All components using `useAnimation` share a **single internal timer**: many animated components run off one timer rather than each starting its own interval.'],
  { kind: 'R' },
  async (t, q) => {
    q.api(ink, 'useAnimation');
    const expected = { 'single internal timer': 1 }[q.tok('single internal timer')];
    const none = await timerProbe('static', []);
    t.equal(none.mounted, 0, 'baseline: an app without animation holds no timer');
    for (const intervals of [[100], [100, 100, 100], [50, 70, 90, 110, 130], Array(30).fill(100)]) {
      const run = await timerProbe('static', intervals.map((interval) => ({ interval })));
      t.equal(run.mounted - none.mounted, expected, `${intervals.length} animated components: ${expected} timer`);
      t.equal(run.afterUnmount, none.mounted, 'and none once they unmount');
    }
  },
);

s.fence(F, 0, {
  run: async (t) => {
    const { mod } = await s.runFence(F, 0);
    const characters = evaluate(s.fenceOf(F, 0).code.match(/const characters = (\[[^\]]*\])/)[1]);
    t.equal(characters.length, 10, 'ten spinner characters');
    const startedAt = performance.now();
    const app = mount(h(mod.Spinner));
    // every spinner character as it is written, with the time it was written
    const seen = [];
    const take = (chunk, at) => {
      for (const char of chunk) if (characters.includes(char) && seen.at(-1)?.char !== char) seen.push({ char, at });
    };
    take(app.bytes(), startedAt);
    const write = app.stdout.write;
    app.stdout.write = function (chunk, ...rest) {
      take(String(chunk), performance.now());
      return write.call(this, chunk, ...rest);
    };
    await waitFor(() => seen.length >= 3, { timeout: 5000, message: 'three spinner characters' });
    t.equal(seen[0].char, characters[0], 'it starts at the first character');
    const indices = seen.map(({ char }) => characters.indexOf(char));
    t.deepEqual(indices, [...indices].sort((a, b) => a - b), 'then goes through them in order');
    t.ok(seen[1].at - startedAt >= 80 - 3, 'the next character comes no sooner than the interval of 80 ms');
  },
});

s.fact(F, ['| `interval` | `number` | `100` | Milliseconds between ticks. |'], { kind: 'D' }, async (t, q) => {
  const option = q.tok('interval');
  const dflt = Number(q.tok('100'));
  const kind = q.tok('number');
  // the default
  const byDefault = animation(undefined);
  await until(byDefault, (state) => state.frame >= 2, 'two default intervals');
  for (const state of byDefault.states) t.equal(state.frame, Math.floor(state.time / dflt), 'the default interval is the one the frame counts in');
  // an interval given as a number
  const value = 20;
  t.equal(typeof value, kind);
  const given = animation({ [option]: value });
  await until(given, (state) => state.frame >= 3, 'three intervals of 20');
  for (const state of given.states) t.equal(state.frame, Math.floor(state.time / value), 'the interval option sets it');
  // milliseconds: time is a count of them, bounded by the wall clock
  const last = given.latest();
  t.ok(last.time >= last.frame * value, 'time is at least frame * interval milliseconds');
  t.ok(last.time <= last.at - given.startedAt + 1, 'and no more than the milliseconds that actually passed');
});

s.types(
  F,
  ['| `interval` | `number` | `100` | Milliseconds between ticks. |'],
  tsx`
import {useAnimation} from 'ink';

useAnimation({interval: 80});
useAnimation();
useAnimation({interval: '80'}); //! TS2322
`,
  { ctx: ['interval', 'number', '100'] },
);

s.fact(
  F,
  ['| `isActive` | `boolean` | `true` | Stops the animation when `false`. Toggling back to `true` resets everything to `0` — it does not resume from where it left off. |'],
  { kind: 'D' },
  async (t, q) => {
    const option = q.tok('isActive');
    const [on, off] = [JSON.parse(q.tok('true')), JSON.parse(q.tok('false'))];
    t.equal(typeof on, q.tok('boolean'));
    const zero = Number(q.tok('0'));
    const interval = 20;
    // timers the animation holds (counted in a process of its own)
    const held = async (options) => (await timerProbe('static', [options])).mounted;
    t.equal(await held({ interval }), 1, 'true is the default: without the option the animation runs');
    t.equal(await held({ interval, [option]: on }), 1, 'with true it runs');
    t.equal(await held({ interval, [option]: off }), 0, 'with false nothing runs at all');
    const toggled = await timerProbe('toggle', { interval }, option);
    t.deepEqual(toggled.sequence, [1, 0, 1], 'switching the option off removes the animation timer and switching it on brings it back');
    // the values: they stay put while it is off and start over from 0 when it is back on
    const probe = animation({ interval, [option]: on });
    await until(probe, (state) => state.time >= 10 * interval, 'ten intervals');
    const paused = probe.latest();
    await probe.rerender({ interval, [option]: off });
    await probe.app.flush();
    t.deepEqual([probe.latest().frame, probe.latest().time], [paused.frame, paused.time], 'while it is off its values stay where they were');
    const reactivatedAt = performance.now();
    await probe.rerender({ interval, [option]: on });
    t.deepEqual([probe.latest().frame, probe.latest().time, probe.latest().delta], [zero, zero, zero], 'toggled back to true, everything is 0');
    await until(probe, (state) => state.frame >= 1 && state.at > reactivatedAt, 'a tick after reactivation');
    const first = probe.states.find((state) => state.frame >= 1 && state.at > reactivatedAt);
    t.ok(first.time <= first.at - reactivatedAt + 1, 'it counts from the moment it was switched back on');
  },
);

s.types(
  F,
  ['| `isActive` | `boolean` | `true` | Stops the animation when `false`. Toggling back to `true` resets everything to `0` — it does not resume from where it left off. |'],
  tsx`
import {useAnimation} from 'ink';

useAnimation({isActive: true});
useAnimation({isActive: false});
useAnimation({isActive: 'no'}); //! TS2322
`,
  { ctx: ['isActive', 'boolean', 'true', 'false', '0'] },
);

s.fact(
  F,
  ['| `frame` | `number` | Discrete counter, +1 per interval elapsed (it jumps by more when renders are throttled) — indexed sequences like spinner frames. |'],
  { kind: 'R' },
  async (t, q) => {
    const property = q.tok('frame');
    const step = Number(q.tok('1'));
    const probeType = animation({ interval: 10 });
    t.equal(typeof probeType.latest()[property], q.tok('number'), 'the frame is a number');
    // the frame counts intervals: floor(time / interval), one per interval
    const interval = 25;
    const counting = animation({ interval }, { render: { maxFps: 1000 } });
    await until(counting, (state) => state.frame >= 4, 'four intervals');
    for (const state of counting.states) {
      t.ok(Number.isInteger(state[property]), 'the frame is a whole number');
      t.equal(state[property], Math.floor(state.time / interval) * step, 'one per interval elapsed');
    }
    // throttled renders: with intervals shorter than the render throttle, the frame jumps
    const throttled = animation({ interval: 5 });
    await until(throttled, (state) => state.frame >= 20, 'twenty intervals');
    const ticks = throttled.ticks();
    t.ok(ticks.length >= 2, 'several ticks were rendered');
    for (let i = 1; i < ticks.length; i++) t.ok(ticks[i].frame - ticks[i - 1].frame > step, 'a rendered tick jumped by more than one');
  },
);

s.fact(
  F,
  ['| `time` | `number` | Total elapsed ms since start/reset — continuous math like `Math.sin(time / 1000 * Math.PI * 2)`. |'],
  { kind: 'R' },
  async (t, q) => {
    const property = q.tok('time');
    const probe = animation({ interval: 20 });
    await until(probe, (state) => state.time >= 100, 'a tenth of a second');
    t.equal(typeof probe.latest()[property], q.tok('number'), 'time is a number');
    const times = probe.states.map((state) => state[property]);
    t.equal(times[0], 0, 'time starts at 0');
    t.deepEqual(times, [...times].sort((a, b) => a - b), 'and only grows');
    const last = probe.latest();
    t.ok(last[property] <= last.at - probe.startedAt + 1, 'in milliseconds: never more than the wall clock allows');
    // the sine example: one full period per second
    const sine = (time) => evaluate(q.tok('Math.sin(time / 1000 * Math.PI * 2)'), { time });
    t.ok(close(sine(0), 0) && close(sine(250), 1) && close(sine(500), 0) && close(sine(750), -1) && close(sine(1000), 0), 'time in ms makes that expression one cycle per second');
    // since reset
    const resetAt = performance.now();
    probe.api.reset();
    await probe.app.flush();
    await until(probe, (state) => state.at > resetAt && state.time > 0, 'a tick after the reset');
    const after = probe.states.find((state) => state.at > resetAt && state.time > 0);
    t.ok(after.time <= after.at - resetAt + 1, 'after a reset it counts from the reset');
  },
);

s.fact(
  F,
  ['| `delta` | `number` | Ms since the previous *rendered* tick (accounts for throttled renders) — physics/velocity-driven motion: `position += speed * delta`. |'],
  { kind: 'R' },
  async (t, q) => {
    const property = q.tok('delta');
    const interval = 5;
    const throttle = Math.ceil(1000 / 30);
    const probe = animation({ interval });
    await until(probe, (state) => state.frame >= 30, 'thirty intervals');
    t.equal(typeof probe.latest()[property], q.tok('number'), 'delta is a number');
    const ticks = probe.ticks();
    t.ok(ticks.length >= 3, 'several ticks were rendered');
    ticks.forEach((tick, i) => {
      const previous = i === 0 ? 0 : ticks[i - 1].time;
      t.ok(close(tick[property], tick.time - previous), 'delta is the time since the previous rendered tick');
      t.ok(tick[property] >= throttle, 'and with the render throttle in the way it spans every interval that was skipped, not just one');
      t.ok(tick[property] > interval, 'more than a single interval');
    });
    // physics: summing speed * delta over the rendered ticks gives speed * elapsed time
    const step = new Function('position', 'speed', 'delta', `${q.tok('position += speed * delta')}; return position;`);
    t.equal(step(10, 2, 50), 110, 'the expression moves by speed times delta');
    const speed = 3;
    const position = ticks.reduce((current, tick) => step(current, speed, tick[property]), 0);
    t.ok(close(position, speed * ticks.at(-1).time, 1e-6 * position), 'so the motion stays exact however many frames were skipped');
  },
);

s.fact(
  F,
  ['| `reset` | `() => void` | Resets `frame`/`time`/`delta` to `0`, restarts timing — for one-shot animations triggered by an event. |'],
  { kind: 'R' },
  async (t, q) => {
    const resetKey = q.tok('reset');
    const [, parameters, returns] = q.tok('() => void').match(/^\((.*)\) => (\w+)$/);
    const [frame, time, delta] = ['frame', 'time', 'delta'].map((name) => q.tok(name));
    const zero = Number(q.tok('0'));
    // an event (a key press) triggers the reset
    const states = [];
    const Probe = () => {
      const result = useAnimation({ interval: 20 });
      states.push({ ...result, at: performance.now() });
      useInput(() => result[resetKey]());
      return h(Text, null, String(result[frame]));
    };
    const app = mount(h(Probe));
    await waitFor(() => states.some((state) => state[time] >= 100), { timeout: 5000, message: 'a tenth of a second' });
    t.equal(typeof states.at(-1)[resetKey], 'function', 'reset is a function');
    t.equal(states.at(-1)[resetKey].length, parameters ? parameters.split(',').length : 0, 'that takes no arguments');
    const lone = animation({ interval: 20 });
    await lone.app.flush();
    t.equal(typeof lone.api[resetKey](), returns === 'void' ? 'undefined' : returns, 'and returns nothing');
    const before = states.at(-1);
    t.ok(before[time] > 0 && before[frame] > 0);
    const length = states.length;
    const pressedAt = performance.now();
    await app.press(keys.space);
    const after = states.slice(length).find((state) => state.at >= pressedAt && state[time] === zero);
    t.deepEqual([after[frame], after[time], after[delta]], [zero, zero, zero], 'after the event, frame, time and delta are 0');
    await waitFor(() => states.slice(length).some((state) => state[frame] >= 1), { timeout: 5000, message: 'a tick after the reset' });
    const restarted = states.slice(length).find((state) => state[frame] >= 1);
    t.ok(restarted[time] <= restarted.at - pressedAt + 1, 'and timing restarts from the event');
  },
);

s.fact(
  F,
  ["For a simple spinner, prefer `@inkjs/ui`'s `Spinner` (see `inkjs-ui-feedback`) over hand-rolling one — reach for `useAnimation` directly when you need custom frames, `time`-based easing, or `delta`-driven motion."],
  { kind: 'R' },
  async (t, q) => {
    const ui = await import(q.tok('@inkjs/ui'));
    const Spinner = q.api(ui, 'Spinner');
    const hook = q.api(ink, 'useAnimation');
    const [time, delta] = [q.tok('time'), q.tok('delta')];
    // the ready-made spinner animates by itself
    const app = mount(h(Spinner, { label: 'Loading' }));
    const initial = stripAnsi(written(app));
    await waitFor(() => stripAnsi(written(app)) !== initial && /Loading/.test(stripAnsi(written(app))), { timeout: 5000, message: 'the spinner to move' });
    t.match(stripAnsi(written(app)), /Loading/, '@inkjs/ui ships a Spinner that animates with no hook in your code');
    // the hook is what to use for time and delta
    const probe = animation({ interval: 20 });
    await probe.app.flush();
    t.ok(time in probe.api && delta in probe.api, 'useAnimation gives time and delta for easing and motion');
    t.equal(typeof hook, 'function');
    const feedback = skillText(q.tok('inkjs-ui-feedback'));
    t.match(feedback, /`Spinner`/, 'inkjs-ui-feedback documents the Spinner');
  },
);

// ===================================================================== render options

s.fact(F, ['Set on `render(tree, options)` — see `ink-rendering-and-lifecycle` for the full option list.'], { kind: 'R' }, async (t, q) => {
  const render = q.api(ink, 'render(tree, options)');
  t.equal(render.length, 2, 'render takes a tree and options');
  const lifecycle = skillText(q.tok('ink-rendering-and-lifecycle'));
  for (const option of ['maxFps', 'incrementalRendering', 'concurrent']) t.ok(lifecycle.includes(`\`${option}\``), `${option} is in the option list of ink-rendering-and-lifecycle`);
  const app = mount(h(Text, null, 'tree'), { render: { maxFps: 10, incrementalRendering: true, concurrent: false } });
  await app.flush();
  t.ok(written(app).includes('tree'), 'the options are accepted by render');
});

s.fact(
  F,
  ['- **`maxFps`** (default `30`) caps how many frames per second Ink writes, however often your components re-render; a lower value writes fewer frames.'],
  { kind: 'D', timeout: 30_000 },
  async (t, q) => {
    const option = q.tok('maxFps');
    t.equal(q.tok('`maxFps`').replace(/`/g, ''), option, 'the option is named in bold and in code');
    const dflt = Number(q.tok('30'));
    const duration = 250;
    const throttle = (fps) => Math.ceil(1000 / fps);
    const byDefault = await hammer({}, duration);
    const slower = await hammer({ [option]: 10 }, duration);
    const faster = await hammer({ [option]: 1000 }, duration);
    t.ok(byDefault.renders > 2 * byDefault.frames.length, 'the component rendered far more often than frames were written');
    t.ok(byDefault.frames.length >= 3 && slower.frames.length >= 2, 'several frames were written');
    for (const gap of byDefault.gaps) t.ok(gap >= throttle(dflt) - 2, `by default frames are at least ${throttle(dflt)} ms apart (${gap.toFixed(1)})`);
    for (const gap of slower.gaps) t.ok(gap >= throttle(10) - 2, `with maxFps 10 at least ${throttle(10)} ms apart (${gap.toFixed(1)})`);
    t.ok(slower.frames.length < byDefault.frames.length, 'a lower value writes fewer frames');
    t.ok(faster.frames.length > byDefault.frames.length, 'positive control: a higher one writes more');
  },
);

const LINES = ['header line one', 'second line here', 'status: ', 'fourth line', 'fifth line'];

s.fact(
  F,
  ['- **`incrementalRendering`** (default `false`) redraws only the lines that changed instead of the whole frame.'],
  { kind: 'D' },
  async (t, q) => {
    const option = q.tok('incrementalRendering');
    t.equal(q.tok('`incrementalRendering`').replace(/`/g, ''), option, 'the option is named in bold and in code');
    const dflt = JSON.parse(q.tok('false'));
    const unchanged = LINES.filter((_, i) => i !== 2);
    const whole = await secondWrite({}, LINES, 'AAAA', 'BBBB');
    const explicit = await secondWrite({ [option]: dflt }, LINES, 'AAAA', 'BBBB');
    const incremental = await secondWrite({ [option]: !dflt }, LINES, 'AAAA', 'BBBB');
    t.equal(explicit, whole, 'false is what you get without the option');
    for (const line of unchanged) t.ok(whole.includes(line), `the whole frame is written again, including "${line}"`);
    t.ok(whole.includes('BBBB'));
    for (const line of unchanged) t.ok(!incremental.includes(line), `incrementally the unchanged line "${line}" is not written again`);
    t.ok(incremental.includes('BBBB'), 'only the changed one is');
  },
);

s.fact(
  F,
  ["It also skips each changed line's unchanged prefix when safe; a line containing an OSC 8 hyperlink is redrawn whole."],
  // "8" is the number of the OSC command that makes hyperlinks (a name, not a measurement)
  { kind: 'R', ctx: ['8'] },
  async (t) => {
    const render = { incrementalRendering: true };
    const prefix = LINES[2];
    const partial = await secondWrite(render, LINES, 'AAAA', 'BBBB');
    t.ok(!partial.includes(prefix.trim()), 'the unchanged prefix of the changed line is not written again');
    t.ok(partial.includes(`\x1b[${prefix.length + 1}G\x1b[K` + 'BBBB'), 'the cursor jumps to the first changed column and writes from there');
    // a line with a hyperlink: the whole line goes out again
    const link = '\x1b]8;;http://example.com\x07link\x1b]8;;\x07 ';
    const redrawn = await secondWrite(render, [LINES[0], LINES[1], link, LINES[3], LINES[4]], 'AAAA', 'BBBB');
    t.ok(redrawn.includes(`\x1b[1G\x1b[K\x1b]8;;http://example.com\x07link`), 'a line with an OSC 8 hyperlink is erased and written from its first column');
    t.ok(redrawn.includes('link') && redrawn.includes('BBBB'), 'with its unchanged part');
    // a color is not one: the prefix is still skipped
    const colored = await secondWrite(render, [LINES[0], LINES[1], '\x1b[31mred prefix\x1b[39m ', LINES[3], LINES[4]], 'AAAA', 'BBBB');
    t.ok(!colored.includes('red prefix'), 'positive control: a color code does not');
  },
);

const FIRST_OUTPUT = (app) => written(app).length > 0;

s.fact(
  F,
  ["- **`concurrent`** (default `false`) changes when `render()` writes: it then returns before the initial output is written, where by default that output is already written when it returns."],
  { kind: 'D' },
  async (t, q) => {
    const option = q.tok('concurrent');
    t.equal(q.tok('`concurrent`').replace(/`/g, ''), option, 'the option is named in bold and in code');
    const dflt = JSON.parse(q.tok('false'));
    q.api(ink, 'render()');
    const mountWith = (render) => mount(h(Text, null, 'initial'), { render });
    const byDefault = mountWith({});
    t.equal(FIRST_OUTPUT(byDefault), true, 'by default the initial output is already there when render() returns');
    const explicit = mountWith({ [option]: dflt });
    t.equal(FIRST_OUTPUT(explicit), true, 'and so it is with false');
    const concurrent = mountWith({ [option]: !dflt });
    t.equal(FIRST_OUTPUT(concurrent), false, 'with concurrent it is not');
    await concurrent.flush();
    t.ok(written(concurrent).includes('initial'), 'but it is written a moment later');
  },
);

s.fact(
  F,
  ['`Suspense`, `useTransition` and `useDeferredValue` do not need it — they work in either mode; see `ink-async-and-suspense` for `Suspense` specifics.'],
  { kind: 'R', timeout: 20_000 },
  async (t, q) => {
    q.api(React, 'Suspense');
    q.api(React, 'useTransition');
    q.api(React, 'useDeferredValue');
    t.match(skillText(q.tok('ink-async-and-suspense')), /Suspense/, 'ink-async-and-suspense covers Suspense');
    await assertFeaturesInEitherMode(t);
  },
);

s.fact(
  F,
  ["Reusing the same `stdout` for another `render()` without unmounting is unsupported in either mode: Ink warns on stderr and keeps the first instance's options."],
  { kind: 'R' },
  async (t, q) => {
    const stdoutName = q.tok('stdout');
    const render = q.api(ink, 'render()');
    const stderrWrite = process.stderr.write;
    for (const concurrent of [false, true]) {
      const warnings = [];
      process.stderr.write = (chunk) => (warnings.push(String(chunk)), true);
      const stdout = fakeStdout();
      let first;
      try {
        first = render(h(Text, null, 'one'), { [stdoutName]: stdout, stdin: fakeStdin(), stderr: fakeStdout(), patchConsole: false, debug: true, concurrent });
        t.deepEqual(warnings, [], 'the first render() warns about nothing');
        // second render on the same stdout: other tree, other options
        render(h(Text, null, 'two'), { [stdoutName]: stdout, stdin: fakeStdin(), stderr: fakeStdout(), patchConsole: false, concurrent: !concurrent });
        await waitFor(() => stdout.writes.includes('two'), { timeout: 5000, message: 'the second tree to be written' });
      } finally {
        process.stderr.write = stderrWrite;
      }
      t.equal(warnings.length, 1, 'the second render() writes one warning to stderr');
      t.match(warnings[0], /Reusing stdout across multiple render\(\) calls is unsupported/, 'which says it is unsupported');
      t.ok(stdout.writes.includes('two'), 'the second tree is written plain, as debug mode writes frames: the first instance kept its options');
      t.ok(!stdout.writes.some((chunk) => chunk.includes('\x1b[')), 'with no cursor handling, though the second call did not ask for debug');
      first.unmount();
    }
  },
);
