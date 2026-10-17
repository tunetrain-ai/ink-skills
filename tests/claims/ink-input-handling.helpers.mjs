// Shared fixtures for the ink-input-handling claims (SKILL.md and references/keys.md).
import { h, ink, mount, runIsolated, readPackageFile } from '../lib/index.mjs';
import { loadFile } from '../lib/claims.mjs';

const { Text, useInput, useStdin } = ink;

/** A key object as a plain value. */
export const plain = (key) => ({ ...key });

/** Names of the properties of the `key` object, as Ink's declaration lists them. */
export const KEY_PROPS = [...readPackageFile('ink', 'build/hooks/use-input.d.ts').match(/export type Key = \{([\s\S]*?)\n\};/)[1].matchAll(/^\s+(\w+)\??: /gm)].map((m) => m[1]);

/**
 * Mount a component whose useInput handler records what it receives. `send(bytes)` feeds bytes to
 * stdin as a terminal would and returns the calls the handler got for them.
 * @param {{render?: object, mount?: object, options?: object, extra?: (calls: any[]) => import('react').ReactNode}} [opts]
 */
export function inputApp(opts = {}) {
  const calls = [];
  const Probe = () => {
    useInput((input, key) => calls.push({ input, key: plain(key) }), opts.options);
    return h(Text, null, 'probe');
  };
  const app = mount(h(Probe), { ...opts.mount, render: opts.render ?? {} });
  return {
    app,
    calls,
    async send(...sequences) {
      calls.length = 0;
      await app.press(...sequences);
      return calls.slice();
    },
  };
}

/** What the handler receives for each byte sequence (the same app, one sequence after the other). */
export async function receive(sequences, opts = {}) {
  const { app, send } = inputApp(opts);
  await app.flush();
  const out = [];
  for (const sequence of sequences) out.push(await send(sequence));
  await app.unmount();
  return out;
}

/**
 * The bytes a notation such as `ESC [ 97 ; 9 u` or `\x03` stands for: `ESC` is the escape character,
 * `\xNN` a byte, and the spaces between the parts are only there for reading.
 */
export const bytesOf = (notation) =>
  notation
    .replace(/ESC/g, '\x1b')
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\r/g, '\r')
    .replace(/ /g, '');

/** Mount a component that reads `useStdin()` and keep what it returned. */
export function stdinApp(opts = {}) {
  const seen = {};
  const Probe = () => {
    Object.assign(seen, useStdin());
    if (opts.input) useInput(() => {}, opts.input === true ? undefined : opts.input);
    return h(Text, null, 'probe');
  };
  const app = mount(h(Probe), { ...opts.mount, render: opts.render ?? {} });
  return { app, seen };
}

/** Everything the app wrote to stdout, without the synchronized-output markers. */
export const written = (app) => app.bytes().replace(/\x1b\[\?2026[hl]/g, '');

/** The kitty keyboard protocol bytes among what was written. */
export const kittyWrites = (app) => ({
  query: written(app).includes('\x1b[?u'),
  enabled: [...written(app).matchAll(/\x1b\[>(\d+)u/g)].map((m) => Number(m[1])),
});

/** Mount an app with useInput active (so it reads stdin) and the given render options; resolves once it is listening. */
export async function kittyApp(renderOptions = {}, opts = {}) {
  const { app, send } = inputApp({ ...opts, render: renderOptions });
  await app.flush();
  return { app, send };
}

/** Mount a bare component (no input hook, so stdin may be anything) with the given render options. */
export async function plainApp(renderOptions = {}, mountOptions = {}) {
  const app = mount(h(Text, null, 'plain'), { ...mountOptions, render: renderOptions });
  await app.flush();
  return app;
}

// the process-lifetime probe runs one child per distinct argument; several claims (and the mutation
// audit) ask for the same ones
const aliveRuns = new Map();
/** Does a process that mounted `useInput(…, options)` (or nothing, for 'none') stay alive on its own? */
export function aliveProbe(arg) {
  if (!aliveRuns.has(arg)) {
    aliveRuns.set(
      arg,
      runIsolated({ probe: 'ink-input-handling-alive', args: [arg], env: { FORCE_COLOR: '0' }, tty: { isTTY: true, columns: 80 } }).then((run) => ({ alive: run.json?.alive === true, code: run.code, stderr: run.stderr })),
    );
  }
  return aliveRuns.get(arg);
}

/** Text of another skill's SKILL.md (throws for a name that is not a skill). */
export const skillText = (name, file = 'SKILL.md') => loadFile(name, file).raw;


/**
 * `s.runFence()` with the options the fence passes to `render(…, options)` forwarded to Ink.
 * The recording harness only reads its own options from that argument (columns, rows, debug,
 * `render`), so `kittyKeyboard`, `isScreenReaderEnabled` and the like would be dropped. Returns the
 * usual `{mod, apps}` plus `renderOptions`, the option objects the fence's render calls passed.
 */
export async function runFenceForwarding(s, file, nth, opts) {
  const renderOptions = [];
  let impl;
  Object.defineProperty(globalThis, '__FENCE_RENDER__', {
    configurable: true,
    get: () => impl,
    set: (fn) => {
      impl = (element, options) => {
        renderOptions.push(options);
        return fn(element, { render: options });
      };
    },
  });
  try {
    return { ...(await s.runFence(file, nth, opts)), renderOptions };
  } finally {
    delete globalThis.__FENCE_RENDER__;
  }
}

/** Track how an app ends: `{done, error}` (a rejection is recorded, not left unhandled). */
export function watchExit(app) {
  const state = { done: false, error: null };
  app.instance.waitUntilExit().then(
    () => (state.done = true),
    (error) => ((state.done = true), (state.error = error)),
  );
  return state;
}

/** The names Ink's declaration gives the handler's two parameters: `(input: string, key: Key) => void`. */
export function handlerParams() {
  const declared = readPackageFile('ink', 'build/hooks/use-input.d.ts').match(/type Handler = \((\w+): string, (\w+): Key\) => void/);
  return { input: declared[1], key: declared[2] };
}

/** The literal types Ink's declaration allows for `kittyKeyboard.mode`. */
export const kittyModes = () => [...readPackageFile('ink', 'build/kitty-keyboard.d.ts').match(/mode\?: ([^;]+);/)[1].matchAll(/'(\w+)'/g)].map((m) => m[1]);
