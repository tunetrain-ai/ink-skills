// Claims for skills/patterns/ink-app-architecture/SKILL.md.
import { builtinModules } from 'node:module';
import { parseArgs } from 'node:util';
import { skill, ink, React, h, mount, keys, waitFor, runFence, externalHarness, extImport, extReadFile, extPkg, pkg } from '../lib/index.mjs';
import { exitProbe, errorMessageIn } from './ink-app-architecture.helpers.mjs';

const s = skill('ink-app-architecture');
const F = 'SKILL.md';
const { Text } = ink;

/** react-router mounted on the external project's own Ink and React. */
async function router() {
  const ext = await externalHarness();
  const rr = await extImport('react-router');
  return { ext, rr, h: ext.h, Text: ext.ink.Text, useInput: ext.ink.useInput };
}

/** What the router thinks the location is, in a mounted app. */
async function locationAt(props, columns = 40) {
  const { ext, rr } = await router();
  const Where = () => ext.h(ext.ink.Text, null, rr.useLocation().pathname);
  const app = ext.mount(ext.h(rr.MemoryRouter, props, ext.h(Where)), { columns });
  await app.flush();
  return app.screen();
}

// ===================================================================== description

s.guidance(
  F,
  ["Structure a real Ink CLI beyond a single component — multi-screen navigation with React Router's MemoryRouter, parsing command-line arguments and flags, and setting the process exit code correctly."],
  'the topics the skill covers; each is proven where it is taught below, and the sentence itself asserts nothing about behaviour',
);

s.guidance(F, ['Use when starting a nontrivial Ink app or asking how to add screens/routes/flags to one.'], 'a trigger for loading the skill; it asserts nothing about behaviour');

// ===================================================================== multi-screen navigation

s.fact(F, ['Ink has no router of its own — screens are just conditional rendering, same as any React app.'], { kind: 'D' }, async (t) => {
  const { rr } = await router();
  const names = ['MemoryRouter', 'Routes', 'Route', 'Link', 'useNavigate', 'useLocation'];
  for (const name of names) t.ok(name in rr, `react-router exports ${name}`);
  const routing = /router|route|navigat|location|history|^link$/i;
  t.deepEqual(Object.keys(ink).filter((name) => routing.test(name)), [], 'nothing Ink exports is a router, a route, a link or a navigation hook');
  // screens as conditional rendering
  const Screens = () => {
    const [screen, setScreen] = React.useState('home');
    ink.useInput((_input, key) => key.return && setScreen((current) => (current === 'home' ? 'about' : 'home')));
    return screen === 'home' ? h(Text, null, 'Home') : h(Text, null, 'About');
  };
  const app = mount(h(Screens));
  await app.flush();
  t.equal(app.screen(), 'Home');
  await app.press(keys.enter);
  t.equal(app.screen(), 'About', 'a state value and an if are enough to switch screens');
});

s.guidance(
  F,
  ["For anything beyond a couple of `if`/state-driven screens, use [React Router](https://reactrouter.com)'s"],
  'a recommendation about when a router pays off; the behaviour that makes MemoryRouter fit a terminal is proven in the claim for the rest of the sentence. `if` is the keyword of the conditional rendering the sentence contrasts it with, not an API',
  { exempt: ['if'] },
);

s.fact(F, ['`MemoryRouter`: it keeps the navigation stack in memory, while `BrowserRouter` needs a browser and throws `document is not defined` in Node.'], { kind: 'R' }, async (t, q) => {
  const { ext, rr } = await router();
  const Memory = q.api(rr, 'MemoryRouter');
  const Browser = q.api(rr, 'BrowserRouter');
  t.equal(globalThis.document, undefined, 'there is no document in this process');
  t.equal(globalThis.window, undefined, 'and no window');
  let navigate;
  const Nav = () => {
    navigate = rr.useNavigate();
    return ext.h(ext.ink.Text, null, rr.useLocation().pathname);
  };
  const app = ext.mount(ext.h(Memory, { initialEntries: ['/a'] }, ext.h(Nav)), { columns: 40 });
  await app.flush();
  navigate('/b');
  await app.flush();
  t.equal(app.screen(), '/b');
  navigate(-1);
  await app.flush();
  t.equal(app.screen(), '/a', 'the stack lives in memory: going back works with no browser');
  const error = ext.catchRenderError(ext.h(Browser, null, ext.h(ext.ink.Text, null, 'x')));
  t.ok(error, 'BrowserRouter fails to render');
  t.ok(error.message.includes(q.tok('document is not defined')), `with "${error?.message}"`);
});

s.fence(F, 0, {
  run: async (t, fence) => {
    const { apps } = await runFence(fence);
    const app = apps[0];
    await app.flush();
    t.equal(app.screen(), 'Home. Press Enter to go to About.');
    await app.press(keys.enter);
    t.equal(app.screen(), 'About. Press Enter to go back Home.', 'Enter on Home navigates to About');
    await app.press(keys.enter);
    t.equal(app.screen(), 'Home. Press Enter to go to About.', 'and Enter on About navigates back');
  },
});

s.guidance(F, ["Three things that don't carry over from web routing:"], 'a lead-in to the three bullets below; each bullet is proven by its own claim');

s.fact(F, ['**No `<Link>`** — it renders an `<a>` element that Ink does not draw: text inside it throws, and a `<Text>` inside it produces no output.'], { kind: 'R', ctx: ['No `<Link>`'] }, async (t, q) => {
  const { ext, rr } = await router();
  const Link = q.el(rr, '<Link>');
  const Label = q.el(ext.ink, '<Text>');
  const tag = q.tok('<a>').slice(1, -1);
  let host;
  const app = ext.mount(ext.h(rr.MemoryRouter, null, ext.h(Link, { to: '/x', ref: (node) => node && (host = node) }, ext.h(Label, null, 'go'))), { columns: 40 });
  await app.flush();
  t.equal(host.nodeName, tag, 'the element Link renders is an <a>');
  t.equal(app.screen(), '', 'a <Text> inside it is not drawn');
  const plain = ext.mount(ext.h(Label, null, 'go'), { columns: 40 });
  await plain.flush();
  t.equal(plain.screen(), 'go', 'while the same <Text> on its own is');
  const message = /Text string "go" must be rendered inside <Text> component/;
  t.match(ext.catchRenderError(ext.h(rr.MemoryRouter, null, ext.h(Link, { to: '/x' }, 'go')))?.message, message, 'a text child throws');
  t.match(ext.catchRenderError(ext.h(rr.MemoryRouter, null, ext.h(Label, null, ext.h(Link, { to: '/x' }, 'go'))))?.message, message, 'even inside a <Text>');
});

s.fact(F, ['Navigate with `useNavigate()` everywhere.'], { kind: 'R' }, async (t, q) => {
  const { ext, rr } = await router();
  const useNavigate = q.api(rr, 'useNavigate()');
  // two levels below the routes, in a component that knows nothing about them
  const Button = () => {
    const navigate = useNavigate();
    ext.ink.useInput((_input, key) => key.return && navigate('/next'));
    return ext.h(ext.ink.Text, null, 'press enter');
  };
  const Panel = () => ext.h(ext.ink.Box, null, ext.h(Button));
  const app = ext.mount(
    ext.h(rr.MemoryRouter, null, ext.h(rr.Routes, null, ext.h(rr.Route, { path: '/', element: ext.h(Panel) }), ext.h(rr.Route, { path: '/next', element: ext.h(ext.ink.Text, null, 'next screen') }))),
    { columns: 40 },
  );
  await app.flush();
  t.equal(app.screen(), 'press enter');
  await app.press(keys.enter);
  t.equal(app.screen(), 'next screen', 'a component deep in the tree changes the screen through the hook alone');
});

s.fact(F, ['`MemoryRouter` starts at `"/"` by default; pass `initialEntries` to start elsewhere (e.g. resuming at a route based on a CLI flag).'], { kind: 'D' }, async (t, q) => {
  const { ext, rr } = await router();
  const Memory = q.api(rr, 'MemoryRouter');
  const start = JSON.parse(q.tok('"/"'));
  const entries = q.tok('initialEntries');
  const where = async (props) => {
    const Where = () => ext.h(ext.ink.Text, null, rr.useLocation().pathname);
    const app = ext.mount(ext.h(Memory, props, ext.h(Where)), { columns: 40 });
    await app.flush();
    return app.screen();
  };
  t.equal(await where({}), start, 'with no entries the location is the root');
  t.equal(await where({ [entries]: ['/about'] }), '/about', 'with initialEntries it starts there');
  // a route chosen by a parsed flag
  const meow = (await extImport('meow')).default;
  const cli = meow('', { importMeta: import.meta, argv: ['--screen', 'about'], flags: { screen: { type: 'string' } } });
  const Screens = ext.h(rr.Routes, null, ext.h(rr.Route, { path: '/', element: ext.h(ext.ink.Text, null, 'Home') }), ext.h(rr.Route, { path: '/about', element: ext.h(ext.ink.Text, null, 'About') }));
  const resumed = ext.mount(ext.h(Memory, { [entries]: [`/${cli.flags.screen}`] }, Screens), { columns: 40 });
  await resumed.flush();
  t.equal(resumed.screen(), 'About', 'built from a CLI flag it resumes on that screen');
  const fresh = ext.mount(ext.h(Memory, null, Screens), { columns: 40 });
  await fresh.flush();
  t.equal(fresh.screen(), 'Home', 'and without it the first screen shows');
});

s.fact(F, ["Routes aren't URLs: `<Routes>` renders only the element of the route that matches the in-memory location, and the screen you leave is unmounted."], { kind: 'R' }, async (t, q) => {
  const { ext, rr } = await router();
  const Routes = q.el(rr, '<Routes>');
  const log = [];
  // two different components: React would keep one instance alive across two routes of the same type
  const page = (name) => () => {
    ext.React.useEffect(() => {
      log.push(`mount ${name}`);
      return () => log.push(`unmount ${name}`);
    }, []);
    return ext.h(ext.ink.Text, null, name);
  };
  const Home = page('home');
  const About = page('about');
  let navigate;
  const Nav = () => {
    navigate = rr.useNavigate();
    return null;
  };
  const app = ext.mount(
    ext.h(rr.MemoryRouter, null, ext.h(Nav), ext.h(Routes, null, ext.h(rr.Route, { path: '/', element: ext.h(Home) }), ext.h(rr.Route, { path: '/about', element: ext.h(About) }))),
    { columns: 40 },
  );
  await app.flush();
  t.equal(app.screen(), 'home', 'only the route that matches the location is rendered');
  await waitFor(() => log.includes('mount home'));
  navigate('/about');
  await app.flush();
  t.equal(app.screen(), 'about', 'after navigating, only the new one');
  await waitFor(() => log.includes('unmount home') && log.includes('mount about'));
  t.deepEqual(log, ['mount home', 'unmount home', 'mount about'], 'the screen that was left was unmounted');
  navigate('/nowhere');
  await app.flush();
  t.equal(app.screen(), '', 'a path that no route matches renders nothing: it is matched against a string, not fetched');
});

s.fact(F, ["A linear wizard (step 1 → step 2 → done) doesn't need a router: a `useState` holding a `step` value shows one screen at a time."], { kind: 'R', ctx: ['step'] }, async (t, q) => {
  const useState = q.api(React, 'useState');
  const first = Number(q.tok('1'));
  const second = Number(q.tok('2'));
  const Wizard = () => {
    const [step, setStep] = useState(first);
    ink.useInput((_input, key) => key.return && setStep((current) => (current === second ? 'done' : current + 1)));
    return h(Text, null, step === 'done' ? 'done' : `step ${step}`);
  };
  const app = mount(h(Wizard));
  await app.flush();
  t.equal(app.screen(), `step ${q.tok('1')}`);
  await app.press(keys.enter);
  t.equal(app.screen(), `step ${q.tok('2')}`);
  await app.press(keys.enter);
  t.equal(app.screen(), 'done');
});

s.fact(
  F,
  ['`MemoryRouter` adds a history stack (`navigate(-1)` goes back), deep links via `initialEntries`, and nested routes (a parent route renders its children through `<Outlet />`).'],
  { kind: 'R' },
  async (t, q) => {
    const { ext, rr } = await router();
    const Memory = q.api(rr, 'MemoryRouter');
    const Outlet = q.el(rr, '<Outlet />');
    const entries = q.tok('initialEntries');
    const back = Number(q.tok('navigate(-1)').match(/\((.*)\)/)[1]);
    let navigate;
    const Nav = () => {
      navigate = rr.useNavigate();
      return ext.h(ext.ink.Text, null, rr.useLocation().pathname);
    };
    const history = ext.mount(ext.h(Memory, null, ext.h(Nav)), { columns: 40 });
    await history.flush();
    for (const path of ['/a', '/b', '/c']) {
      navigate(path);
      await history.flush();
    }
    t.equal(history.screen(), '/c');
    const goBack = q.api({ navigate }, 'navigate(-1)');
    goBack(back);
    await history.flush();
    t.equal(history.screen(), '/b', 'navigate(-1) goes back one entry of the stack');
    // deep link, and nesting: the parent route renders the child through its Outlet
    const Layout = () => ext.h(ext.ink.Box, { flexDirection: 'column' }, ext.h(ext.ink.Text, null, 'settings'), ext.h(Outlet));
    const nested = ext.mount(
      ext.h(Memory, { [entries]: ['/settings/profile'] }, ext.h(rr.Routes, null, ext.h(rr.Route, { path: '/settings', element: ext.h(Layout) }, ext.h(rr.Route, { path: 'profile', element: ext.h(ext.ink.Text, null, 'profile') })))),
      { columns: 40 },
    );
    await nested.flush();
    t.equal(nested.screen(), 'settings\nprofile', 'starting on a nested path shows the parent with the child inside it');
  },
);

// ===================================================================== parsing arguments and flags

s.fact(F, ['Ink renders UI; it has no opinion on argument parsing.'], { kind: 'D' }, async (t) => {
  const parsing = /^(parse|args?|argv|flags?|options?|command|cli)/i;
  t.deepEqual(Object.keys(ink).filter((name) => parsing.test(name)), [], 'nothing Ink exports parses arguments or flags');
  const parsers = ['meow', 'yargs', 'commander', 'minimist', 'yargs-parser', 'arg', 'cac', 'mri'];
  t.deepEqual(Object.keys(pkg('ink').dependencies).filter((name) => parsers.includes(name)), [], 'and it depends on no argument parser');
  // positive controls: both filters do pick out a parser where there is one
  t.ok(Object.keys(await import('node:util')).filter((name) => parsing.test(name)).includes('parseArgs'), 'node:util exports one');
  t.deepEqual(Object.keys(extPkg('create-ink-app').dependencies).filter((name) => parsers.includes(name)), ['meow'], 'and create-ink-app depends on one');
});

s.fact(
  F,
  ['`create-ink-app` scaffolds its projects with [`meow`](https://github.com/sindresorhus/meow), a CLI app helper, for arguments and flags; Node\'s built-in `util.parseArgs` does the same job without a dependency.'],
  { kind: 'X' },
  async (t, q) => {
    const generator = q.tok('create-ink-app');
    const parser = q.tok('meow');
    const [ns, member] = q.tok('util.parseArgs').split('.');
    for (const language of ['ts', 'js']) {
      const manifest = JSON.parse(extReadFile(generator, `templates/${language}/_package.json`).replace('%NAME%', 'app'));
      t.ok(manifest.dependencies[parser], `the ${language} template depends on ${parser}`);
      const cli = extReadFile(generator, `templates/${language}/source/cli.${language === 'ts' ? 'tsx' : 'js'}`);
      t.match(cli, new RegExp(`import ${parser} from '${parser}'`), `and its cli imports it`);
      t.match(cli, /cli\.flags\.name/, 'to read a flag');
    }
    t.equal(extPkg(parser).description, 'CLI app helper', `${parser} describes itself as a CLI app helper`);
    // the built-in does the same job: positionals and --flags, no package needed
    t.ok(builtinModules.includes(ns), `${ns} is a built-in module`);
    const { values, positionals } = (await import(`node:${ns}`))[member]({ args: ['--name', 'Ada', 'file.txt'], options: { name: { type: 'string' } }, allowPositionals: true });
    t.equal(values.name, 'Ada', 'it parses a flag');
    t.deepEqual(positionals, ['file.txt'], 'and the positional arguments');
    t.equal(parseArgs, (await import(`node:${ns}`))[member], 'the one the skill names');
    const meow = (await extImport(parser)).default;
    const cli = meow('', { importMeta: import.meta, argv: ['--name', 'Ada', 'file.txt'], flags: { name: { type: 'string' } } });
    t.equal(cli.flags.name, 'Ada', 'and meow produces the same flag');
    t.deepEqual(cli.input, ['file.txt'], 'and input');
  },
);

s.fact(F, ['Parse args *before* calling `render()`, then pass the results in as props:'], { kind: 'R' }, async (t, q) => {
  q.api(ink, 'render()');
  const props = [];
  const stub = `
import React from 'react';
import {Text} from 'ink';
export default function App(properties) {
  globalThis.__APP_PROPS__ = properties;
  return React.createElement(Text, null, 'name=' + properties.name + ' input=' + properties.input.join(','));
}
`;
  const argv = process.argv;
  process.argv = [argv[0], 'my-cli', '--name', 'Ada', 'file.txt'];
  let run;
  try {
    run = await s.runFence(F, 1, { stubs: { './app.js': stub } });
  } finally {
    process.argv = argv;
  }
  const app = run.apps[0];
  await app.flush();
  props.push(globalThis.__APP_PROPS__);
  t.deepEqual(props[0], { name: 'Ada', input: ['file.txt'] }, 'the parsed flag and the positional arguments reach the root component as props');
  t.equal(app.screen(), 'name=Ada input=file.txt');
  delete globalThis.__APP_PROPS__;
});

s.fence(F, 1);

// ===================================================================== exit codes

s.fact(
  F,
  ["Ink's `exit()` (from `useApp()`) controls when `waitUntilExit()` settles and whether it resolves or rejects — it does **not** by itself set the process's exit code."],
  { kind: 'R', ctx: ['not'], timeout: 40_000 },
  async (t, q) => {
    const useApp = q.api(ink, 'useApp()');
    const exitName = q.tok('exit()').slice(0, -2);
    const waitName = q.tok('waitUntilExit()').slice(0, -2);
    // when it settles: not before exit() is called, and exit() is what ends it
    let hooks;
    const Capture = () => {
      hooks = useApp();
      return h(Text, null, 'running');
    };
    const app = mount(h(Capture));
    await app.flush();
    t.equal(typeof hooks[exitName], 'function', 'useApp() returns exit');
    let settled = false;
    const waiting = app.instance[waitName]().then(() => (settled = true));
    await app.flush();
    t.equal(settled, false, 'waitUntilExit() is still pending while the app runs');
    hooks[exitName]();
    await waiting;
    t.equal(settled, true, 'and exit() settles it');
    // resolves or rejects, and the process exit code is left alone: real child processes
    const resolved = await exitProbe('exit');
    t.equal(resolved.json.settled, 'resolved', 'exit() resolves waitUntilExit()');
    t.equal(resolved.json.exitCode, null, 'process.exitCode is still unset');
    t.equal(resolved.code, 0, 'and the process ends with status 0');
    const rejected = await exitProbe('exit-error');
    t.deepEqual([rejected.json.settled, rejected.json.message], ['rejected', 'boom'], 'exit(error) rejects it with the error');
    t.equal(rejected.json.exitCode, null, 'process.exitCode is still unset');
    t.equal(rejected.code, 0, 'and a caught rejection leaves the status at 0');
  },
);

s.fact(
  F,
  ["For a CLI that needs a specific exit code on failure, set `process.exitCode` before exiting. Unlike `process.exit(code)`, which terminates immediately, it lets the process finish what is still scheduled:"],
  { kind: 'R', timeout: 40_000 },
  async (t, q) => {
    const property = q.tok('process.exitCode').split('.')[1];
    const method = q.tok('process.exit(code)').match(/^process\.(\w+)\(/)[1];
    const viaProperty = await exitProbe('exit-code', property);
    t.equal(viaProperty.code, 3, 'the process ends with the status that was set');
    t.equal(viaProperty.json.exitCode, 3);
    t.match(viaProperty.stdout, /TIMER FIRED/, 'and the timer that was still pending ran first');
    const viaExit = await exitProbe('process-exit', method);
    t.equal(viaExit.code, 3, 'process.exit(3) ends with the status too');
    t.doesNotMatch(viaExit.stdout, /TIMER FIRED/, 'but the pending timer never ran');
  },
);

s.fact(F, ['Hooks must run inside a component or another hook.'], { kind: 'R' }, async (t) => {
  const { mod } = await s.runFence(F, 2);
  const originalError = console.error;
  console.error = () => {};
  try {
    t.throws(() => mod.useFatalError(), /while React is rendering/, 'called outside a component the hook throws');
  } finally {
    console.error = originalError;
  }
  const Caller = () => {
    mod.useFatalError();
    return h(Text, null, 'inside a component');
  };
  const app = mount(h(Caller));
  await app.flush();
  t.equal(app.screen(), 'inside a component', 'inside a component it works');
});

s.fact(F, ['rejects waitUntilExit() with `error`'], { kind: 'R', ctx: ['error'], timeout: 40_000 }, async (t) => {
  const fence = s.fenceOf(F, 2);
  const run = await exitProbe('fence-hook');
  t.equal(run.json.settled, 'rejected', 'waitUntilExit() rejects');
  t.equal(run.json.message, errorMessageIn(fence), 'with the error passed to exit()');
  t.equal(run.json.exitCode, 1, 'and process.exitCode, set just before, is 1');
  t.equal(run.code, 1, 'so the process ends with status 1');
});

s.fence(F, 2, {
  run: async (t, fence) => {
    const { mod } = await runFence(fence);
    const app = mount(h(mod.App));
    await app.flush();
    t.equal(app.screen(), 'Press x to fail');
  },
});

s.fact(F, ['At the call site:'], { kind: 'R', timeout: 40_000 }, async (t) => {
  const failed = await exitProbe('fence-call-site-error');
  t.match(failed.stderr, /Error: exit failed/, 'a rejected waitUntilExit() lands in the catch block, which logs the error');
  t.equal(failed.json.exitCode, 1, 'and sets process.exitCode');
  t.equal(failed.code, 1, 'so the process ends with status 1');
  const fine = await exitProbe('fence-call-site-resolves');
  t.equal(fine.json.exitCode, null, 'when waitUntilExit() resolves nothing is set');
  t.equal(fine.code, 0, 'and the process ends with status 0');
});

s.guidance(F, ['`App` stands in for your root component.'], 'a note that the declared App is a placeholder for the reader\'s own root component; it asserts nothing about behaviour. `App` is the fence\'s own identifier', { exempt: ['App'] });

s.fence(F, 3);
