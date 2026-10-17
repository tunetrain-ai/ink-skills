// Shared fixtures for the ink-async-and-suspense claims.
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { runIsolated, runFence } from '../lib/index.mjs';

/**
 * Run a fence whose top-level render(element, options) passes Ink options. The recording harness
 * of runFence takes `options` as *mount* options, so they are forwarded as Ink's render options
 * here, and what had been written to stdout the moment render() returned is recorded.
 */
export async function runFenceWithRenderOptions(fence, opts) {
  const writtenOnReturn = [];
  Object.defineProperty(globalThis, '__FENCE_RENDER__', {
    configurable: true,
    set(install) {
      Object.defineProperty(globalThis, '__FENCE_RENDER__', {
        configurable: true,
        writable: true,
        value: (element, options) => {
          const app = install(element, { render: options });
          writtenOnReturn.push(app.bytes());
          return app;
        },
      });
    },
  });
  try {
    return { ...(await runFence(fence, opts)), writtenOnReturn };
  } finally {
    delete globalThis.__FENCE_RENDER__;
  }
}

/**
 * Record every child_process.spawn() call (`method` names the function, spawn unless a claim binds
 * it to its text) and, for `watch`, calls of that method on the child, until restore(). The patch is synced to the ESM named exports, so a module imported meanwhile
 * sees it.
 */
export function spySpawn({ method = 'spawn', watch } = {}) {
  const original = cp[method];
  const children = [];
  const calls = [];
  cp[method] = function (...args) {
    const child = original.apply(this, args);
    if (watch) {
      const method = child[watch];
      child[watch] = (...a) => {
        calls.push(watch);
        return method.apply(child, a);
      };
    }
    children.push(child);
    return child;
  };
  syncBuiltinESMExports();
  return {
    children,
    calls,
    restore() {
      if (original) cp[method] = original;
      else delete cp[method];
      syncBuiltinESMExports();
    },
  };
}

// Probes that read process state at exit: each scenario in its own child, cached.
const runs = new Map();
export function probe(name, args, options = {}) {
  const key = JSON.stringify([name, args, options]);
  if (!runs.has(key)) {
    runs.set(
      key,
      runIsolated({ probe: name, args, path: 'inherit', tty: { isTTY: true, columns: 80, rows: 24 }, timeout: 40_000, ...options }),
    );
  }
  return runs.get(key);
}

/** A script for a child that stays alive until it is killed, reporting its pid once. */
export const REPORT_PID_AND_WAIT = 'console.log(process.pid); setInterval(() => {}, 1000)';
