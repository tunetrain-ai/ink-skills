// What happens to the process exit code when an Ink app exits. One scenario per run (argv[2]; argv[3]
// names the member of `process` that exit-code / process-exit use);
// prints one JSON line, and the parent reads the real exit status of this process.
//
// The `fence-*` scenarios run the code fences of ink-app-architecture/SKILL.md as written: the
// fence's render() goes to the recording harness, whose instance is wrapped so that the fence can
// destructure waitUntilExit() from it.
import { writeSync } from 'node:fs';
import React from 'react';
import { render, Text, useApp } from 'ink';
import { loadFile } from '../lib/claims.mjs';
import { runFence } from '../lib/fence-run.mjs';

const h = React.createElement;
const [scenario, member] = process.argv.slice(2);
const fences = loadFile('ink-app-architecture', 'SKILL.md').fences;
// written synchronously: process.exit() right after must not lose the line
const out = (value) => writeSync(1, `${JSON.stringify({ scenario, ...value })}\n`);

/** A component that calls `exit(...args)` once mounted. */
const Quitter = ({ args = [], before }) => {
  const { exit } = useApp();
  React.useEffect(() => {
    before?.();
    exit(...args);
  }, []);
  return h(Text, null, 'running');
};

/** Await waitUntilExit() the way the skill's call site does and report how it settled. */
async function settle(instance) {
  try {
    const value = await instance.waitUntilExit();
    return { settled: 'resolved', value: value ?? null };
  } catch (error) {
    return { settled: 'rejected', message: String(error.message) };
  }
}

/**
 * Run a fence whose top-level render() is handed back an Ink-like instance. Resolves with the
 * mounted app while the fence is still awaiting, and the fence's own promise.
 */
function runFenceAndCapture(fence) {
  let captured;
  const app = new Promise((resolve) => {
    captured = resolve;
  });
  Object.defineProperty(globalThis, '__FENCE_RENDER__', {
    configurable: true,
    set(install) {
      Object.defineProperty(globalThis, '__FENCE_RENDER__', {
        configurable: true,
        writable: true,
        value: (element, options) => {
          const mounted = install(element, options);
          mounted.waitUntilExit = () => mounted.instance.waitUntilExit();
          captured(mounted);
          return mounted;
        },
      });
    },
  });
  return { app, done: runFence(fence) };
}

switch (scenario) {
  // exit() settles waitUntilExit() and nothing else
  case 'exit': {
    const instance = render(h(Quitter));
    out({ ...(await settle(instance)), exitCode: process.exitCode ?? null });
    break;
  }
  case 'exit-error': {
    const instance = render(h(Quitter, { args: [new Error('boom')] }));
    out({ ...(await settle(instance)), exitCode: process.exitCode ?? null });
    break;
  }
  // process.exitCode versus process.exit(code), with work still scheduled (a timer)
  case 'exit-code': {
    setTimeout(() => console.log('TIMER FIRED'), 100);
    const instance = render(h(Quitter, { before: () => (process[member] = 3) }));
    out({ ...(await settle(instance)), exitCode: process.exitCode ?? null });
    break;
  }
  case 'process-exit': {
    setTimeout(() => console.log('TIMER FIRED'), 100);
    const instance = render(h(Quitter));
    out({ ...(await settle(instance)), exitCode: process.exitCode ?? null });
    process[member](3);
    break;
  }
  // the hook fence: press x and the app fails
  case 'fence-hook': {
    const { mod } = await runFence(fences[2]);
    const { mount } = await import('../lib/harness.mjs');
    const app = mount(h(mod.App));
    await app.flush();
    const settled = settle(app.instance);
    await app.press('x');
    out({ ...(await settled), exitCode: process.exitCode ?? null });
    break;
  }
  // the call-site fence: Ink exits with an error, or without one
  case 'fence-call-site-error':
  case 'fence-call-site-resolves': {
    const { app, done } = runFenceAndCapture(fences[3]);
    const mounted = await app;
    await mounted.flush();
    // the fence's App never exits, so swap in a root that does
    await mounted.rerender(h(Quitter, { args: scenario === 'fence-call-site-error' ? [new Error('exit failed')] : [] }));
    await done;
    out({ exitCode: process.exitCode ?? null });
    break;
  }
  default:
    throw new Error(`unknown scenario ${scenario}`);
}
