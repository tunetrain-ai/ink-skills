// `ink-testing-library` as the skill's fences import it, plus a record of every instance `render()`
// returned: a fence's destructured `const {lastFrame, stdin} = render(...)` is not reachable from
// outside the module, but its instance is.
import * as real from 'ink-testing-library';

export const instances = (globalThis.__ITL_INSTANCES__ ??= []);

export const render = (tree) => {
  const instance = real.render(tree);
  instances.push(instance);
  return instance;
};

export const cleanup = real.cleanup;
