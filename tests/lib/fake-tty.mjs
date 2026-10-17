// Preloaded (`node --import`) into probe subprocesses. Makes the child believe it has (or
// has not) a terminal, because libraries such as supports-color call tty.isatty(fd) and
// Ink reads process.stdout.isTTY / columns / rows — neither can be faked from outside.
//
// INK_TEST_TTY is JSON: {isTTY?: boolean, columns?: number, rows?: number, stdin?: boolean}
import tty from 'node:tty';

const cfg = JSON.parse(process.env.INK_TEST_TTY || '{}');
const isTTY = Boolean(cfg.isTTY);
const stdinTTY = cfg.stdin ?? isTTY;
const realIsatty = tty.isatty.bind(tty);

tty.isatty = (fd) => (fd === 1 || fd === 2 ? isTTY : fd === 0 ? stdinTTY : realIsatty(fd));

function define(stream, name, value) {
  Object.defineProperty(stream, name, { value, configurable: true, writable: true });
}
for (const stream of [process.stdout, process.stderr]) {
  define(stream, 'isTTY', isTTY ? true : undefined);
  if (isTTY && cfg.columns) define(stream, 'columns', cfg.columns);
  if (isTTY && cfg.rows) define(stream, 'rows', cfg.rows);
}
if (stdinTTY) {
  define(process.stdin, 'isTTY', true);
  if (typeof process.stdin.setRawMode !== 'function') define(process.stdin, 'setRawMode', () => process.stdin);
}
