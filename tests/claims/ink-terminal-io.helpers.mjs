// Shared fixtures for the ink-terminal-io claims (and the lifecycle claims that need a real terminal).
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, h, mount, screenOf } from '../lib/index.mjs';

const PROBES = join(ROOT, 'tests', 'probes');

// ---------------------------------------------------------------------------
// a real pseudo-terminal
// ---------------------------------------------------------------------------

/**
 * Run `argv` on a real pty (tests/probes/ink-terminal-io-pty.py, which needs only python3): the
 * child sees a genuine TTY on stdin, stdout and stderr, a controlling terminal, and receives
 * SIGWINCH when `resize()` changes the window size.
 *
 * `output()` is everything the child wrote; `waitFor(pattern)` resolves once it has matched.
 * `end` resolves `{code, signal}` when the child has exited.
 */
export function ptyRun({ argv, cols = 80, rows = 24, env = {}, cwd = ROOT, timeout = 20_000 }) {
  const driver = join(PROBES, 'ink-terminal-io-pty.py');
  const child = spawn('python3', [driver, String(cols), String(rows), cwd, JSON.stringify(env), ...argv], { stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '';
  let buffer = '';
  let exit = null;
  let stderr = '';
  const watchers = new Set();
  const settle = () => {
    for (const watcher of [...watchers]) watcher.check();
  };
  child.stderr.on('data', (data) => (stderr += data));
  child.stdout.on('data', (data) => {
    buffer += data;
    for (let at = buffer.indexOf('\n'); at !== -1; at = buffer.indexOf('\n')) {
      const line = buffer.slice(0, at);
      buffer = buffer.slice(at + 1);
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      if ('out' in event) output += event.out;
      else exit = { code: event.exit, signal: event.signal };
    }
    settle();
  });
  const send = (message) => child.stdin.writable && child.stdin.write(`${JSON.stringify(message)}\n`);
  const timer = setTimeout(() => child.kill('SIGKILL'), timeout);

  const end = new Promise((resolve, reject) => {
    child.on('error', (error) => reject(new Error(`could not start python3 for the pty driver: ${error.message}`)));
    child.on('close', () => {
      clearTimeout(timer);
      if (!exit) reject(new Error(`pty driver ended without an exit report\n${stderr}\n${output}`));
      else resolve(exit);
      settle();
    });
  });
  end.catch(() => {});

  return {
    output: () => output,
    end,
    write: (text) => send({ write: text }),
    resize: (columns, rowCount) => send({ resize: [columns, rowCount] }),
    /** Resolve with the match once `pattern` (RegExp or string) is in the output after `from`. */
    waitFor(pattern, { from = 0 } = {}) {
      const test = (text) => (pattern instanceof RegExp ? text.slice(from).match(pattern) : text.slice(from).includes(pattern) ? [pattern] : null);
      return new Promise((resolve, reject) => {
        const watcher = {
          check() {
            const found = test(output);
            if (found) {
              watchers.delete(watcher);
              resolve(found);
            } else if (exit) {
              watchers.delete(watcher);
              reject(new Error(`the process exited before ${pattern} appeared:\n${JSON.stringify(output)}`));
            }
          },
        };
        watchers.add(watcher);
        watcher.check();
      });
    },
    kill: () => child.kill('SIGKILL'),
  };
}

/** Lines the tty probe logs (`@@ …`), without the terminal's carriage returns. */
export const logged = (run) => [...run.output().matchAll(/@@ ([^\r\n]*)/g)].map((match) => match[1]);

// ---------------------------------------------------------------------------
// a process with no terminal at all
// ---------------------------------------------------------------------------

/**
 * Run tests/probes/<probe>.mjs with piped stdio in its own session (`detached`): unlike a plain
 * child it has no controlling terminal, so nothing can answer a size query through /dev/tty.
 */
export function runDetached({ probe, env = {}, args = [], timeout = 15_000 }) {
  const file = join(PROBES, `${probe}.mjs`);
  if (!existsSync(file)) throw new Error(`no probe: ${probe}`);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], {
      cwd: ROOT,
      env: { PATH: '', HOME: process.env.HOME ?? '', TMPDIR: process.env.TMPDIR ?? '/tmp', ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => (stdout += data));
    child.stderr.on('data', (data) => (stderr += data));
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`probe "${probe}" timed out\n${stdout}\n${stderr}`));
    }, timeout);
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      const last = stdout.split('\n').reverse().find((line) => line.trim().startsWith('{'));
      resolve({ code, stdout, stderr, json: last ? JSON.parse(last) : null });
    });
    child.stdin.end();
  });
}

// ---------------------------------------------------------------------------
// a tiny cursor model: where does the terminal cursor end up after these bytes?
// ---------------------------------------------------------------------------

/**
 * Follow newlines, cursor-up/down (CUU/CUD) and cursor-to-column (CHA) through `bytes`, starting
 * with the cursor on row 0, column 0. Everything else (colours, mode switches, erasing) is ignored.
 * @returns {{row: number, column: number, visible: boolean}}
 */
export function cursorAfter(bytes) {
  let row = 0;
  let column = 0;
  let visible = true;
  const text = String(bytes);
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\x1b') {
      const match = text.slice(i).match(/^\x1b\[([0-9;?]*)([A-Za-z])/);
      if (match) {
        const [sequence, params, final] = match;
        const n = Number(params || 1);
        if (final === 'A') row -= n;
        else if (final === 'B') row += n;
        else if (final === 'G') column = n - 1;
        else if (final === 'h' && params === '?25') visible = true;
        else if (final === 'l' && params === '?25') visible = false;
        i += sequence.length - 1;
      }
      continue;
    }
    if (text[i] === '\n') {
      row++;
      column = 0;
    } else if (text[i] === '\r') column = 0;
    else column++;
  }
  return { row, column, visible };
}

export { h, mount, screenOf };
