// Runtime evidence helpers. Deliberately NOT built on ink-testing-library: that package
// forces `debug: true` (no throttling, no log-update), fixes `columns` at 100 and gives
// stdout no `rows`/`isTTY`, which hides incremental rendering, cursor handling, the
// alternate screen and every escape sequence. `mount()` drives ink.render on a fake TTY
// that records every byte.

import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import * as ink from 'ink';

export { React, ink };

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..', '..');

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------

const ANSI = /\x1B\[[0-?]*[ -/]*[@-~]|\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)|\x1B[()][0-9A-B]|\x1B[=>78]/g;
export const stripAnsi = (s) => String(s).replace(ANSI, '');

/** Named byte sequences a terminal sends. */
export const keys = {
  up: '\x1b[A',
  down: '\x1b[B',
  right: '\x1b[C',
  left: '\x1b[D',
  enter: '\r',
  keypadEnter: '\x1bOM',
  tab: '\t',
  shiftTab: '\x1b[Z',
  esc: '\x1b',
  space: ' ',
  backspace: '\x7f',
  delete: '\x1b[3~',
  home: '\x1b[H',
  end: '\x1b[F',
  pageUp: '\x1b[5~',
  pageDown: '\x1b[6~',
  ctrlC: '\x03',
  focusIn: '\x1b[I',
  focusOut: '\x1b[O',
  cursorPositionReport: '\x1b[12;40R',
  mouseDown: '\x1b[<0;10;5M',
  paste: (text) => `\x1b[200~${text}\x1b[201~`,
};

export const tick = () => new Promise((resolve) => setImmediate(resolve));
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Poll `predicate` on setImmediate ticks; the timeout is only the failure path. */
export async function waitFor(predicate, { timeout = 3000, message = 'condition' } = {}) {
  const deadline = Date.now() + timeout;
  for (let n = 0; ; n++) {
    const value = await predicate();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`waitFor: ${message} not met within ${timeout}ms`);
    await (n % 20 === 19 ? sleep(1) : tick());
  }
}

// ---------------------------------------------------------------------------
// a tiny screen model: what a terminal would show after the recorded bytes
// ---------------------------------------------------------------------------

/** Apply erase-line / cursor-up / carriage-return / newline to bytes; SGR and the rest are dropped. */
export function screenOf(bytes) {
  const lines = [''];
  let row = 0;
  let col = 0;
  const text = String(bytes);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\x1b') {
      const m = text.slice(i).match(/^\x1B\[([0-9;?]*)([ -/]*)([@-~])/);
      if (m) {
        const [seq, params, , final] = m;
        const n = Number(params.split(';')[0] || 1);
        if (final === 'A') row = Math.max(0, row - n);
        else if (final === 'B') while (row + n >= lines.length) lines.push('');
        else if (final === 'K' && (params === '2' || params === '')) lines[row] = params === '2' ? '' : lines[row].slice(0, col);
        else if (final === 'G') col = Math.max(0, n - 1);
        else if (final === 'J' && params === '2') lines.length = 1, lines[0] = '', row = 0;
        i += seq.length - 1;
        continue;
      }
      const osc = text.slice(i).match(/^\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/);
      if (osc) {
        i += osc[0].length - 1;
        continue;
      }
      continue;
    }
    if (ch === '\r') col = 0;
    else if (ch === '\n') {
      row++;
      col = 0;
      if (row >= lines.length) lines.push('');
    } else {
      const line = lines[row].padEnd(col, ' ');
      lines[row] = line.slice(0, col) + ch + line.slice(col + 1);
      col++;
    }
  }
  return lines.map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');
}

// ---------------------------------------------------------------------------
// fake TTY streams
// ---------------------------------------------------------------------------

export function fakeStdout({ columns = 80, rows = 24, isTTY = true } = {}) {
  const out = new EventEmitter();
  const writes = [];
  Object.assign(out, {
    columns,
    rows,
    writes,
    write(chunk, encoding, callback) {
      writes.push(String(chunk));
      if (typeof encoding === 'function') encoding();
      else callback?.();
      return true;
    },
    resize(newColumns, newRows) {
      out.columns = newColumns;
      if (newRows !== undefined) out.rows = newRows;
      out.emit('resize');
    },
    bytes: () => writes.join(''),
  });
  if (isTTY) out.isTTY = true; // non-TTY streams have no isTTY property at all
  return out;
}

export function fakeStdin({ isTTY = true } = {}) {
  const input = new EventEmitter();
  let pending = null;
  const rawModeCalls = [];
  Object.assign(input, {
    rawModeCalls,
    setEncoding() {},
    resume() {},
    pause() {},
    ref() {},
    unref() {},
    read() {
      const data = pending;
      pending = null;
      return data;
    },
    write(data) {
      pending = data;
      input.emit('readable');
      input.emit('data', data);
    },
  });
  if (isTTY) {
    input.isTTY = true;
    input.setRawMode = (value) => rawModeCalls.push(value);
  }
  return input;
}

// ---------------------------------------------------------------------------
// harness factory: mount() & friends over ONE (ink, React) pair
// ---------------------------------------------------------------------------
// A component from a package installed in tests/external must be mounted by THAT project's
// ink and React, otherwise its hooks bind to a different context object and silently see no
// provider. So everything that touches ink/React is built per pair; the root pair is the default.

/** Every harness registers its cleanup here so the claim runner can unmount whatever a test left mounted. */
export const allHarnessCleanups = new Set();

/** @param {typeof import('ink')} inkModule @param {typeof import('react')} ReactModule */
export function makeHarness(inkModule, ReactModule) {
  const React = ReactModule.default ?? ReactModule;
  const ink = inkModule;
  const h = React.createElement;
  const live = new Set();

  /**
   * Run a real Ink app against the fake TTY.
   * @param {import('react').ReactNode} element
   * @param {{columns?:number, rows?:number, isTTY?:boolean, stdinIsTTY?:boolean, debug?:boolean, render?:object}} [opts]
   */
  function mount(element, opts = {}) {
    const stdout = fakeStdout({ columns: opts.columns ?? 80, rows: opts.rows ?? 24, isTTY: opts.isTTY ?? true });
    const stderr = fakeStdout({ columns: opts.columns ?? 80, rows: opts.rows ?? 24, isTTY: opts.isTTY ?? true });
    const stdin = fakeStdin({ isTTY: opts.stdinIsTTY ?? opts.isTTY ?? true });
    const instance = ink.render(element, {
      stdout,
      stderr,
      stdin,
      debug: opts.debug ?? false,
      exitOnCtrlC: false,
      patchConsole: false,
      ...(opts.render ?? {}),
    });

    const api = {
      instance,
      stdout,
      stderr,
      stdin,
      /** Everything written to stdout, raw. */
      bytes: () => stdout.bytes(),
      /** Visible text after applying the recorded bytes (SGR dropped). */
      screen: () => screenOf(stdout.bytes()),
      /** In debug mode every write is a full frame. */
      lastFrame: () => stdout.writes.at(-1),
      /** Let React, Ink's throttled render and effects settle. */
      async flush() {
        // Yield to React's scheduler FIRST so a pending state update commits and Ink schedules its
        // (throttled) render; only then is there something for waitUntilRenderFlush to wait for.
        await tick();
        await instance.waitUntilRenderFlush();
        await tick();
        await tick();
        await instance.waitUntilRenderFlush();
      },
      /** Send bytes as a terminal would, then settle. A lone ESC waits out Ink's pending-escape flush. */
      async press(...sequences) {
        for (const sequence of sequences) {
          stdin.write(sequence);
          if (sequence === keys.esc) await sleep(45);
          await api.flush();
        }
      },
      async rerender(next) {
        instance.rerender(next);
        await api.flush();
      },
      async resize(newColumns, newRows) {
        stdout.resize(newColumns, newRows);
        await api.flush();
      },
      async unmount() {
        live.delete(api);
        instance.unmount();
        await tick();
      },
    };
    live.add(api);
    return api;
  }

  /** Called by the claim runner after every fact test. */
  async function cleanupMounts() {
    for (const api of [...live]) {
      try {
        await api.unmount();
      } catch {
        /* already unmounted */
      }
    }
  }

  /** Render `element` inside an error boundary; returns the caught error (or null). */
  function catchRenderError(element) {
    let caught = null;
    class Boundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { failed: false };
      }
      static getDerivedStateFromError() {
        return { failed: true };
      }
      componentDidCatch(error) {
        caught = error;
      }
      render() {
        return this.state.failed ? null : this.props.children;
      }
    }
    try {
      ink.renderToString(h(Boundary, null, element));
    } catch (error) {
      caught = error;
    }
    return caught;
  }

  allHarnessCleanups.add(cleanupMounts);
  return { ink, React, h, mount, cleanupMounts, catchRenderError };
}

// the default harness: the root project's ink and react
const rootHarness = makeHarness(ink, React);
export const { h, mount, cleanupMounts, catchRenderError } = rootHarness;

// ---------------------------------------------------------------------------
// subprocess runner for import-time / process-level state
// ---------------------------------------------------------------------------

/**
 * Run tests/probes/<probe>.mjs in a child process with an environment built from
 * scratch (Ink reads `is-in-ci` and chalk reads the environment once, at import).
 * The probe prints one JSON line, parsed into `json`.
 *
 * @param {{probe:string, env?:object, tty?:{isTTY?:boolean, columns?:number, rows?:number, stdin?:boolean}, path?:'empty'|'inherit', args?:string[], timeout?:number, signal?:string, killAfter?:number}} opts
 */
export function runIsolated({ probe, env = {}, tty = {}, path = 'empty', args = [], timeout = 15_000, signal, killAfter = 400 }) {
  const probeFile = join(ROOT, 'tests', 'probes', `${probe}.mjs`);
  if (!existsSync(probeFile)) throw new Error(`no probe: ${probe}`);
  const childEnv = {
    PATH: path === 'empty' ? '' : process.env.PATH ?? '',
    HOME: process.env.HOME ?? '',
    TMPDIR: process.env.TMPDIR ?? '/tmp',
    INK_TEST_TTY: JSON.stringify(tty),
    ...env,
  };
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', join(HERE, 'fake-tty.mjs'), probeFile, ...args], {
      cwd: ROOT,
      env: childEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`probe "${probe}" timed out after ${timeout}ms\nstdout: ${stdout}\nstderr: ${stderr}`));
    }, timeout);
    if (signal) setTimeout(() => child.kill(signal), killAfter);
    child.on('error', reject);
    child.on('close', (code, sig) => {
      clearTimeout(timer);
      const lastJson = stdout
        .split('\n')
        .reverse()
        .find((line) => line.trim().startsWith('{') || line.trim().startsWith('['));
      let json = null;
      try {
        json = lastJson ? JSON.parse(lastJson) : null;
      } catch {
        /* leave null */
      }
      resolve({ code, signal: sig, stdout, stderr, json });
    });
  });
}

// ---------------------------------------------------------------------------
// installed-package metadata
// ---------------------------------------------------------------------------

/** Directory of an installed package, found the way Node would: walking up node_modules. */
export function packageDir(name, startDir = ROOT) {
  let dir = startDir;
  for (;;) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`package "${name}" not installed (from ${startDir})`);
    dir = parent;
  }
}

/** package.json of an installed package. `from` resolves a nested dependency of another package. */
export function pkg(name, { from, base = ROOT } = {}) {
  const start = from ? packageDir(from, base) : base;
  return JSON.parse(readFileSync(join(packageDir(name, start), 'package.json'), 'utf8'));
}

/** Read a file inside an installed package. */
export function readPackageFile(name, relPath, { from, base = ROOT } = {}) {
  const start = from ? packageDir(from, base) : base;
  return readFileSync(join(packageDir(name, start), relPath), 'utf8');
}
