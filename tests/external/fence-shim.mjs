// Test shim for tests/lib/fence-run.mjs: Ink, with render() sent to the recording harness.
export * from 'ink';
export const render = (element, options) => globalThis.__FENCE_RENDER__(element, options);
