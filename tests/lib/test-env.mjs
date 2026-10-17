// The environment every test process runs in. Ink reads `is-in-ci` once, at import, and
// chalk/supports-color read the environment once too, so the same suite would behave
// differently on a laptop and on GitHub Actions (CI=true, GITHUB_ACTIONS). Built from scratch.
export function testEnv(extra = {}) {
  return {
    PATH: process.env.PATH ?? '',
    HOME: process.env.HOME ?? '',
    TMPDIR: process.env.TMPDIR ?? '/tmp',
    // CI must be ABSENT, not empty: is-in-ci tests `'CI' in env`, so CI='' still counts as CI
    // (and Ink then writes only a final frame). Same for CONTINUOUS_INTEGRATION and CI_*.
    FORCE_COLOR: '3',
    COLORTERM: 'truecolor', // FORCE_COLOR is only a minimum: TERM=xterm-256color alone yields level 2
    TERM: 'xterm-256color',
    NODE_NO_WARNINGS: '1',
    ...extra,
  };
}
