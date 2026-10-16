// Claims for skills/core/ink-input-handling/SKILL.md.
import { useState, useEffect, Fragment } from 'react';
import { skill, tsx, h, ink, mount, keys, waitFor, stripAnsi, readPackageFile } from '../lib/index.mjs';
import { KEY_PROPS, inputApp, receive, stdinApp, written, kittyWrites, kittyApp, plainApp, aliveProbe, skillText, runFenceForwarding, watchExit, handlerParams, kittyModes } from './ink-input-handling.helpers.mjs';

const { Text, useInput, usePaste } = ink;
const s = skill('ink-input-handling');
const F = 'SKILL.md';

/** `{isActive: false}` out of the notation `isActive: false` (a changed name or value changes the object). */
const optionsOf = (notation) => new Function(`return ({${notation}})`)();
/** The value of an expression such as `isActive !== false` or `input === 'c'` for the given variables. */
const evaluate = (expression, vars) => new Function(...Object.keys(vars), `return (${expression})`)(...Object.values(vars));
const unquote = (token) => token.replace(/^'|'$/g, '');

// a component that mounts the given hooks and records every call
function hooksApp({ input, paste, render = {}, mountOptions } = {}) {
  const got = { input: [], paste: [] };
  const Probe = () => {
    if (input) useInput((text, key) => got.input.push({ input: text, key: { ...key } }), input === true ? undefined : input);
    if (paste) usePaste((text) => got.paste.push(text), paste === true ? undefined : paste);
    return h(Text, null, 'probe');
  };
  const app = mount(h(Probe), { ...mountOptions, render });
  return { app, got };
}

// ===================================================================== description

s.fact(
  F,
  ['Handle keyboard input and pasted text in Ink with useInput and usePaste — the key object (arrows, ctrl, meta, shift, return, tab), isActive to scope multiple handlers, raw mode via useStdin, and the optional kitty keyboard protocol for richer key reporting.'],
  { kind: 'R' },
  async (t) => {
    // keyboard input and pasted text arrive in separate hooks
    const { app, got } = hooksApp({ input: true, paste: true });
    await app.flush();
    await app.press('a', keys.paste('pasted'));
    t.deepEqual(got.input.map((c) => c.input), ['a'], 'useInput gets the typed key');
    t.deepEqual(got.paste, ['pasted'], 'usePaste gets the pasted text');
    // the key object
    const [up] = await receive(['\x1b[A']);
    for (const name of ['upArrow', 'downArrow', 'leftArrow', 'rightArrow', 'ctrl', 'meta', 'shift', 'return', 'tab']) t.ok(name in up[0].key, `key.${name} exists`);
    // isActive scopes handlers
    const quiet = hooksApp({ input: { isActive: false } });
    await quiet.app.flush();
    await quiet.app.press('a');
    t.equal(quiet.got.input.length, 0, 'an inactive handler is not called');
    // raw mode through useStdin
    const raw = stdinApp();
    await raw.app.flush();
    raw.seen.setRawMode(true);
    t.deepEqual(raw.app.stdin.rawModeCalls, [true], 'useStdin().setRawMode switches the stream to raw mode');
    // the kitty protocol is optional
    t.deepEqual(kittyWrites(await plainApp()).enabled, [], 'without kittyKeyboard nothing is enabled');
    t.deepEqual(kittyWrites(await plainApp({ kittyKeyboard: { mode: 'enabled' } })).enabled, [1], 'with it the protocol is switched on');
  },
);

s.guidance(F, ['Use for "how do I read a keypress / handle Enter / detect paste / support Ctrl+C" questions.'], 'trigger phrases for when to load the skill; the answers to them are the other claims of this file');

// ===================================================================== useInput

s.fact(
  F,
  ['The standard way to read keyboard input: Ink reads stdin for you, splits it into keypresses and calls the handler with the typed text as `input` and a `key` object for special keys and modifiers (see `ink-terminal-io` for the low-level `useStdin` escape hatch).'],
  { kind: 'R' },
  async (t, q) => {
    const [inputName, keyName] = [q.tok('input'), q.tok('key')];
    // the handler's parameters are named as the text says
    const declared = readPackageFile('ink', 'build/hooks/use-input.d.ts').match(/type Handler = \((\w+): string, (\w+): Key\) => void/);
    t.deepEqual([inputName, keyName], [declared[1], declared[2]], 'Ink declares the handler as (input: string, key: Key)');
    const { app, calls, send } = inputApp();
    await app.flush();
    // Ink reads stdin itself: a readable listener, not a data listener, and a bare data event is ignored
    t.equal(app.stdin.listenerCount('readable'), 1, 'Ink listens for readable on stdin');
    t.equal(app.stdin.listenerCount('data'), 0, 'and not for data');
    app.stdin.emit('data', 'z');
    await app.flush();
    t.equal(calls.length, 0, 'a data event on stdin does not reach the handler');
    // typed text arrives as input, special keys as key flags with empty input
    const [typed] = await send('x');
    t.equal(typed[inputName], 'x');
    const [arrow] = await send('\x1b[A');
    t.equal(arrow[inputName], '');
    t.equal(arrow[keyName].upArrow, true);
    // stdin is split into keypresses: two arrow sequences in one chunk are two calls
    const two = await send('\x1b[A\x1b[B');
    t.deepEqual(two.map((c) => [c.key.upArrow, c.key.downArrow]), [[true, false], [false, true]]);
    // the escape hatch: useStdin gives the stream itself
    const useStdinHook = q.api(ink, 'useStdin');
    let stream;
    const Hatch = () => ((stream = useStdinHook().stdin), h(Text, null, 'hatch'));
    const hatch = mount(h(Hatch));
    await hatch.flush();
    t.equal(stream, hatch.stdin, 'useStdin returns the stdin stream Ink reads');
    const target = skillText(q.tok('ink-terminal-io'));
    t.match(target, new RegExp(`## \`${q.tok('useStdin')}\\(\\)\``), 'and ink-terminal-io documents it');
  },
);

// the fence: its comments mark the two branches, so each run swaps the comment for a marker
async function runUserInputFence(replacements) {
  const hits = [];
  globalThis.__hits = hits;
  const { mod } = await s.runFence(F, 0, { replace: replacements.map(([comment, name]) => [`// ${comment}`, `globalThis.__hits.push('${name}');`]) });
  return { UserInput: mod.UserInput, hits, done: () => delete globalThis.__hits };
}

s.fence(F, 0, {
  run: async (t) => {
    const { mod } = await s.runFence(F, 0);
    const app = mount(h(mod.UserInput));
    await app.flush();
    t.equal(app.screen(), 'Press q to quit', 'the component renders its prompt');
    await app.press('q', keys.left);
    t.equal(app.screen(), 'Press q to quit', 'and handles both keys without complaint');
  },
});

s.fact(F, ['useInput((input, key) => { if (input === \'q\') { // exit program }'], { kind: 'R' }, async (t) => {
  const { UserInput, hits, done } = await runUserInputFence([['exit program', 'q']]);
  try {
    const app = mount(h(UserInput));
    await app.flush();
    await app.press('x');
    t.deepEqual(hits, [], 'another key does not reach the branch');
    await app.press('q');
    t.deepEqual(hits, ['q'], 'pressing q reaches the branch that is commented "exit program"');
  } finally {
    done();
  }
});

s.fact(F, ['if (key.leftArrow) { // left arrow key pressed }'], { kind: 'R' }, async (t) => {
  const { UserInput, hits, done } = await runUserInputFence([['left arrow key pressed', 'left']]);
  try {
    const app = mount(h(UserInput));
    await app.flush();
    await app.press(keys.right);
    t.deepEqual(hits, [], 'the right arrow does not');
    await app.press(keys.left);
    t.deepEqual(hits, ['left'], 'the left arrow reaches the branch that is commented "left arrow key pressed"');
  } finally {
    done();
  }
});

// ---- how often the callback fires ------------------------------------------------------------

s.fact(F, ['The callback fires once **per keypress**.'], { kind: 'R' }, async (t, q) => {
  const unit = { 'per keypress': 'keypress' }[q.tok('per keypress')];
  t.equal(unit, 'keypress', 'the unit is the keypress');
  const { app, calls, send } = inputApp();
  await app.flush();
  const presses = ['a', 'b', '\x1b[A', '\r', '\x7f', '\t', '\x01'];
  for (const press of presses) t.equal((await send(press)).length, 1, `${JSON.stringify(press)} is one call`);
  calls.length = 0;
  await app.press(...presses);
  t.equal(calls.length, presses.length, 'one call for each key, whether it is a character, an arrow sequence or a control byte');
  const held = await send('\x7f\x7f\x7f');
  t.equal(held.length, 3, 'three backspaces in one chunk are three keypresses');
  const arrows = await send('\x1b[A\x1b[B\x1b[C');
  t.equal(arrows.length, 3, 'so are three arrow sequences in one chunk');
});

s.fact(
  F,
  ['If several characters arrive in one chunk (a paste, for instance), it still fires only once, with the whole string as `input` — but prefer `usePaste` (below) when you need to distinguish typed input from pasted text: a pasted `q` reaches `useInput` exactly like a typed `q`, while `usePaste` receives every paste as one string, newlines included.'],
  { kind: 'R' },
  async (t, q) => {
    const field = q.tok('input');
    t.equal(field, handlerParams().input, 'input is the first parameter of the handler');
    const typed = q.tok('q');
    t.equal([...typed].length, 1, 'q is a single key');
    const pasteHook = q.api(ink, 'usePaste');
    const inputHook = q.api(ink, 'useInput');
    const record = (config) => {
      const got = { input: [], paste: [] };
      const Probe = () => {
        inputHook((text, key) => got.input.push({ [field]: text, key: { ...key } }));
        if (config.paste) pasteHook((text) => got.paste.push(text));
        return h(Text, null, 'probe');
      };
      return { got, app: mount(h(Probe)) };
    };
    // one chunk of several characters: one call with the whole string
    const only = record({});
    await only.app.flush();
    await only.app.press('abc');
    t.deepEqual(only.got.input.map((c) => c[field]), ['abc'], 'one call, the whole chunk as input');
    // a paste with only useInput mounted is one call too, newlines and all
    await only.app.press(keys.paste('one\ntwo'));
    t.deepEqual(only.got.input.map((c) => c[field]), ['abc', 'one\ntwo'], 'a bracketed paste is one call');
    // a pasted q is the same call as a typed q
    only.got.input.length = 0;
    await only.app.press(typed);
    await only.app.press(keys.paste(typed));
    t.equal(only.got.input.length, 2);
    t.deepEqual(only.got.input[1], only.got.input[0], 'a pasted q reaches useInput exactly like a typed q');
    // usePaste: every paste is one string, newlines included, and useInput does not see it
    const both = record({ paste: true });
    await both.app.flush();
    await both.app.press(keys.paste(typed), keys.paste('one\ntwo\r\nthree'));
    t.deepEqual(both.got.paste, [typed, 'one\ntwo\r\nthree'], 'usePaste receives each paste as one string');
    t.equal(both.got.input.length, 0, 'and useInput none of it');
  },
);

// ---- isActive ---------------------------------------------------------------------------------

s.fact(
  F,
  ['`options.isActive` (`boolean`, default `true`) turns the handler on/off without removing it — use this when several `useInput` hooks are mounted at once (e.g. a modal on top of a list) so only one consumes a given keypress.'],
  { kind: 'D' },
  async (t, q) => {
    const prop = q.tok('options.isActive').split('.')[1];
    const dflt = JSON.parse(q.tok('true'));
    t.equal(typeof dflt, q.tok('boolean'), 'the default is a boolean');
    const inputHook = q.api(ink, 'useInput');
    let mounts = 0;
    const calls = [];
    const Toggled = ({ options }) => {
      useState(() => ++mounts);
      inputHook((text) => calls.push(text), options);
      return h(Text, null, 'toggled');
    };
    const press = async (app, options) => {
      await app.rerender(h(Toggled, { options }));
      calls.length = 0;
      await app.press('k');
      return calls.length;
    };
    const app = mount(h(Toggled, { options: undefined }));
    await app.flush();
    t.equal(await press(app, undefined), 1, 'without options the handler is active');
    t.equal(await press(app, { [prop]: dflt }), 1, 'and so it is with the default value passed explicitly');
    t.equal(await press(app, { [prop]: !dflt }), 0, 'the opposite value turns it off');
    t.equal(await press(app, { [prop]: dflt }), 1, 'and back on');
    t.equal(mounts, 1, 'through all of that the component stayed mounted: the handler was switched, not removed');
    // two hooks at once: the modal consumes the key, then the list does
    const seen = [];
    const List = ({ active }) => (inputHook((text) => seen.push(`list:${text}`), { [prop]: active }), h(Text, null, 'list'));
    const Modal = ({ active }) => (inputHook((text) => seen.push(`modal:${text}`), { [prop]: active }), h(Text, null, 'modal'));
    const Screen = ({ modalOpen }) => h(Fragment, null, h(List, { active: !modalOpen }), h(Modal, { active: modalOpen }));
    const screen = mount(h(Screen, { modalOpen: true }));
    await screen.flush();
    await screen.press('x');
    await screen.rerender(h(Screen, { modalOpen: false }));
    await screen.press('y');
    t.deepEqual(seen, ['modal:x', 'list:y'], 'only the active hook consumes the keypress');
  },
);

s.types(
  F,
  ['`options.isActive` (`boolean`, default `true`)'],
  tsx`
import {useInput} from 'ink';

useInput(() => {}, {isActive: true});
useInput(() => {}, {isActive: false});
useInput(() => {});
useInput(() => {}, {isActive: 'yes'}); //! TS2322
// boolean true
`,
  { ctx: ['options.isActive'] },
);

s.fact(
  F,
  ['An active `useInput` also keeps the process alive; with `isActive: false` and nothing else pending, the process exits once the app has rendered (see `ink-rendering-and-lifecycle`).'],
  { kind: 'R', timeout: 30_000 },
  async (t, q) => {
    q.api(ink, 'useInput');
    t.ok(skillText(q.tok('ink-rendering-and-lifecycle')).includes('useInput'), 'ink-rendering-and-lifecycle covers the process model');
    const inactive = JSON.stringify(optionsOf(q.tok('isActive: false')));
    const [active, off, bare] = await Promise.all([aliveProbe('{"isActive":true}'), aliveProbe(inactive), aliveProbe('none')]);
    t.equal(active.alive, true, 'with an active useInput the process is still there after the timer that does not keep it alive');
    t.equal(off.alive, false, 'with isActive: false it has exited before that timer');
    t.equal(off.code, 0, 'and exited normally');
    t.equal(bare.alive, false, 'as does an app without any input hook');
  },
);

// ---- what useInput does not deliver ----------------------------------------------------------

s.fact(
  F,
  ['Unrecognized control sequences (mouse reports, focus in/out, cursor-position reports) are not delivered to `useInput`, and keypad Enter sets `key.return`.'],
  { kind: 'R' },
  async (t, q) => {
    q.api(ink, 'useInput');
    const returnFlag = q.tok('key.return').split('.')[1];
    const dropped = { 'mouse report': keys.mouseDown, 'focus in': keys.focusIn, 'focus out': keys.focusOut, 'cursor-position report': keys.cursorPositionReport, 'device attributes reply': '\x1b[?62;c' };
    const names = Object.keys(dropped);
    const results = await receive([...Object.values(dropped), keys.up, keys.keypadEnter, keys.enter]);
    names.forEach((name, i) => t.deepEqual(results[i], [], `${name} is not delivered`));
    t.equal(results[names.length].length, 1, 'while an arrow key is');
    const [keypad] = results[names.length + 1];
    t.equal(keypad.key[returnFlag], true, 'keypad Enter sets key.return');
    t.equal(keypad.input, '\r', 'with the same input as Enter');
    t.deepEqual(keypad, results[names.length + 2][0], 'it is indistinguishable from Return');
  },
);

s.fact(
  F,
  ['Ctrl+C exits the app before any `useInput` handler runs, unless you pass `exitOnCtrlC: false` to `render()`: the handler then receives it as `input === \'c\'` with `key.ctrl` set.'],
  { kind: 'R' },
  async (t, q) => {
    q.api(ink, 'useInput');
    q.api(ink, 'render()');
    const off = optionsOf(q.tok('exitOnCtrlC: false'));
    // Ink's own default: leave the option out
    const byDefault = inputApp({ render: { exitOnCtrlC: undefined } });
    await byDefault.app.flush();
    const byDefaultExit = watchExit(byDefault.app);
    const handled = await byDefault.send(keys.ctrlC);
    await waitFor(() => byDefaultExit.done, { message: 'the app to exit on Ctrl+C' });
    t.deepEqual(handled, [], 'the handler never runs');
    // with the option set, Ctrl+C is an ordinary key
    const own = inputApp({ render: off });
    await own.app.flush();
    const ownExit = watchExit(own.app);
    const [call] = await own.send(keys.ctrlC);
    t.equal(ownExit.done, false, 'the app keeps running');
    t.equal(evaluate(q.tok("input === 'c'"), { input: call.input }), true, 'the handler gets input c');
    t.equal(evaluate(q.tok('key.ctrl'), { key: call.key }), true, 'with key.ctrl set');
  },
);

s.fact(F, ['See `references/keys.md` for the full `key` object (arrows, modifiers, navigation, and the kitty-protocol-only fields).'], { kind: 'R' }, async (t, q) => {
  const keysDoc = skillText('ink-input-handling', q.tok('references/keys.md'));
  const [call] = await receive(['a']);
  const properties = Object.keys(call[0].key);
  t.deepEqual([...properties].sort(), [...KEY_PROPS].sort(), 'the key object has these properties');
  for (const name of properties) t.ok(keysDoc.includes(`\`${name}\``), `references/keys.md documents key.${name}`);
  t.match(keysDoc, new RegExp(`^# The \`${q.tok('key')}\` object`), 'and is titled as the key object');
});

// ===================================================================== usePaste

s.fact(
  F,
  ['Fires only when the user pastes text, delivering the full string verbatim (newlines included) — bracketed paste mode is enabled automatically while the hook is mounted and active.'],
  { kind: 'R' },
  async (t) => {
    const { app, got } = hooksApp({ paste: true, input: true });
    await app.flush();
    await app.press('a', keys.up, keys.enter, 'typed text');
    t.deepEqual(got.paste, [], 'typing does not fire it');
    const text = 'one\ntwo\r\nthree\tfour \x03 \x1b[A end';
    await app.press(keys.paste(text));
    t.deepEqual(got.paste, [text], 'a paste fires it once with the string exactly as pasted: newlines, tabs and control bytes included');
    // bracketed paste mode: on while mounted and active, off after
    t.ok(written(app).includes('\x1b[?2004h'), 'bracketed paste mode is switched on when the hook mounts');
    t.ok(!written(app).includes('\x1b[?2004l'), 'and still on');
    await app.unmount();
    t.ok(written(app).endsWith('\x1b[?2004l') || written(app).includes('\x1b[?2004l'), 'it is switched off when the hook unmounts');
    // not while the hook is inactive
    const idle = hooksApp({ paste: { isActive: false } });
    await idle.app.flush();
    t.ok(!written(idle.app).includes('\x1b[?2004h'), 'an inactive hook leaves bracketed paste mode alone');
  },
);

s.fact(
  F,
  ["`useInput` and `usePaste` run on **separate event channels**: pasted text is never forwarded to a `useInput` handler while `usePaste` is active, so you don't need to filter it out yourself."],
  { kind: 'R' },
  async (t, q) => {
    const inputHook = q.api(ink, 'useInput');
    const pasteHook = q.api(ink, 'usePaste');
    const channels = { 'separate event channels': ['input', 'paste'] }[q.tok('separate event channels')];
    const run = async (pasteOptions) => {
      const got = { input: [], paste: [] };
      const Probe = () => {
        inputHook((text) => got.input.push(text));
        pasteHook((text) => got.paste.push(text), pasteOptions);
        return h(Text, null, 'probe');
      };
      const app = mount(h(Probe));
      await app.flush();
      await app.press('t', keys.paste('pasted\nlines'), 'u');
      return got;
    };
    const active = await run(undefined);
    t.deepEqual(active[channels[0]], ['t', 'u'], 'useInput gets the typed keys only');
    t.deepEqual(active[channels[1]], ['pasted\nlines'], 'usePaste gets the paste only');
    const inactive = await run({ isActive: false });
    t.deepEqual(inactive[channels[0]], ['t', 'pasted\nlines', 'u'], 'positive control: with usePaste inactive the paste does reach useInput');
    t.deepEqual(inactive[channels[1]], []);
  },
);

// the fence: each comment marks a place in the handlers, so each run swaps one comment for a marker
async function runPasteFence(replacements) {
  const marks = { typed: [], submitted: [], pasted: [], logged: [] };
  globalThis.__marks = marks;
  const log = console.log;
  console.log = (...args) => marks.logged.push(args);
  try {
    const { mod } = await s.runFence(F, 1, { replace: replacements.map(([comment, code]) => [`// ${comment}`, code]) });
    const app = mount(h(mod.MyInput));
    await app.flush();
    return { app, marks, restore: () => ((console.log = log), delete globalThis.__marks) };
  } catch (error) {
    console.log = log;
    throw error;
  }
}

s.fence(F, 1, {
  run: async (t) => {
    const { app, marks, restore } = await runPasteFence([]);
    try {
      await app.press(keys.paste('hello\nworld'));
      t.deepEqual(marks.logged, [['Pasted:', 'hello\nworld']], 'a paste is logged');
      t.equal(app.screen(), '', 'the component renders nothing');
    } finally {
      restore();
    }
  },
});

s.fact(F, ['useInput((input, key) => { // only typed characters and key events — never pasted text'], { kind: 'R' }, async (t) => {
  const { app, marks, restore } = await runPasteFence([['only typed characters and key events — never pasted text', 'globalThis.__marks.typed.push(input);']]);
  try {
    await app.press('x', keys.up);
    t.deepEqual(marks.typed, ['x', ''], 'typed characters and key events reach the handler');
    await app.press(keys.paste('pasted text'));
    t.deepEqual(marks.typed, ['x', ''], 'pasted text does not');
  } finally {
    restore();
  }
});

s.fact(F, ['if (key.return) { // submit }'], { kind: 'R' }, async (t) => {
  const { app, marks, restore } = await runPasteFence([['submit', "globalThis.__marks.submitted.push('submit');"]]);
  try {
    await app.press(keys.paste('line one\nline two\r'));
    t.deepEqual(marks.submitted, [], 'newlines inside a paste do not submit');
    await app.press(keys.enter);
    t.deepEqual(marks.submitted, ['submit'], 'the Return key does');
  } finally {
    restore();
  }
});

s.fact(F, ['usePaste((text) => { // the full pasted string, verbatim console.log(\'Pasted:\', text); });'], { kind: 'R' }, async (t) => {
  const { app, marks, restore } = await runPasteFence([['the full pasted string, verbatim', 'globalThis.__marks.pasted.push(text);']]);
  try {
    const text = 'a\nb\r\nc\td';
    await app.press(keys.paste(text));
    t.deepEqual(marks.pasted, [text], 'the callback receives the string exactly as pasted');
    t.deepEqual(marks.logged, [['Pasted:', text]], 'and the fence logs it with the Pasted: prefix');
  } finally {
    restore();
  }
});

s.fact(F, ['`options.isActive` works the same as on `useInput`.'], { kind: 'R' }, async (t, q) => {
  const prop = q.tok('options.isActive').split('.')[1];
  const inputHook = q.api(ink, 'useInput');
  const pasteHook = usePaste;
  const probe = async (hook, options) => {
    const got = [];
    const Probe = () => (hook((text) => got.push(text), options), h(Text, null, 'probe'));
    const app = mount(h(Probe));
    await app.flush();
    await app.press(hook === inputHook ? 'k' : keys.paste('k'));
    return { got, raw: app.stdin.rawModeCalls, bracketed: written(app).includes('\x1b[?2004h') };
  };
  for (const hook of [inputHook, pasteHook]) {
    const on = await probe(hook, undefined);
    t.deepEqual([on.got, on.raw], [['k'], [true]], `${hook.name} is active without options`);
    const explicit = await probe(hook, { [prop]: true });
    t.deepEqual(explicit.got, ['k'], `${hook.name}: isActive true is active`);
    const off = await probe(hook, { [prop]: false });
    t.deepEqual([off.got, off.raw], [[], []], `${hook.name}: isActive false is not called and leaves raw mode alone`);
  }
  t.equal((await probe(pasteHook, undefined)).bracketed, true, 'usePaste switches bracketed paste mode on when active');
  t.equal((await probe(pasteHook, { [prop]: false })).bracketed, false, 'and not when inactive');
});

// ===================================================================== raw mode

s.fact(
  F,
  ['Ink automatically puts stdin in raw mode while any `useInput` hook is mounted and active (`isActive !== false`); `usePaste` and `useFocus` do the same while active.'],
  { kind: 'R' },
  async (t, q) => {
    const hooks = { useInput: q.api(ink, 'useInput'), usePaste: q.api(ink, 'usePaste'), useFocus: q.api(ink, 'useFocus') };
    const active = q.tok('isActive !== false');
    for (const [name, hook] of Object.entries(hooks)) {
      for (const isActive of [undefined, true, false]) {
        const Probe = () => {
          if (name === 'useFocus') hook({ isActive });
          else hook(() => {}, { isActive });
          return h(Text, null, 'probe');
        };
        const app = mount(h(Probe));
        await app.flush();
        const on = app.stdin.rawModeCalls.includes(true);
        t.equal(on, evaluate(active, { isActive }), `${name} with isActive ${isActive}: raw mode ${on ? 'on' : 'off'}`);
        await app.unmount();
        if (on) t.deepEqual(app.stdin.rawModeCalls, [true, false], `${name}: and released on unmount`);
      }
    }
    // any hook keeps it on: raw mode is released only with the last one
    const A = () => (hooks.useInput(() => {}), h(Text, null, 'a'));
    const B = () => (hooks.useInput(() => {}), h(Text, null, 'b'));
    const both = mount(h(Fragment, null, h(A), h(B)));
    await both.flush();
    await both.rerender(h(Fragment, null, h(A)));
    t.deepEqual(both.stdin.rawModeCalls, [true], 'with one of two hooks gone raw mode stays on');
    await both.rerender(h(Fragment, null));
    t.deepEqual(both.stdin.rawModeCalls, [true, false], 'and is released when the last one goes');
  },
);

s.fact(
  F,
  ["`useInput` and `usePaste` throw when stdin can't do raw mode (for example piped input), so pass `isActive: isRawModeSupported` (from `useStdin`) if your app can run without a TTY."],
  { kind: 'R' },
  async (t, q) => {
    const stdinHook = q.api(ink, 'useStdin');
    const guard = (isRawModeSupported) => evaluate(`{${q.tok('isActive: isRawModeSupported')}}`, { isRawModeSupported });
    const attempt = async (hook, { guarded, tty }) => {
      const Probe = () => {
        const { isRawModeSupported } = stdinHook();
        hook(() => {}, guarded ? guard(isRawModeSupported) : undefined);
        return h(Text, null, 'alive');
      };
      const app = mount(h(Probe), { stdinIsTTY: tty });
      const exit = watchExit(app);
      await app.flush();
      if (!guarded && !tty) await waitFor(() => exit.done, { message: 'the hook to throw' });
      const out = { failure: exit.error, screen: app.screen() };
      await app.unmount();
      return out;
    };
    for (const [name, hook] of [['useInput', q.api(ink, 'useInput')], ['usePaste', q.api(ink, 'usePaste')]]) {
      const broken = await attempt(hook, { guarded: false, tty: false });
      t.match(broken.failure?.message ?? '', /Raw mode is not supported/, `${name} throws when stdin is piped`);
      const fine = await attempt(hook, { guarded: false, tty: true });
      t.equal(fine.failure, null, `${name} does not throw on a TTY`);
      const safe = await attempt(hook, { guarded: true, tty: false });
      t.equal(safe.failure, null, `${name} with isActive: isRawModeSupported does not throw when piped`);
      t.equal(safe.screen, 'alive', 'and the app renders');
    }
  },
);

s.fact(
  F,
  ["If you need raw mode without `useInput` (rare), use `useStdin`'s `setRawMode` — **not** `process.stdin.setRawMode` directly: Ink exits on Ctrl+C only while raw mode was enabled through its own `setRawMode`."],
  { kind: 'R', ctx: ['not'] },
  async (t, q) => {
    q.api(ink, 'useInput');
    const stdinHook = q.api(ink, 'useStdin');
    const own = q.tok('setRawMode');
    const direct = q.tok('process.stdin.setRawMode').split('.').at(-1);
    const run = async (enable) => {
      let error = null;
      const Probe = () => {
        const context = stdinHook();
        useEffect(() => {
          try {
            enable(context);
          } catch (caught) {
            error = caught;
          }
        }, []);
        return h(Text, null, 'probe');
      };
      const app = mount(h(Probe), { render: { exitOnCtrlC: undefined } });
      await app.flush();
      const exit = watchExit(app);
      await app.press(keys.ctrlC);
      await app.flush();
      return { app, exited: exit.done, error, raw: app.stdin.rawModeCalls };
    };
    const viaInk = await run((context) => context[own](true));
    t.equal(viaInk.error, null);
    t.equal(viaInk.raw[0], true, 'useStdin().setRawMode puts stdin in raw mode');
    t.equal(viaInk.exited, true, 'and Ink then exits on Ctrl+C');
    const viaStream = await run((context) => context.stdin[direct](true));
    t.equal(viaStream.error, null);
    t.deepEqual(viaStream.raw, [true], 'the stream\'s own setRawMode puts stdin in raw mode too');
    t.equal(viaStream.exited, false, 'but Ink does not handle Ctrl+C: the app keeps running');
    await viaStream.app.unmount();
  },
);

s.fact(F, ["Always check `isRawModeSupported` first; `setRawMode` throws when the current stdin doesn't support it."], { kind: 'R' }, async (t, q) => {
  const flag = q.tok('isRawModeSupported');
  const method = q.tok('setRawMode');
  const piped = stdinApp({ mount: { stdinIsTTY: false } });
  await piped.app.flush();
  t.equal(piped.seen[flag], false, 'piped stdin: isRawModeSupported is false');
  t.throws(() => piped.seen[method](true), /Raw mode is not supported/, 'and setRawMode throws');
  const tty = stdinApp();
  await tty.app.flush();
  t.equal(tty.seen[flag], true, 'a TTY: isRawModeSupported is true');
  t.doesNotThrow(() => tty.seen[method](true), 'and setRawMode works');
  t.deepEqual(tty.app.stdin.rawModeCalls, [true]);
});

s.fact(F, ['See `ink-terminal-io`.'], { kind: 'R' }, async (t, q) => {
  const text = skillText(q.tok('ink-terminal-io'));
  t.match(text, /## `useStdin\(\)`/, 'ink-terminal-io documents useStdin');
  t.match(text, /isRawModeSupported/);
  t.match(text, /setRawMode/);
});

// ===================================================================== kitty

s.fact(F, ['Opt in by passing a `kittyKeyboard` object to `render()` — omit it and the protocol is never enabled.'], { kind: 'R' }, async (t, q) => {
  const prop = q.tok('kittyKeyboard');
  q.api(ink, 'render()');
  const omitted = await kittyApp({});
  await omitted.app.press('\x1b[?1u');
  t.deepEqual(kittyWrites(omitted.app), { query: false, enabled: [] }, 'without the option nothing is asked and nothing enabled, even when the terminal answers a query');
  const opted = await kittyApp({ [prop]: { mode: 'enabled' } });
  t.deepEqual(kittyWrites(opted.app).enabled, [1], 'with the option the protocol is enabled');
});

s.fact(
  F,
  ["`mode` defaults to `'auto'`, which only probes the terminal in interactive mode with TTY stdin/stdout; `'enabled'` forces it and requires both stdin/stdout to be TTYs; `'disabled'` never enables it."],
  { kind: 'D' },
  async (t, q) => {
    const mode = q.tok('mode');
    const [auto, enabled, disabled] = ["'auto'", "'enabled'", "'disabled'"].map((tok) => unquote(q.tok(tok)));
    t.deepEqual([auto, enabled, disabled], kittyModes(), 'these are the three values the type of mode allows');
    const kitty = (value) => ({ kittyKeyboard: value === undefined ? {} : { [mode]: value } });
    // default is auto: the same bytes as 'auto', and a probe (the query), not an enable
    const byDefault = await kittyApp(kitty(undefined));
    const explicit = await kittyApp(kitty(auto));
    t.equal(written(byDefault.app), written(explicit.app), 'no mode behaves as auto');
    t.deepEqual(kittyWrites(byDefault.app), { query: true, enabled: [] }, 'auto probes the terminal and enables nothing yet');
    await byDefault.app.press('\x1b[?1u');
    t.deepEqual(kittyWrites(byDefault.app).enabled, [1], 'it enables the protocol once the terminal answers the probe');
    // auto: only interactive, TTY stdin and TTY stdout
    const probes = async (renderOptions, mountOptions) => kittyWrites(await plainApp({ ...kitty(auto), ...renderOptions }, mountOptions)).query;
    t.equal(await probes({}, {}), true, 'interactive with TTYs: probes');
    t.equal(await probes({ interactive: false }, {}), false, 'not interactive: no probe');
    t.equal(await probes({}, { stdinIsTTY: false }), false, 'stdin not a TTY: no probe');
    t.equal(await probes({ interactive: true }, { isTTY: false, stdinIsTTY: true }), false, 'stdout not a TTY: no probe');
    // enabled: immediately, without a probe, whatever interactive says, but only with both TTYs
    const enable = async (renderOptions, mountOptions) => kittyWrites(await plainApp({ ...kitty(enabled), ...renderOptions }, mountOptions));
    t.deepEqual(await enable({}, {}), { query: false, enabled: [1] }, 'enabled: switches the protocol on without probing');
    t.deepEqual(await enable({ interactive: false }, {}), { query: false, enabled: [1] }, 'even when not interactive');
    t.deepEqual((await enable({}, { stdinIsTTY: false })).enabled, [], 'but not when stdin is not a TTY');
    t.deepEqual((await enable({}, { isTTY: false, stdinIsTTY: true })).enabled, [], 'nor when stdout is not a TTY');
    // disabled: never, not even when the terminal volunteers the answer
    const never = await kittyApp(kitty(disabled));
    await never.app.press('\x1b[?1u');
    t.deepEqual(kittyWrites(never.app), { query: false, enabled: [] }, 'disabled never asks and never enables');
  },
);

s.types(
  F,
  ["`mode` defaults to `'auto'`, which only probes the terminal in interactive mode with TTY stdin/stdout; `'enabled'` forces it and requires both stdin/stdout to be TTYs; `'disabled'` never enables it."],
  tsx`
import {render} from 'ink';

const App = () => null;
render(<App />, {kittyKeyboard: {}});
render(<App />, {kittyKeyboard: {mode: 'auto'}});
render(<App />, {kittyKeyboard: {mode: 'enabled'}});
render(<App />, {kittyKeyboard: {mode: 'disabled'}});
render(<App />, {kittyKeyboard: {mode: 'always'}}); //! TS2322
`,
  { ctx: ['mode', "'auto'", "'enabled'", "'disabled'"] },
);

s.fact(
  F,
  ["Enabling it makes Ink ask the terminal for kitty-style key reports (the `flags` choose how much detail), and Ink fills `key.super`, `key.hyper`, `key.capsLock`, `key.numLock` and `key.eventType` (`'press' | 'repeat' | 'release'`) from their modifier and event-type fields."],
  { kind: 'R' },
  async (t, q) => {
    const flagsOption = q.tok('flags');
    const modifiers = ['key.super', 'key.hyper', 'key.capsLock', 'key.numLock'].map((tok) => q.tok(tok).split('.')[1]);
    const eventProp = q.tok('key.eventType').split('.')[1];
    const eventTypes = q.tok("'press' | 'repeat' | 'release'").split(' | ').map(unquote);
    // the flags choose what is asked for: the bitmask is the OR of the named flags (default: disambiguate only)
    const bits = (names) => names.reduce((n, name) => n | ink.kittyFlags[name], 0);
    for (const flags of [undefined, ['disambiguateEscapeCodes'], ['reportEventTypes'], ['disambiguateEscapeCodes', 'reportEventTypes'], ['reportAllKeysAsEscapeCodes']]) {
      const app = await plainApp({ kittyKeyboard: { mode: 'enabled', ...(flags ? { [flagsOption]: flags } : {}) } });
      t.deepEqual(kittyWrites(app).enabled, [bits(flags ?? ['disambiguateEscapeCodes'])], `flags ${JSON.stringify(flags)}`);
    }
    // Ink fills the fields from the modifier and event-type fields of the sequences
    const { send } = await kittyApp({ kittyKeyboard: { mode: 'enabled', [flagsOption]: ['disambiguateEscapeCodes', 'reportEventTypes'] } });
    for (const name of modifiers) {
      const [call] = await send(`\x1b[97;${1 + ink.kittyModifiers[name]}u`);
      t.equal(call.key[name], true, `${name} is set by its modifier bit`);
      t.deepEqual(modifiers.filter((other) => call.key[other]), [name], `and no other kitty modifier is`);
    }
    for (const [index, type] of eventTypes.entries()) {
      const [call] = await send(`\x1b[97;1:${index + 1}u`);
      t.equal(call.key[eventProp], type, `event type ${index + 1} is ${type}`);
    }
  },
);

s.fact(
  F,
  ['Ordinary typed characters and the plain arrow, Return, Tab, Escape and Backspace sequences leave `super`/`hyper`/`capsLock`/`numLock` `false` and `eventType` `undefined`.'],
  { kind: 'R' },
  async (t, q) => {
    const modifiers = ['super', 'hyper', 'capsLock', 'numLock'].map((name) => q.tok(name));
    const off = JSON.parse(q.tok('false'));
    const eventProp = q.tok('eventType');
    const unset = evaluate(q.tok('undefined'), {});
    const plainKeys = ['a', 'A', '7', ' ', 'é', '😀', '\x1b[A', '\x1b[B', '\x1b[C', '\x1b[D', '\x1bOA', '\r', '\t', '\x1b', '\x7f', '\b'];
    for (const render of [{}, { kittyKeyboard: { mode: 'enabled' } }]) {
      const results = await receive(plainKeys, { render });
      plainKeys.forEach((sequence, i) => {
        const [call] = results[i];
        t.deepEqual(modifiers.map((name) => call.key[name]), modifiers.map(() => off), `${JSON.stringify(sequence)}: no kitty modifier`);
        t.equal(call.key[eventProp], unset, `${JSON.stringify(sequence)}: no event type`);
      });
    }
    // positive control: a kitty-style sequence does set them
    for (const name of modifiers) {
      const [[call]] = await receive([`\x1b[97;${1 + ink.kittyModifiers[name]}u`]);
      t.equal(call.key[name], !off, `a kitty-style sequence sets ${name}`);
    }
    const [[press]] = await receive(['\x1b[97;1u']);
    t.equal(press.key[eventProp], 'press', 'and an event type');
  },
);

s.fence(F, 2, {
  run: async (t) => {
    const { apps, renderOptions } = await runFenceForwarding(s, F, 2);
    t.equal(apps.length, 1, 'the fence renders one app');
    await apps[0].flush();
    t.equal(stripAnsi(written(apps[0])).trim(), 'Press a key', 'and draws its text');
    const { mode, flags } = renderOptions[0].kittyKeyboard;
    t.equal(mode, 'enabled');
    t.deepEqual(kittyWrites(apps[0]), { query: false, enabled: [flags.reduce((n, name) => n | ink.kittyFlags[name], 0)] }, 'the protocol is switched on with exactly those flags');
    t.deepEqual(flags, ['disambiguateEscapeCodes', 'reportEventTypes']);
  },
});

s.fact(
  F,
  ['Enabling `reportAllKeysAsEscapeCodes` (or `reportAssociatedText`, which automatically enables it) makes Ink ask for every key as an escape code, so non-printable keys arrive with an empty `input` — see `references/keys.md` for the full behavior-change list before turning this on for anything beyond arrow/navigation keys.'],
  { kind: 'R' },
  async (t, q) => {
    const all = q.tok('reportAllKeysAsEscapeCodes');
    const text = q.tok('reportAssociatedText');
    const field = q.tok('input');
    const flagBits = async (flags) => kittyWrites(await plainApp({ kittyKeyboard: { mode: 'enabled', flags } })).enabled[0];
    t.equal(await flagBits([all]), ink.kittyFlags[all], 'the flag asks for every key as an escape code');
    t.equal(await flagBits([text]), ink.kittyFlags[text] | ink.kittyFlags[all], 'reportAssociatedText sets that bit as well');
    t.notEqual(await flagBits(['reportEventTypes']) & ink.kittyFlags[all], ink.kittyFlags[all], 'positive control: another flag does not');
    const nonPrintable = { escape: '\x1b[27u', tab: '\x1b[9u', backspace: '\x1b[127u', up: '\x1b[1;1A', f5: '\x1b[15;1~', leftShift: '\x1b[57441u', capsLock: '\x1b[57358u' };
    const results = await receive(Object.values(nonPrintable), { render: { kittyKeyboard: { mode: 'enabled', flags: [all] } } });
    Object.keys(nonPrintable).forEach((name, i) => t.equal(results[i][0][field], '', `${name} arrives with an empty input`));
    const [[printable]] = await receive(['\x1b[97u'], { render: { kittyKeyboard: { mode: 'enabled', flags: [all] } } });
    t.equal(printable[field], 'a', 'positive control: a printable key still carries its text');
    t.match(skillText('ink-input-handling', q.tok('references/keys.md')), /Behavior changes/, 'references/keys.md has the behavior-change list');
  },
);
