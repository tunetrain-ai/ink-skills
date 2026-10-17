// Shared fixtures for the ink-animation-and-performance claims.
import { useState } from 'react';
import { h, ink, mount, tick, waitFor, runIsolated } from '../lib/index.mjs';

const { Box, Text, useAnimation } = ink;

/**
 * Mount a component that calls `useAnimation(options)` and records every state it renders.
 * `latest()` is the newest one; `api` is the newest hook result (it has `reset`).
 */
export function animation(options, { render, mount: mountOptions } = {}) {
  const states = [];
  const holder = { api: null };
  const Probe = ({ options }) => {
    const api = useAnimation(options);
    holder.api = api;
    states.push({ frame: api.frame, time: api.time, delta: api.delta, at: performance.now() });
    return h(Text, null, String(api.frame));
  };
  const startedAt = performance.now();
  const app = mount(h(Probe, { options }), { ...mountOptions, render });
  return {
    app,
    states,
    startedAt,
    get api() {
      return holder.api;
    },
    latest: () => states.at(-1),
    /** The states in which a tick was rendered (the zero state and repeated renders of one tick left out). */
    ticks: () => states.filter((state, i) => state.time > 0 && (i === 0 || state.time !== states[i - 1].time)),
    rerender: (next) => app.rerender(h(Probe, { options: next })),
  };
}

/** Wait until the animation has rendered a state satisfying `predicate`. */
export const until = (probe, predicate, message) => waitFor(() => probe.states.some(predicate), { timeout: 5000, message });

// How many timers the animation scheduler holds is measured in a process of its own (no other test
// leaves timers behind there). One child per distinct question; claims and the mutation audit repeat them.
const timerRuns = new Map();
/**
 * `timerProbe('static', [{interval: 100}, …])`: the timers held while components with these useAnimation
 * options are mounted, and after they unmount. `timerProbe('toggle', {interval: 20}, 'isActive')`: the
 * timers held with the option unset, then false, then true again, in one app.
 */
export function timerProbe(mode, spec, option) {
  const args = [mode, JSON.stringify(spec), ...(option ? [option] : [])];
  const key = args.join(' ');
  if (!timerRuns.has(key)) {
    timerRuns.set(
      key,
      runIsolated({ probe: 'ink-animation-and-performance-timers', args, env: { FORCE_COLOR: '0' }, tty: { isTTY: false } }).then((run) => {
        if (!run.json) throw new Error(`timer probe failed:\n${run.stdout}\n${run.stderr}`);
        return run.json;
      }),
    );
  }
  return timerRuns.get(key);
}

/**
 * Re-render a counter as often as possible for `duration` ms and look at what was written.
 * `frames` are the writes that carry a counter value, each with the time it happened.
 */
export async function hammer(renderOptions, duration) {
  let set;
  let renders = 0;
  const Counter = () => {
    const [n, setN] = useState(0);
    set = setN;
    renders++;
    return h(Text, null, `n=${n}`);
  };
  const app = mount(h(Counter), { render: renderOptions });
  const writes = [];
  const write = app.stdout.write;
  app.stdout.write = function (chunk, ...rest) {
    writes.push({ at: performance.now(), text: String(chunk) });
    return write.call(this, chunk, ...rest);
  };
  await app.flush();
  writes.length = 0;
  renders = 0;
  const start = performance.now();
  let n = 0;
  while (performance.now() - start < duration) {
    set(++n);
    await tick();
  }
  const last = n;
  // let the trailing frame go out on its own (flush() would push it early)
  await waitFor(() => writes.some((w) => w.text.includes(`n=${last}`)), { timeout: 5000, message: 'the last frame' });
  const frames = writes.filter((w) => /n=\d+/.test(w.text));
  await app.unmount();
  return { frames, updates: n, renders, gaps: frames.slice(1).map((frame, i) => frame.at - frames[i].at) };
}

/** What Ink writes when the third line of a five-line UI changes from `before` to `after`. */
export async function secondWrite(renderOptions, lines, before, after) {
  const ui = (value) => h(Box, { flexDirection: 'column' }, ...lines.map((line, i) => h(Text, { key: i }, i === 2 ? `${line}${value}` : line)));
  const app = mount(ui(before), { render: renderOptions });
  await app.flush();
  const length = app.bytes().length;
  await app.rerender(ui(after));
  const out = app.bytes().slice(length).replace(/\x1b\[\?2026[hl]/g, '');
  await app.unmount();
  return out;
}
