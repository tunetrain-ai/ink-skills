// Shared fixtures for the ink-app-architecture claims.
import { runIsolated } from '../lib/index.mjs';

// What a process does when an Ink app exits is process state: each scenario runs in its own child
// (tests/probes/ink-app-architecture-exit.mjs) and the real exit status is read from outside.
// Results are cached because several claims read the same run. `path: 'inherit'` because the
// fence scenarios transpile the fences with tsc.
const runs = new Map();
export function exitProbe(scenario, member = '') {
  const key = `${scenario}:${member}`;
  if (!runs.has(key)) {
    runs.set(
      key,
      runIsolated({ probe: 'ink-app-architecture-exit', args: [scenario, member], path: 'inherit', timeout: 40_000 }).then((run) => {
        if (!run.json) throw new Error(`exit probe "${scenario}" printed no result:\n${run.stdout}\n${run.stderr}`);
        return run;
      }),
    );
  }
  return runs.get(key);
}

/** The first `new Error('…')` message written in a fence. */
export const errorMessageIn = (fence) => fence.code.match(/new Error\('([^']+)'\)/)[1];
