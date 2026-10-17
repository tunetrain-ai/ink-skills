// Fixtures for the inkjs-ui-feedback claims.
import { h, mount, waitFor } from '../lib/index.mjs';
import spinners from 'cli-spinners';

/** Record the delay of every `setInterval` started until `restore()` is called. */
export function stubTimers() {
  const original = globalThis.setInterval;
  const intervals = [];
  globalThis.setInterval = (callback, delay, ...rest) => {
    intervals.push(delay);
    return original(callback, delay, ...rest);
  };
  return { intervals, restore: () => (globalThis.setInterval = original) };
}

const runs = new Map();

/**
 * Mount `<Component {...props}>` (a Spinner) and wait until it has stepped through one whole cycle
 * of its spinner type and started the next. Returns what was on screen after each step, the delay of
 * the timers it started during mount, and the first of them. The result depends on the props only, so
 * it is kept for the claims that read the same one.
 */
export function framesOf(Component, props = {}) {
  const key = `${Component.name}:${JSON.stringify(props)}`;
  if (!runs.has(key)) {
    runs.set(
      key,
      (async () => {
        const cycle = spinners[props.type ?? 'dots'].frames.length;
        const timers = stubTimers();
        const app = mount(h(Component, props));
        timers.restore();
        await app.flush();
        const frames = [app.screen()];
        await waitFor(
          () => {
            const now = app.screen();
            if (now !== frames.at(-1)) frames.push(now);
            return frames.length > cycle;
          },
          { timeout: 8000, message: 'a whole spinner cycle' },
        );
        await app.unmount();
        return { frames, intervals: timers.intervals, interval: timers.intervals[0] };
      })(),
    );
  }
  return runs.get(key);
}

/** The first escape sequence of rendered output (the opening SGR code of its first styled run). */
export const SGR_OPEN = (out) => out.match(/^\x1b\[[0-9;]+m/)?.[0] ?? '';
