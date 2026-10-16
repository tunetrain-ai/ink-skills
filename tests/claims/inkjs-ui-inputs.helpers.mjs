// Shared fixtures for the @inkjs/ui claims (inkjs-ui-inputs, -feedback, -lists, -theming).
import { readFileSync } from 'node:fs';
import { h, mount, keys, ink, waitFor, stripAnsi } from '../lib/index.mjs';
import { loadFile } from '../lib/claims.mjs';
import * as ui from '@inkjs/ui';

export { ui, h, mount, keys, ink, waitFor, stripAnsi };

/** Mount `element` and let it settle. */
export async function open(element, opts) {
  const app = mount(element, opts);
  await app.flush();
  return app;
}

/** Type each argument as its own keystroke. */
export const type = (app, ...chars) => app.press(...chars);

/** Everything the app has written, with the ANSI escape sequences left in. */
export const bytesOf = (app) => app.bytes();

/** A callback that remembers its calls: `calls` is a list of argument arrays. */
export function spy() {
  const calls = [];
  const fn = (...args) => {
    calls.push(args);
  };
  fn.calls = calls;
  return fn;
}

/** Run `fn` while `console.log` is replaced by a recorder; returns what was logged (one argument list per call). */
export async function captureConsole(fn) {
  const logged = [];
  const original = console.log;
  console.log = (...args) => {
    logged.push(args);
  };
  try {
    await fn(logged);
  } finally {
    console.log = original;
  }
  return logged;
}

/** The raw markdown of a skill file (the claims read lists out of the skill text instead of retyping them). */
export const skillText = (skillName, file = 'SKILL.md') => loadFile(skillName, file).raw.replace(/\s+/g, ' ');

/** Lines of the visible screen. */
export const lines = (app) => app.screen().split('\n');

/** Package metadata of an installed @inkjs/ui declaration file. */
export const uiFile = (path) => readFileSync(new URL(`../../node_modules/@inkjs/ui/build/${path}`, import.meta.url), 'utf8');

/** `'confirm' | 'cancel'` -> ['confirm', 'cancel']; `'x'` -> ['x'] (quotes stripped). */
export const literals = (union) => union.split(' | ').map((member) => member.replace(/^'|'$/g, ''));
