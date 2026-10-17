// Self-test probe: reports what a child process sees after fake-tty.mjs ran.
import chalk from 'chalk';
import isInCi from 'is-in-ci';
console.log(JSON.stringify({
  chalkLevel: chalk.level,
  isInCi,
  isTTY: process.stdout.isTTY ?? false,
  columns: process.stdout.columns ?? null,
  rows: process.stdout.rows ?? null,
  ci: process.env.CI ?? null,
  path: process.env.PATH,
}));
