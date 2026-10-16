// Stands in for 'ink' in a fence run (see ink-fullscreen-layouts.helpers.mjs): like tests/lib/fence-shim.mjs,
// but hands the fence's own render options on to ink.render. (The stock shim passes them to mount() as
// top-level options, where only `columns`, `rows`, `isTTY`, `debug` and `render` are read, so an
// option such as `alternateScreen` would be dropped.)
export * from 'ink';
export const render = (element, options) => globalThis.__FENCE_RENDER__(element, { render: options });
