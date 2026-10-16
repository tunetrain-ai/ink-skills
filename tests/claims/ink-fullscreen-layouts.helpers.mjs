// Shared fixtures for the ink-fullscreen-layouts claims.
import { pathToFileURL, fileURLToPath } from 'node:url';
import { h, ink, mount, screenOf } from '../lib/index.mjs';

const SHIM = pathToFileURL(fileURLToPath(new URL('./ink-fullscreen-layouts.render-shim.mjs', import.meta.url))).href;

/**
 * Run a fence as written, with the options its `render(...)` call passes reaching Ink itself.
 * @param {ReturnType<typeof import('../lib/index.mjs').skill>} s
 */
export function runFenceWithRenderOptions(s, file, nth, opts = {}) {
  const useOptionsShim = [/from\s+(['"])file:[^'"]*fence-shim\.mjs\1/, `from '${SHIM}'`];
  return s.runFence(file, nth, { ...opts, replace: [useOptionsShim, ...(opts.replace ?? [])] });
}

/** The escape sequence a skill writes as `\x1b[?1049h` (backslash-x text), as the bytes Ink writes. */
export const escapeOf = (text) => text.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

/** Bytes of a frame stream with the synchronized-output and cursor-visibility modes removed. */
export const withoutModes = (bytes) => bytes.replace(/\x1b\[\?(?:2026[hl]|25[lh])/g, '');

export { h, ink, mount };

/**
 * What the terminal shows after everything an app wrote. The harness's screen model does not know the
 * sequence Ink uses to repaint a frame that is as tall as the terminal (cursor home, then erase down),
 * so the screen is rebuilt from the last such repaint on.
 */
export function screenNow(app) {
  const repaint = '\x1b[1;1H\x1b[J';
  const bytes = app.bytes();
  const at = bytes.lastIndexOf(repaint);
  return screenOf(at === -1 ? bytes : bytes.slice(at + repaint.length));
}
