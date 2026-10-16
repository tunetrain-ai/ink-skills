// Shared fixtures for the ink-accessibility claims.
import { mount, readPackageFile } from '../lib/index.mjs';

/**
 * What Ink writes for `element`, as the last frame: debug mode writes every frame whole, so there
 * are no cursor sequences around it. `screenReader` is the `isScreenReaderEnabled` render option;
 * `null` leaves the option out (the environment variable then decides).
 */
export async function frame(element, { screenReader = true, columns = 80 } = {}) {
  const render = screenReader === null ? {} : { isScreenReaderEnabled: screenReader };
  const app = mount(element, { debug: true, columns, render });
  await app.flush();
  const out = app.stdout.writes.filter(Boolean).at(-1) ?? '';
  await app.unmount();
  return out;
}

/** The literals Ink's declaration allows for `aria-role`. */
export const declaredRoles = () => [...readPackageFile('ink', 'build/components/Box.d.ts').match(/'aria-role'\?: ([^;]+);/)[1].matchAll(/'(\w+)'/g)].map((m) => m[1]);

/** The keys Ink's declaration allows in `aria-state`. */
export const declaredStates = () => [...readPackageFile('ink', 'build/components/Box.d.ts').match(/'aria-state'\?: \{([^}]+)\}/)[1].matchAll(/readonly (\w+)\?: boolean/g)].map((m) => m[1]);

/** Run `fn` with an environment variable set (or removed when `value` is undefined), then restore it. */
export async function withEnv(name, value, fn) {
  const before = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    return await fn();
  } finally {
    if (before === undefined) delete process.env[name];
    else process.env[name] = before;
  }
}
