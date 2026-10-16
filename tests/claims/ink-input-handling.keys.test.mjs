// Claims for skills/core/ink-input-handling/references/keys.md.
// The claims say what Ink delivers to a useInput handler for a given byte sequence, so each of
// them feeds bytes to stdin through the fake terminal and reads what the handler receives.
import { skill, tsx, h, mount, ink, keys } from '../lib/index.mjs';
import { KEY_PROPS, bytesOf, inputApp, receive, kittyWrites, plainApp, handlerParams, watchExit, written } from './ink-input-handling.helpers.mjs';
import { waitFor } from '../lib/index.mjs';

const s = skill('ink-input-handling');
const F = 'references/keys.md';

/** The expression `input === 'c'` and the like, evaluated for the values the handler got. */
const evaluate = (expression, vars) => new Function(...Object.keys(vars), `return (${expression})`)(...Object.values(vars));
const unquote = (token) => token.replace(/^'|'$/g, '');
const trueFlags = (key) => Object.entries(key).filter(([, value]) => value === true).map(([name]) => name);
const KITTY = { kittyKeyboard: { mode: 'enabled' } };

/** What the handler received for one sequence (exactly one call). */
async function one(sequence, opts) {
  const [calls] = await receive([sequence], opts);
  if (calls.length !== 1) throw new Error(`${JSON.stringify(sequence)}: expected one call, got ${calls.length}`);
  return calls[0];
}

// ===================================================================== introduction

s.fact(F, ['Passed as the second argument to the `useInput` handler: `(input, key) => {}`.'], { kind: 'R' }, async (t, q) => {
  const handler = evaluate(q.tok('(input, key) => {}'), {});
  const names = handler.toString().match(/^\(([^)]*)\)/)[1].split(', ');
  const declared = handlerParams();
  t.deepEqual(names, [declared.input, declared.key], 'the parameters are the ones Ink declares for the handler');
  const useInput = q.api(ink, 'useInput');
  const seen = [];
  const Probe = () => (useInput((...args) => seen.push(args)), h(ink.Text, null, 'probe'));
  const app = mount(h(Probe));
  await app.flush();
  await app.press('a');
  t.equal(seen.length, 1);
  t.equal(seen[0].length, handler.length, 'Ink calls the handler with as many arguments as the text shows');
  t.equal(seen[0][0], 'a', 'the first is the typed text');
  t.equal(typeof seen[0][1], 'object', 'the second is the key object');
  t.deepEqual(Object.keys(seen[0][1]).sort(), [...KEY_PROPS].sort(), 'with the properties this reference documents');
});

s.fact(
  F,
  ['All properties are `boolean` and default to `false`, except `eventType`, which is `undefined` unless the sequence is kitty-style (see the table below).'],
  { kind: 'D' },
  async (t, q) => {
    const type = q.tok('boolean');
    const off = JSON.parse(q.tok('false'));
    const eventProp = q.tok('eventType');
    const unset = evaluate(q.tok('undefined'), {});
    for (const sequence of ['a', 'Z', ' ', '\x1b[A', '\r', '\x01']) {
      const { key } = await one(sequence);
      const booleans = Object.keys(key).filter((name) => name !== eventProp);
      t.equal(booleans.length, KEY_PROPS.length - 1, 'every property but eventType');
      for (const name of booleans) t.equal(typeof key[name], type, `${JSON.stringify(sequence)}: ${name} is a boolean`);
      t.equal(key[eventProp], unset, `${JSON.stringify(sequence)}: eventType is undefined`);
    }
    const { key: plain } = await one('a');
    t.deepEqual(trueFlags(plain), [], 'a plain letter sets none of them: they default to false');
    t.deepEqual(Object.values(plain).filter((value) => value === off).length, KEY_PROPS.length - 1);
    const kittyStyle = await one('\x1b[97u');
    t.equal(kittyStyle.key[eventProp], 'press', 'a kitty-style sequence gives eventType a value');
  },
);

s.fact(F, ['The kitty-only modifiers (`super`, `hyper`, `capsLock`, `numLock`) are `false` unless such a sequence sets them.'], { kind: 'R' }, async (t, q) => {
  const modifiers = ['super', 'hyper', 'capsLock', 'numLock'].map((name) => q.tok(name));
  const off = JSON.parse(q.tok('false'));
  for (const sequence of ['a', 'A', '\x1b[A', '\x01', '\x1ba', '\x1b[1;5A', '\x1b[97u', '\x1b[97;5u']) {
    const { key } = await one(sequence);
    t.deepEqual(modifiers.map((name) => key[name]), modifiers.map(() => off), `${JSON.stringify(sequence)} sets none of the kitty-only modifiers`);
  }
  for (const name of modifiers) {
    const { key } = await one(`\x1b[97;${1 + ink.kittyModifiers[name]}u`);
    t.deepEqual(modifiers.filter((other) => key[other] !== off), [name], `a kitty-style sequence with the ${name} bit sets ${name} and no other`);
  }
});

s.fact(
  F,
  ['Unrecognized control sequences (mouse reports, focus in/out, cursor-position reports) are dropped before `useInput` and never reach the handler.'],
  { kind: 'R' },
  async (t, q) => {
    q.api(ink, 'useInput');
    const dropped = { 'mouse report': keys.mouseDown, 'focus in': keys.focusIn, 'focus out': keys.focusOut, 'cursor-position report': keys.cursorPositionReport };
    const results = await receive([...Object.values(dropped), keys.up]);
    Object.keys(dropped).forEach((name, i) => t.deepEqual(results[i], [], `${name} never reaches the handler`));
    t.equal(results.at(-1).length, 1, 'positive control: an arrow key does');
  },
);

// ===================================================================== Arrows and navigation

/** The flags (and input) a sequence produces, for rows that list a key with the bytes a terminal sends for it. */
async function flagsOf(sequence, opts) {
  const { input, key } = await one(sequence, opts);
  return { input, flags: trueFlags(key).filter((name) => name !== 'eventType') };
}

s.fact(F, ['| `leftArrow` / `rightArrow` / `upArrow` / `downArrow` | Arrow keys. |'], { kind: 'R' }, async (t, q) => {
  const bytes = { leftArrow: ['\x1b[D', '\x1bOD'], rightArrow: ['\x1b[C', '\x1bOC'], upArrow: ['\x1b[A', '\x1bOA'], downArrow: ['\x1b[B', '\x1bOB'] };
  for (const name of ['leftArrow', 'rightArrow', 'upArrow', 'downArrow'].map((n) => q.tok(n))) {
    for (const sequence of bytes[name]) t.deepEqual(await flagsOf(sequence), { input: '', flags: [name] }, `${JSON.stringify(sequence)} is only ${name}`);
  }
});

s.fact(F, ['| `pageUp` / `pageDown` | Page Up / Page Down. |'], { kind: 'R' }, async (t, q) => {
  const bytes = { pageUp: ['\x1b[5~'], pageDown: ['\x1b[6~'] };
  for (const name of ['pageUp', 'pageDown'].map((n) => q.tok(n))) {
    for (const sequence of bytes[name]) t.deepEqual(await flagsOf(sequence), { input: '', flags: [name] }, `${JSON.stringify(sequence)} is only ${name}`);
  }
});

s.fact(F, ['| `home` / `end` | Home / End. |'], { kind: 'R' }, async (t, q) => {
  const bytes = { home: ['\x1b[H', '\x1bOH', '\x1b[1~'], end: ['\x1b[F', '\x1bOF', '\x1b[4~'] };
  for (const name of ['home', 'end'].map((n) => q.tok(n))) {
    for (const sequence of bytes[name]) t.deepEqual(await flagsOf(sequence), { input: '', flags: [name] }, `${JSON.stringify(sequence)} is only ${name}`);
  }
});

s.fact(F, ['| `return` | Return (Enter), including keypad Enter. |'], { kind: 'R' }, async (t, q) => {
  const name = q.tok('return');
  for (const [label, sequence] of [['Enter', keys.enter], ['keypad Enter', keys.keypadEnter]]) {
    t.deepEqual(await flagsOf(sequence), { input: '\r', flags: [name] }, `${label} is key.${name} with input \\r`);
  }
  t.notDeepEqual((await flagsOf('a')).flags, [name], 'positive control: a letter is not');
});

s.fact(F, ['| `escape` | Escape. |'], { kind: 'R' }, async (t, q) => {
  const name = q.tok('escape');
  t.deepEqual(await flagsOf(keys.esc), { input: '', flags: [name] }, 'a lone Escape byte is key.escape');
  t.notDeepEqual((await flagsOf('a')).flags, [name], 'positive control: a letter is not');
});

s.fact(F, ['| `tab` | Tab. |'], { kind: 'R' }, async (t, q) => {
  const name = q.tok('tab');
  t.deepEqual(await flagsOf(keys.tab), { input: '', flags: [name] }, 'the Tab byte is key.tab');
  t.deepEqual(await flagsOf(keys.shiftTab), { input: '', flags: ['shift', name] }, 'Shift+Tab is key.tab with shift');
  t.notDeepEqual((await flagsOf('a')).flags, [name], 'positive control: a letter is not');
});

s.fact(F, ['| `backspace` | Backspace. |'], { kind: 'R' }, async (t, q) => {
  const name = q.tok('backspace');
  for (const sequence of [keys.backspace, '\b']) t.deepEqual(await flagsOf(sequence), { input: '', flags: [name] }, `${JSON.stringify(sequence)} is key.${name}`);
  t.notDeepEqual((await flagsOf(keys.delete)).flags, [name], 'positive control: Delete is not');
});

s.fact(F, ['| `delete` | Delete. |'], { kind: 'R' }, async (t, q) => {
  const name = q.tok('delete');
  t.deepEqual(await flagsOf(keys.delete), { input: '', flags: [name] }, 'the Delete sequence is key.delete');
  t.notDeepEqual((await flagsOf(keys.backspace)).flags, [name], 'positive control: the byte 0x7f is backspace, not delete');
});

// ===================================================================== Modifiers

s.fact(F, ['| `ctrl` | Ctrl. |'], { kind: 'R' }, async (t, q) => {
  const name = q.tok('ctrl');
  t.deepEqual(await flagsOf('\x01'), { input: 'a', flags: [name] }, 'a control byte is the letter with ctrl');
  t.deepEqual(await flagsOf('\x1b[1;5A'), { input: '', flags: ['upArrow', name] }, 'and the Ctrl modifier of an arrow sequence sets it');
  t.notDeepEqual((await flagsOf('a')).flags, [name], 'positive control: a plain letter does not');
});

s.fact(F, ['| `shift` | Shift. |'], { kind: 'R' }, async (t, q) => {
  const name = q.tok('shift');
  t.ok((await flagsOf('\x1b[1;2A')).flags.includes(name), 'the Shift modifier of an arrow sequence sets it');
  t.ok((await flagsOf(keys.shiftTab)).flags.includes(name), 'Shift+Tab does');
  t.ok((await flagsOf('\x1b[97;2u')).flags.includes(name), 'so does the Shift bit of a kitty-style sequence');
  t.ok(!(await flagsOf('a')).flags.includes(name), 'positive control: a plain letter does not');
});

s.fact(
  F,
  ['| `meta` | Alt/Meta: set for an Escape-prefixed key (`ESC a`) and for the Alt (bit `2`) and Meta (bit `32`) modifiers of a kitty-style sequence. |'],
  { kind: 'R' },
  async (t, q) => {
    const name = q.tok('meta');
    const prefixed = bytesOf(q.tok('ESC a'));
    t.deepEqual(await flagsOf(prefixed), { input: 'a', flags: [name] }, 'ESC a is a with meta');
    const alt = Number(q.tok('2'));
    const meta = Number(q.tok('32'));
    t.equal(alt, ink.kittyModifiers.alt, 'bit 2 is the Alt modifier');
    t.equal(meta, ink.kittyModifiers.meta, 'bit 32 is the Meta modifier');
    for (const bit of [alt, meta]) t.deepEqual(await flagsOf(`\x1b[97;${1 + bit}u`), { input: 'a', flags: [name] }, `modifier bit ${bit} sets meta`);
    t.deepEqual(await flagsOf('a'), { input: 'a', flags: [] }, 'positive control: a plain letter does not');
  },
);

/** A kitty-only modifier row: the property, its bit and a sequence that sets it. */
async function modifierRow(t, q, name, bitToken, sequenceToken) {
  const property = q.tok(name);
  const bit = Number(q.tok(bitToken));
  t.equal(bit, ink.kittyModifiers[property], `bit ${bit} is the ${property} modifier`);
  const sequence = bytesOf(q.tok(sequenceToken));
  t.equal(sequence, `\x1b[97;${1 + bit}u`, 'the sequence carries the modifier field bit + 1');
  return { property, sequence };
}

s.fact(
  F,
  ['| `super` | The Super modifier (bit `8`), set by kitty-style sequences only: `ESC [ 97 ; 9 u` is `a` with `super`. |'],
  { kind: 'R' },
  async (t, q) => {
    const { property, sequence } = await modifierRow(t, q, 'super', '8', 'ESC [ 97 ; 9 u');
    t.deepEqual(await flagsOf(sequence), { input: q.tok('a'), flags: [property] }, 'the sequence is a with super');
    t.deepEqual((await flagsOf('a')).flags, [], 'positive control: plain text never sets it');
    t.deepEqual((await flagsOf('\x1b[A')).flags, ['upArrow'], 'nor does a plain arrow sequence');
  },
);

s.fact(F, ['| `hyper` | The Hyper modifier (bit `16`), set by kitty-style sequences only: `ESC [ 97 ; 17 u`. |'], { kind: 'R' }, async (t, q) => {
  const { property, sequence } = await modifierRow(t, q, 'hyper', '16', 'ESC [ 97 ; 17 u');
  t.deepEqual(await flagsOf(sequence), { input: 'a', flags: [property] });
  t.deepEqual((await flagsOf('a')).flags, [], 'positive control: plain text never sets it');
});

s.fact(F, ['| `capsLock` | The Caps Lock bit (`64`), set by kitty-style sequences only: `ESC [ 97 ; 65 u`. |'], { kind: 'R' }, async (t, q) => {
  const { property, sequence } = await modifierRow(t, q, 'capsLock', '64', 'ESC [ 97 ; 65 u');
  t.deepEqual(await flagsOf(sequence), { input: 'a', flags: [property] });
  t.deepEqual((await flagsOf('a')).flags, [], 'positive control: plain text never sets it');
});

s.fact(F, ['| `numLock` | The Num Lock bit (`128`), set by kitty-style sequences only: `ESC [ 97 ; 129 u`. |'], { kind: 'R' }, async (t, q) => {
  const { property, sequence } = await modifierRow(t, q, 'numLock', '128', 'ESC [ 97 ; 129 u');
  t.deepEqual(await flagsOf(sequence), { input: 'a', flags: [property] });
  t.deepEqual((await flagsOf('a')).flags, [], 'positive control: plain text never sets it');
});

// ===================================================================== Event type

s.fact(
  F,
  [
    "| `eventType` | `'press' | 'repeat' | 'release'` | Read from the event-type field of kitty-style sequences (`ESC [ 97 ; 1 : 3 u` is a release); a kitty-style sequence without that field is a press, as are `ESC [ 3 ~` (Delete) and `ESC [ 1 ; 5 A` (Ctrl+Up). `undefined` for ordinary text and for the plain arrow, Home, End, Return, Tab, Escape and Backspace sequences. |",
  ],
  { kind: 'R' },
  async (t, q) => {
    const property = q.tok('eventType');
    const [press, repeat, release] = q.tok("'press' | 'repeat' | 'release'").split(' | ').map(unquote);
    const unset = evaluate(q.tok('undefined'), {});
    const typeOf = async (sequence, opts) => (await one(sequence, opts)).key[property];
    // the event-type field: 1 press, 2 repeat, 3 release
    t.equal(await typeOf(bytesOf(q.tok('ESC [ 97 ; 1 : 3 u'))), release, 'the example is a release');
    t.equal(await typeOf('\x1b[97;1:2u'), repeat, 'field 2 is a repeat');
    t.equal(await typeOf('\x1b[97;1:1u'), press, 'field 1 is a press');
    // without the field: a press
    t.equal(await typeOf('\x1b[97u'), press, 'a kitty-style sequence without the field is a press');
    const delete_ = await one(bytesOf(q.tok('ESC [ 3 ~')));
    t.deepEqual([delete_.key[property], delete_.key.delete], [press, true], 'Delete is a press');
    const ctrlUp = await one(bytesOf(q.tok('ESC [ 1 ; 5 A')));
    t.deepEqual([ctrlUp.key[property], ctrlUp.key.ctrl, ctrlUp.key.upArrow], [press, true, true], 'Ctrl+Up is a press');
    // undefined for text and the plain sequences, whether or not the protocol is enabled
    const plain = ['a', 'A', '7', '\x1b[A', '\x1b[B', '\x1b[C', '\x1b[D', '\x1b[H', '\x1b[F', '\x1bOA', '\x1bOH', '\x1bOF', '\r', '\t', '\x1b', '\x7f', '\b'];
    for (const render of [{}, KITTY]) {
      const results = await receive(plain, { render });
      plain.forEach((sequence, i) => t.equal(results[i][0].key[property], unset, `${JSON.stringify(sequence)}: no event type`));
    }
  },
);

s.types(
  F,
  ["`'press' | 'repeat' | 'release'`"],
  tsx`
import type {Key} from 'ink';

type Event = 'press' | 'repeat' | 'release';
export const ok: Key['eventType'] = 'press';
export const exact: Event | undefined = {} as Key['eventType'];
export const back: Key['eventType'] = {} as Event | undefined;
export const bad: Key['eventType'] = 'hold'; //! TS2322
`,
);

// ===================================================================== Behavior changes

/** Kitty-style sequences for keys that are not printable. */
const FUNCTION_KEYS = [
  ...['\x1b[1;1P', '\x1b[1;1Q', '\x1b[13;1~', '\x1b[1;1S'], // F1-F4
  ...[15, 17, 18, 19, 20, 21, 23, 24].map((n) => `\x1b[${n};1~`), // F5-F12
  ...Array.from({ length: 23 }, (_, i) => `\x1b[${57376 + i}u`), // F13-F35
];

s.fact(F, ['**Non-printable keys produce empty `input`.**'], { kind: 'R' }, async (t, q) => {
  const field = q.tok('input');
  const claim = { 'Non-printable keys produce empty `input`.': (call) => call[field] === '' }[q.tok('Non-printable keys produce empty `input`.')];
  const nonPrintable = {
    escape: '\x1b[27u', tab: '\x1b[9u', backspace: '\x1b[127u', up: '\x1b[1;1A', delete: '\x1b[3;1~', pageDown: '\x1b[6;1~', home: '\x1b[1;1H', insert: '\x1b[2;1~',
    f1: FUNCTION_KEYS[0], f13: '\x1b[57376u', leftShift: '\x1b[57441u', rightMeta: '\x1b[57452u', mediaPlay: '\x1b[57428u', volumeUp: '\x1b[57439u', capsLock: '\x1b[57358u', printScreen: '\x1b[57361u',
  };
  const results = await receive(Object.values(nonPrintable), { render: KITTY });
  Object.keys(nonPrintable).forEach((name, i) => t.ok(claim(results[i][0]), `${name} arrives with an empty input`));
  const [[printable]] = await receive(['\x1b[97u'], { render: KITTY });
  t.ok(!claim(printable), 'positive control: a printable key carries its text');
});

s.fact(
  F,
  [
    'Arrow, Page Up/Down, Home/End, Delete, Backspace, Tab and Escape keep their `key.*` boolean properties (`upArrow`, `delete`, …), but other functional keys — Insert, F1–F35, modifier-only presses, media keys, Caps Lock, Print Screen — are not individually exposed through `key` at all.',
  ],
  { kind: 'R', ctx: ['key.*'] },
  async (t, q) => {
    t.equal(q.tok('key'), handlerParams().key, 'key is the handler parameter');
    const exposed = {
      [q.tok('upArrow')]: '\x1b[1;1A', downArrow: '\x1b[1;1B', leftArrow: '\x1b[1;1D', rightArrow: '\x1b[1;1C', pageUp: '\x1b[5;1~', pageDown: '\x1b[6;1~', home: '\x1b[1;1H', end: '\x1b[1;1F',
      [q.tok('delete')]: '\x1b[3;1~', backspace: '\x1b[127u', tab: '\x1b[9u', escape: '\x1b[27u',
    };
    const results = await receive(Object.values(exposed), { render: KITTY });
    Object.keys(exposed).forEach((name, i) => t.deepEqual(trueFlags(results[i][0].key).filter((flag) => flag !== 'eventType'), [name], `${name} keeps its own flag`));
    // the rest: Insert, F1-F35, modifier-only presses (57441-57452), media keys (57428-57440), Caps Lock, Print Screen
    const others = [
      '\x1b[2;1~',
      ...FUNCTION_KEYS,
      ...Array.from({ length: 12 }, (_, i) => `\x1b[${57441 + i}u`),
      ...Array.from({ length: 13 }, (_, i) => `\x1b[${57428 + i}u`),
      '\x1b[57358u',
      '\x1b[57361u',
    ];
    t.equal(FUNCTION_KEYS.length, 35, 'F1 to F35');
    const keyResults = (await receive(others, { render: KITTY })).map(([call]) => call.key);
    keyResults.forEach((key, i) => t.deepEqual(trueFlags(key), [], `${JSON.stringify(others[i])} sets no flag`));
    t.equal(new Set(keyResults.map((key) => JSON.stringify(key))).size, 1, 'so these keys cannot be told apart through key');
  },
);

s.fact(F, ['**Ctrl+letter still works as expected.**'], { kind: 'R' }, async (t, q) => {
  const claim = { 'Ctrl+letter still works as expected.': true }[q.tok('Ctrl+letter still works as expected.')];
  t.ok(claim);
  const all = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const kitty = await receive(all.map((letter) => `\x1b[${letter.charCodeAt(0)};5u`), { render: KITTY });
  all.forEach((letter, i) => t.deepEqual([kitty[i][0].input, kitty[i][0].key.ctrl], [letter, true], `Ctrl+${letter} as a kitty-style sequence: the letter, with ctrl`));
  // the plain control bytes give the same, except Ctrl+H, Ctrl+I, Ctrl+J and Ctrl+M, whose bytes are Backspace, Tab, Line Feed and Return
  const comparable = all.filter((letter) => !'hijm'.includes(letter));
  const legacy = await receive(comparable.map((letter) => String.fromCharCode(letter.charCodeAt(0) - 96)));
  comparable.forEach((letter, i) => t.deepEqual([legacy[i][0].input, legacy[i][0].key.ctrl], [letter, true], `and so is the plain control byte of Ctrl+${letter}`));
});

s.fact(
  F,
  [
    'The sequence carries the unshifted letter and the Ctrl modifier (`ESC [ 99 ; 5 u`), so `Ctrl+C` is `input === \'c\'`, `key.ctrl === true`, the same as the plain `\\x03` byte, as long as `exitOnCtrlC` is `false` (by default Ink exits before the handler runs).',
  ],
  { kind: 'R' },
  async (t, q) => {
    const letter = q.tok('Ctrl+C').split('+')[1].toLowerCase();
    const sequence = bytesOf(q.tok('ESC [ 99 ; 5 u'));
    const plain = bytesOf(q.tok('\\x03'));
    t.equal(sequence, `\x1b[${letter.charCodeAt(0)};5u`, 'the sequence carries the unshifted letter c and modifier 5 (Ctrl is bit 4, plus 1)');
    t.equal(plain, String.fromCharCode(letter.charCodeAt(0) - 96), 'the plain byte is the letter minus 96');
    const optionName = q.tok('exitOnCtrlC');
    const option = { [optionName]: JSON.parse(q.tok('false')) };
    for (const [label, bytes, render] of [['sequence', sequence, { ...KITTY, ...option }], ['byte', plain, option]]) {
      const { input, key } = await one(bytes, { render });
      t.equal(evaluate(q.tok("input === 'c'"), { input }), true, `${label}: input is c`);
      t.equal(evaluate(q.tok('key.ctrl === true'), { key }), true, `${label}: key.ctrl is true`);
    }
    // by default Ink exits first and the handler never runs
    for (const [label, bytes, render] of [['sequence', sequence, { ...KITTY, [optionName]: undefined }], ['byte', plain, { [optionName]: undefined }]]) {
      const { app, send } = inputApp({ render });
      await app.flush();
      const exit = watchExit(app);
      const calls = await send(bytes);
      await waitFor(() => exit.done, { message: `exit on Ctrl+C (${label})` });
      t.deepEqual(calls, [], `${label}: by default the handler is not called`);
    }
  },
);

s.fact(F, ['**`input` vs. actual typed text can diverge.**'], { kind: 'R' }, async (t, q) => {
  const field = q.tok('input');
  const claim = { '`input` vs. actual typed text can diverge.': 'diverge' }[q.tok('`input` vs. actual typed text can diverge.')];
  t.equal(claim, 'diverge');
  const shifted = await one('\x1b[97;2u', { render: KITTY });
  t.notEqual(shifted[field], 'A', 'the typed text of Shift+A is A, but the handler gets something else');
  t.equal(shifted[field], 'a', 'the unshifted key');
});

s.fact(
  F,
  ["Without `reportAssociatedText`, `input` falls back to the unshifted key: `ESC [ 97 ; 2 u` (Shift+A) gives `input === 'a'` with `key.shift`."],
  { kind: 'R' },
  async (t, q) => {
    const flag = q.tok('reportAssociatedText');
    const field = q.tok('input');
    const shiftFlag = q.tok('key.shift').split('.')[1];
    const without = await plainApp({ kittyKeyboard: { mode: 'enabled', flags: ['reportAllKeysAsEscapeCodes'] } });
    t.ok(ink.kittyFlags[flag] > 0, 'reportAssociatedText is a protocol flag');
    t.equal(kittyWrites(without).enabled[0] & ink.kittyFlags[flag], 0, 'without the flag Ink does not ask for the text');
    const withFlag = await plainApp({ kittyKeyboard: { mode: 'enabled', flags: [flag] } });
    t.equal(kittyWrites(withFlag).enabled[0] & ink.kittyFlags[flag], ink.kittyFlags[flag], 'with it, it does');
    const { input, key } = await one(bytesOf(q.tok('ESC [ 97 ; 2 u')), { render: { kittyKeyboard: { mode: 'enabled', flags: ['reportAllKeysAsEscapeCodes'] } } });
    t.equal(evaluate(q.tok("input === 'a'"), { input }), true, 'input is the unshifted a');
    t.equal(key[shiftFlag], true, 'with key.shift set');
    t.equal(field, handlerParams().input);
  },
);

s.fact(
  F,
  ["With `reportAssociatedText` (which automatically enables `reportAllKeysAsEscapeCodes`) the sequence carries the real text: `ESC [ 97 ; 2 ; 65 u` gives `input === 'A'`."],
  { kind: 'R' },
  async (t, q) => {
    const text = q.tok('reportAssociatedText');
    const all = q.tok('reportAllKeysAsEscapeCodes');
    const app = await plainApp({ kittyKeyboard: { mode: 'enabled', flags: [text] } });
    const [bits] = kittyWrites(app).enabled;
    t.equal(bits, ink.kittyFlags[text] | ink.kittyFlags[all], 'asking for the text asks for every key as an escape code as well');
    const { input } = await one(bytesOf(q.tok('ESC [ 97 ; 2 ; 65 u')), { render: { kittyKeyboard: { mode: 'enabled', flags: [text] } } });
    t.equal(evaluate(q.tok("input === 'A'"), { input }), true, 'input is the real text');
    const composed = await one('\x1b[101;;233u', { render: KITTY });
    t.equal(composed.input, 'é', 'composed text arrives the same way');
  },
);

s.fact(
  F,
  [
    '**Previously-ambiguous keys become distinguishable**: `Ctrl+I` (`ESC [ 105 ; 5 u`) vs. `Tab` (`ESC [ 9 u`), `Shift+Enter` (`ESC [ 13 ; 2 u`) vs. `Enter` (`ESC [ 13 u`), `Escape` (`ESC [ 27 u`) vs. `Ctrl+[` (`ESC [ 91 ; 5 u`).',
  ],
  { kind: 'R' },
  async (t, q) => {
    const claim = { 'Previously-ambiguous keys become distinguishable': 'distinguishable' }[q.tok('Previously-ambiguous keys become distinguishable')];
    t.equal(claim, 'distinguishable');
    const property = { Tab: 'tab', Enter: 'return', Escape: 'escape' };
    const read = async (label, notation) => {
      const { input, key } = await one(bytesOf(q.tok(notation)), { render: KITTY });
      return { label, input, flags: trueFlags(key).filter((name) => name !== 'eventType') };
    };
    const ctrlI = await read('Ctrl+I', 'ESC [ 105 ; 5 u');
    const tab = await read('Tab', 'ESC [ 9 u');
    t.deepEqual([ctrlI.input, ctrlI.flags], [q.tok('Ctrl+I').split('+')[1].toLowerCase(), ['ctrl']], 'Ctrl+I is i with ctrl');
    t.deepEqual([tab.input, tab.flags], ['', [property[q.tok('Tab')]]], 'Tab is key.tab');
    const shiftEnter = await read('Shift+Enter', 'ESC [ 13 ; 2 u');
    const enter = await read('Enter', 'ESC [ 13 u');
    t.deepEqual(shiftEnter.flags, [q.tok('Shift+Enter').split('+')[0].toLowerCase(), property[q.tok('Enter')]].sort(), 'Shift+Enter is return with shift');
    t.deepEqual(enter.flags, [property.Enter], 'Enter is return alone');
    const escape = await read('Escape', 'ESC [ 27 u');
    const ctrlBracket = await read('Ctrl+[', 'ESC [ 91 ; 5 u');
    t.deepEqual(escape.flags, [property[q.tok('Escape')]], 'Escape is key.escape');
    t.deepEqual([ctrlBracket.input, ctrlBracket.flags], [q.tok('Ctrl+[').split('+')[1], ['ctrl']], 'Ctrl+[ is [ with ctrl and not escape');
    for (const [a, b] of [[ctrlI, tab], [shiftEnter, enter], [escape, ctrlBracket]]) t.notDeepEqual([a.input, a.flags], [b.input, b.flags], `${a.label} and ${b.label} differ`);
  },
);

s.fact(F, ['The plain bytes `\\x09`, `\\r` and `\\x1b` can only be read as Tab, Enter and Escape.'], { kind: 'R' }, async (t, q) => {
  const [tab, enter, escape] = ['\\x09', '\\r', '\\x1b'].map((notation) => bytesOf(q.tok(notation)));
  t.deepEqual(await flagsOf(tab), { input: '', flags: ['tab'] }, 'the byte 0x09 is Tab, and Ctrl+I cannot be told from it');
  t.deepEqual(await flagsOf(enter), { input: '\r', flags: ['return'] }, 'the byte \\r is Enter, and Shift+Enter cannot be told from it');
  t.deepEqual(await flagsOf(escape), { input: '', flags: ['escape'] }, 'the byte 0x1b is Escape, and Ctrl+[ cannot be told from it');
});

// ===================================================================== Protocol flags

s.fact(F, ['Passed to `render(<App/>, {kittyKeyboard: {flags: [...]}})`.'], { kind: 'R' }, async (t, q) => {
  const notation = 'render(<App/>, {kittyKeyboard: {flags: [...]}})';
  const [, option, flagsOption] = q.tok(notation).match(/^\w+\(<App\/>, \{(\w+): \{(\w+): \[\.\.\.\]\}\}\)$/);
  q.api(ink, notation);
  const app = await plainApp({ [option]: { mode: 'enabled', [flagsOption]: ['reportEventTypes'] } });
  t.deepEqual(kittyWrites(app).enabled, [ink.kittyFlags.reportEventTypes], 'the flags list given there is what Ink asks the terminal for');
});

s.types(
  F,
  ['Passed to `render(<App/>, {kittyKeyboard: {flags: [...]}})`.'],
  tsx`
import {render} from 'ink';

const App = () => null;
render(<App/>, {kittyKeyboard: {flags: ['reportEventTypes', 'reportAssociatedText']}});
render(<App/>, {kittyKeyboard: {flags: []}});
render(<App/>, {kittyKeyboard: {flags: ['reportEverything']}}); //! TS2322
// render(<App/>, {kittyKeyboard: {flags: [...]}})
`,
  { ctx: ['render(<App/>, {kittyKeyboard: {flags: [...]}})'] },
);

s.fact(F, ["Default: `['disambiguateEscapeCodes']`."], { kind: 'D' }, async (t, q) => {
  const flags = new Function(`return ${q.tok("['disambiguateEscapeCodes']")}`)();
  const app = await plainApp({ kittyKeyboard: { mode: 'enabled' } });
  t.deepEqual(kittyWrites(app).enabled, [flags.reduce((n, name) => n | ink.kittyFlags[name], 0)], 'without flags Ink asks for exactly these');
  const explicit = await plainApp({ kittyKeyboard: { mode: 'enabled', flags } });
  t.equal(written(explicit), written(app), 'which is the same as passing them');
  const other = await plainApp({ kittyKeyboard: { mode: 'enabled', flags: ['reportEventTypes'] } });
  t.notEqual(written(other), written(app), 'positive control: another list asks for something else');
});

/** What Ink writes for a protocol flag on its own. */
async function bitsFor(flag) {
  return kittyWrites(await plainApp({ kittyKeyboard: { mode: 'enabled', flags: [flag] } })).enabled;
}

s.fact(
  F,
  ['| `disambiguateEscapeCodes` | Sets bit `1`: asks the terminal to disambiguate keys that otherwise share an escape sequence. |'],
  { kind: 'R' },
  async (t, q) => {
    const flag = q.tok('disambiguateEscapeCodes');
    const bit = Number(q.tok('1'));
    t.deepEqual(await bitsFor(flag), [bit], 'the flag sets exactly that bit');
    t.equal(ink.kittyFlags[flag], bit);
    // the keys that share a sequence are told apart by what Ink reads from the disambiguated forms
    const tab = await one('\x1b[9u', { render: KITTY });
    const ctrlI = await one('\x1b[105;5u', { render: KITTY });
    t.notDeepEqual([tab.input, trueFlags(tab.key)], [ctrlI.input, trueFlags(ctrlI.key)], 'Tab and Ctrl+I read differently once reported as distinct codes');
  },
);

s.fact(F, ['| `reportEventTypes` | Sets bit `2`: asks for press/repeat/release, which Ink exposes as `key.eventType`. |'], { kind: 'R' }, async (t, q) => {
  const flag = q.tok('reportEventTypes');
  const bit = Number(q.tok('2'));
  const property = q.tok('key.eventType').split('.')[1];
  t.deepEqual(await bitsFor(flag), [bit], 'the flag sets exactly that bit');
  t.equal(ink.kittyFlags[flag], bit);
  const types = [];
  for (const field of [1, 2, 3]) types.push((await one(`\x1b[97;1:${field}u`, { render: { kittyKeyboard: { mode: 'enabled', flags: [flag] } } })).key[property]);
  t.deepEqual(types, ['press', 'repeat', 'release'], 'Ink exposes the reported event types as key.eventType');
});

s.fact(
  F,
  ["| `reportAlternateKeys` | Sets bit `4`: asks for alternate key encodings; Ink accepts but doesn't expose them — without associated text, `useInput` falls back to the primary key. |"],
  { kind: 'R' },
  async (t, q) => {
    const flag = q.tok('reportAlternateKeys');
    const bit = Number(q.tok('4'));
    q.api(ink, 'useInput');
    t.deepEqual(await bitsFor(flag), [bit], 'the flag sets exactly that bit');
    t.equal(ink.kittyFlags[flag], bit);
    // codepoint 97 (a) with its shifted key (65, A) and base-layout key (97) as alternates, and Shift
    const { input, key } = await one('\x1b[97:65:97;2u', { render: { kittyKeyboard: { mode: 'enabled', flags: [flag] } } });
    t.equal(input, 'a', 'the alternate keys are accepted and the primary key is what input holds');
    t.equal(key.shift, true);
  },
);

s.fact(F, ['| `reportAllKeysAsEscapeCodes` | Sets bit `8`: asks for every key as an escape code, not just special ones. |'], { kind: 'R' }, async (t, q) => {
  const flag = q.tok('reportAllKeysAsEscapeCodes');
  const bit = Number(q.tok('8'));
  t.deepEqual(await bitsFor(flag), [bit], 'the flag sets exactly that bit');
  t.equal(ink.kittyFlags[flag], bit);
  const { input, key } = await one('\x1b[97u', { render: { kittyKeyboard: { mode: 'enabled', flags: [flag] } } });
  t.deepEqual([input, trueFlags(key)], ['a', []], 'an ordinary letter reported as an escape code still gives its text');
});

s.fact(
  F,
  ['| `reportAssociatedText` | Sets bit `16`: asks for the actual composed/shifted text with key events, and sets bit `8` as well. |'],
  { kind: 'R' },
  async (t, q) => {
    const flag = q.tok('reportAssociatedText');
    const bit = Number(q.tok('16'));
    const implied = Number(q.tok('8'));
    t.equal(ink.kittyFlags[flag], bit);
    t.deepEqual(await bitsFor(flag), [bit | implied], 'the flag sets bit 16 and bit 8');
    t.equal(ink.kittyFlags.reportAllKeysAsEscapeCodes, implied, 'bit 8 is the all-keys flag');
    const { input } = await one('\x1b[97;2;65u', { render: { kittyKeyboard: { mode: 'enabled', flags: [flag] } } });
    t.equal(input, 'A', 'the text that comes with the key event is what input holds');
  },
);
