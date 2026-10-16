// Claims for skills/ecosystem/inkjs-ui/inkjs-ui-inputs/SKILL.md.
import { readFileSync } from 'node:fs';
import semver from 'semver';
import { skill, tsx, runFence, loadEcosystem, pkg, externalHarness, extImport } from '../lib/index.mjs';
import { ui, h, ink, keys, open, spy, captureConsole, skillText, lines, uiFile, literals } from './inkjs-ui-inputs.helpers.mjs';
import React from 'react';

const s = skill('inkjs-ui-inputs');
const F = 'SKILL.md';
const MD = skillText('inkjs-ui-inputs');

/** `Equal<A, B>` for type fixtures. */
const EQ = `type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;`;
const BOLD = '\x1b[1m';
const NOT_BOLD = '\x1b[22m';

// ===================================================================== description

s.fact(
  F,
  ['@inkjs/ui input components: TextInput, EmailInput, PasswordInput, ConfirmInput, Select, MultiSelect — props, onChange/onSubmit callbacks, defaultValue, and disabling.'],
  { kind: 'R' },
  async (t) => {
    for (const name of ['TextInput', 'EmailInput', 'PasswordInput', 'ConfirmInput', 'Select', 'MultiSelect']) t.equal(typeof ui[name], 'function', `${name} is an export of @inkjs/ui`);
    // the callbacks, defaultValue and disabling, on the plain text input
    const onChange = spy();
    const onSubmit = spy();
    const app = await open(h(ui.TextInput, { defaultValue: 'ab', onChange, onSubmit }));
    t.equal(app.screen(), 'ab', 'defaultValue is shown');
    await app.press('c', keys.enter);
    t.deepEqual(onChange.calls, [['abc']], 'onChange receives the new value');
    t.deepEqual(onSubmit.calls, [['abc']], 'onSubmit receives it on Enter');
    const quiet = spy();
    const disabled = await open(h(ui.TextInput, { isDisabled: true, onChange: quiet, onSubmit: quiet }));
    await disabled.press('c', keys.enter);
    t.deepEqual(quiet.calls, [], 'a disabled input ignores the keyboard');
  },
);

s.guidance(F, ['Use for prompting the user for text, email, a password, yes/no confirmation, or picking from a list of options.'], 'a recommendation about when to reach for the skill; it asserts nothing about behaviour (each input is exercised by the claims below)');

// ===================================================================== intro

s.fact(
  F,
  ["`@inkjs/ui` (peer `ink >=5`, which covers Ink 8) is the component library by Ink's authors (`vadimdemedes/ink-ui`; not an Anthropic project)."],
  { kind: 'P' },
  async (t, q) => {
    const name = q.tok('@inkjs/ui');
    const [inkName, range] = [q.tok('ink >=5').split(' ')[0], q.tok('ink >=5').split(' ').slice(1).join(' ')];
    t.equal(pkg(name).peerDependencies[inkName], range, 'the declared peer range of ink');
    const installed = pkg(inkName).version;
    t.ok(semver.satisfies(installed, range), `which accepts the installed ink ${installed}`);
    t.equal(semver.major(installed), Number(q.tok('8')), 'and that is Ink 8');
    t.ok(!semver.satisfies('4.4.1', range), 'while an Ink older than the range is outside it');

    const { packages } = await loadEcosystem();
    const entry = packages.find((p) => p.name === name);
    const ink = packages.find((p) => p.name === inkName);
    t.ok(entry.repository.endsWith(`/${q.tok('vadimdemedes/ink-ui')}`), 'its repository is the one named');
    const owner = (repository) => new URL(repository).pathname.split('/')[1];
    t.equal(owner(entry.repository), owner(ink.repository), "owned by the account that owns Ink's repository");
    t.deepEqual([...entry.maintainers].sort(), [...ink.maintainers].sort(), "published by the same maintainers as Ink: Ink's authors");
    t.ok(![entry.repository, ...entry.maintainers].some((value) => /anthropic/i.test(value)), 'and no Anthropic account is involved');
  },
);

s.fact(F, ['It renders on Ink 8.'], { kind: 'R' }, async (t, q) => {
  t.equal(semver.major(pkg('ink').version), Number(q.tok('8')), 'the Ink the tests run on is 8');
  const app = await open(h(ui.TextInput, { placeholder: 'Enter your name...' }));
  t.equal(app.screen(), 'Enter your name...', 'and an input renders and draws its placeholder on it');
});

s.fact(
  F,
  ['Its inputs are uncontrolled — there is no `value` prop — each managing its own keyboard handling internally.'],
  { kind: 'R' },
  async (t, q) => {
    const prop = q.tok('value');
    // positive control: a controlled input from another package does take a `value` prop and shows it
    const ext = await externalHarness();
    const { default: ControlledInput } = await extImport('ink-text-input');
    const controlled = ext.mount(ext.h(ControlledInput, { [prop]: 'forced', onChange() {} }));
    await controlled.flush();
    t.equal(controlled.screen(), 'forced', 'ink-text-input shows the value it is handed');

    const options = [{ label: 'Red', value: 'red' }, { label: 'Green', value: 'green' }];
    const inputs = {
      TextInput: { props: {}, press: ['a'], shows: 'a' },
      EmailInput: { props: {}, press: ['a'], shows: 'a' },
      PasswordInput: { props: {}, press: ['a'], shows: '*' },
      Select: { props: { options }, press: [keys.down], shows: /❯ Green/ },
      MultiSelect: { props: { options }, press: [' '], shows: /Red ✔/ },
    };
    for (const [name, { props, press, shows }] of Object.entries(inputs)) {
      const forced = await open(h(ui[name], { ...props, [prop]: 'forced' }));
      t.notEqual(forced.screen(), 'forced', `${name} ignores a ${prop} prop`);
      t.ok(!forced.screen().includes('forced'), `${name} does not show it`);
      // and handles its own keys: nothing wires the keyboard to it
      await forced.press(...press);
      if (shows instanceof RegExp) t.match(forced.screen(), shows, `${name} reacts to the keyboard by itself`);
      else t.equal(forced.screen(), shows, `${name} shows what was typed into it`);
    }
    const handled = spy();
    const confirm = await open(h(ui.ConfirmInput, { [prop]: 'forced', onConfirm: handled, onCancel: handled }));
    await confirm.press('y');
    t.equal(handled.calls.length, 1, 'ConfirmInput answers its own keys');
    t.equal(confirm.screen(), 'Y/n', 'and ignores the value prop');
  },
);

s.types(
  F,
  ['Its inputs are uncontrolled — there is no `value` prop — each managing its own keyboard handling internally.'],
  tsx`
import React from 'react';
import {TextInput, EmailInput, PasswordInput, ConfirmInput, Select, MultiSelect} from '@inkjs/ui';

const options = [{label: 'Red', value: 'red'}];
const noop = () => {};
export const text = <TextInput value="x" />; //! TS2322
export const email = <EmailInput value="x" />; //! TS2322
export const password = <PasswordInput value="x" />; //! TS2322
export const confirm = <ConfirmInput value="x" onConfirm={noop} onCancel={noop} />; //! TS2322
export const select = <Select value="x" options={options} />; //! TS2322
export const multi = <MultiSelect value={['x']} options={options} />; //! TS2322
export const fine = <TextInput defaultValue="x" />;
`,
);

s.guidance(
  F,
  ["Prefer these over hand-rolling the same thing with `useInput` unless a component's behavior is a poor fit."],
  "advice on when to use a ready-made input instead of writing one; whether a component's behaviour fits is the reader's call (the behaviour itself is proven by the claims below)",
  { exempt: ['useInput'] },
);

s.fence(F, 0, {
  run: async (t, fence) => {
    const command = fence.code.trim();
    t.match(command, /^npm install \S+$/, 'one install command');
    const name = command.split(' ').at(-1);
    const { packages, notOnNpm } = await loadEcosystem();
    t.ok(packages.some((p) => p.name === name), `${name} is a package in the registry data`);
    t.ok(!(notOnNpm ?? []).some((entry) => (entry.name ?? entry) === name), 'and is published on npm');
    t.equal(pkg(name).name, name, 'the installed package has that name');
  },
});

// ===================================================================== TextInput

s.fence(F, 1, {
  run: async (t, fence) => {
    const { mod } = await runFence(fence);
    const logged = await captureConsole(async () => {
      const app = await open(h(mod.Example));
      t.equal(app.screen(), 'Enter your name...', 'the placeholder is shown while empty');
      await app.press('A', 'd', 'a', keys.enter);
    });
    t.deepEqual(logged, [['Ada']], 'Enter logs the typed value');
  },
});

/** A type fixture for a TextInput prop: its exact type, a value it accepts and one it rejects. */
const typedFixture = (equal, good, bad) => tsx`
import React from 'react';
import {TextInput} from '@inkjs/ui';
${EQ}
type Props = React.ComponentProps<typeof TextInput>;
export const type: ${equal} = true;
export const ok = <TextInput ${good} />;
export const wrong = <TextInput ${bad} />; //! TS2322
`;

const ROW = {
  isDisabled: '`isDisabled` | `boolean` (default `false`) | Ignores input while disabled.',
  placeholder: '`placeholder` | `string` | Shown when empty.',
  defaultValue: '`defaultValue` | `string` | Initial value.',
  suggestions: '`suggestions` | `string[]` | Autocomplete candidates; Enter accepts the first one that starts with the typed text.',
  onChange: '`onChange` | `(value: string) => void` | Fires each time the value changes.',
  onSubmit: '`onSubmit` | `(value: string) => void` | Fires on Enter.',
};

s.types(F, [ROW.isDisabled], tsx`
import React from 'react';
import {TextInput} from '@inkjs/ui';
${EQ}
type Props = React.ComponentProps<typeof TextInput>;
export const type: Equal<Props['isDisabled'], boolean | undefined> = true;
export const off = <TextInput isDisabled={false} />;
export const on = <TextInput isDisabled />;
export const wrong = <TextInput isDisabled="no" />; //! TS2322
`);
s.fact(F, [ROW.isDisabled], { kind: 'D' }, async (t, q) => {
  const prop = q.tok('isDisabled');
  const dflt = JSON.parse(q.tok('false'));
  t.equal(typeof dflt, q.tok('boolean'), 'a boolean');
  const run = async (props) => {
    const calls = [];
    const app = await open(h(ui.TextInput, { onChange: (v) => calls.push(['change', v]), onSubmit: (v) => calls.push(['submit', v]), ...props }));
    await app.press('a', keys.enter);
    return { calls, raw: app.stdin.rawModeCalls, screen: app.screen() };
  };
  const omitted = await run({});
  t.deepEqual(omitted.calls, [['change', 'a'], ['submit', 'a']], 'by default the input takes keys');
  t.deepEqual((await run({ [prop]: dflt })).calls, omitted.calls, 'so false is the default');
  const disabled = await run({ [prop]: !dflt });
  t.deepEqual(disabled.calls, [], 'while disabled no key reaches onChange or onSubmit');
  t.equal(disabled.screen, '', 'and nothing is typed');
  t.deepEqual(disabled.raw, [], 'the input does not even listen to the keyboard');
  t.deepEqual(omitted.raw, [true], 'an enabled one does');
});

s.types(F, [ROW.placeholder], typedFixture('Equal<Props["placeholder"], string | undefined>', 'placeholder="Name"', 'placeholder={1}'));
s.fact(F, [ROW.placeholder], { kind: 'R' }, async (t, q) => {
  const prop = q.tok('placeholder');
  const text = 'Your name';
  t.equal(typeof text, q.tok('string'), 'a string');
  const app = await open(h(ui.TextInput, { [prop]: text }));
  t.equal(app.screen(), text, 'shown while the input is empty');
  await app.press('x');
  t.equal(app.screen(), 'x', 'gone once there is a value');
  await app.press(keys.backspace);
  t.equal(app.screen(), text, 'and back when it is empty again');
});

s.types(F, [ROW.defaultValue], typedFixture('Equal<Props["defaultValue"], string | undefined>', 'defaultValue="Ada"', 'defaultValue={1}'));
s.fact(F, [ROW.defaultValue], { kind: 'R' }, async (t, q) => {
  const prop = q.tok('defaultValue');
  t.equal(typeof 'Ada', q.tok('string'), 'a string');
  const calls = [];
  const app = await open(h(ui.TextInput, { [prop]: 'Ada', onChange: (v) => calls.push(v) }));
  t.equal(app.screen(), 'Ada', 'it is the value the input starts with');
  t.deepEqual(calls, [], 'without announcing it as a change');
  await app.press('!');
  t.equal(app.screen(), 'Ada!', 'typing continues from it');
  await app.rerender(h(ui.TextInput, { [prop]: 'Bob', onChange: (v) => calls.push(v) }));
  t.equal(app.screen(), 'Ada!', 'and a later defaultValue changes nothing: it is only the initial value');
});

s.types(F, [ROW.suggestions], typedFixture('Equal<Props["suggestions"], string[] | undefined>', "suggestions={['apple']}", 'suggestions="apple"'));
s.fact(F, [ROW.suggestions], { kind: 'R' }, async (t, q) => {
  const prop = q.tok('suggestions');
  const list = ['apple', 'apricot', 'banana'];
  t.ok(Array.isArray(list) && list.every((entry) => typeof entry === q.tok('string[]').replace('[]', '')), 'a list of strings');
  const calls = [];
  const app = await open(h(ui.TextInput, { [prop]: list, onSubmit: (v) => calls.push(v) }));
  await app.press('a', 'p');
  t.equal(app.screen(), 'apple', 'the first candidate that starts with the typed text is shown completed');
  await app.press('r');
  t.equal(app.screen(), 'apricot', 'and follows the typed text');
  await app.press(keys.backspace, keys.backspace, keys.backspace, 'b');
  t.equal(app.screen(), 'banana', 'a candidate must start with the whole typed text');
  await app.press('x');
  t.equal(app.screen(), 'bx', 'with no candidate nothing is added');
  await app.press(keys.backspace, keys.backspace, 'a', 'p');
  await app.press(keys.enter);
  t.deepEqual(calls, ['apple'], 'Enter accepts it: the submitted value is the completed one');
  t.equal(app.screen(), 'apple', 'and the field now holds it');
  const plain = spy();
  const without = await open(h(ui.TextInput, { onSubmit: plain }));
  await without.press('a', 'p', keys.enter);
  t.deepEqual(plain.calls, [['ap']], 'positive control: without suggestions Enter submits what was typed');
});

s.types(F, [ROW.onChange], typedFixture('Equal<NonNullable<Props["onChange"]>, (value: string) => void>', 'onChange={(value: string) => {}}', 'onChange={(value: number) => {}}'));
s.fact(F, [ROW.onChange], { kind: 'R' }, async (t, q) => {
  const prop = q.tok('onChange');
  const [, param, paramType] = q.tok('(value: string) => void').match(/^\((\w+): (\w+)\) => void$/);
  const onChange = spy();
  const app = await open(h(ui.TextInput, { [prop]: onChange }));
  await app.press('a', 'b');
  t.deepEqual(onChange.calls, [['a'], ['ab']], `called with the new ${param}, once per typed character`);
  t.equal(typeof onChange.calls[0][0], paramType, 'a string');
  await app.press(keys.backspace);
  t.deepEqual(onChange.calls.at(-1), ['a'], 'and when a character is deleted');
  const before = onChange.calls.length;
  await app.press(keys.left, keys.right, keys.up, keys.down, keys.enter);
  t.equal(onChange.calls.length, before, 'but not for keys that leave the value as it is (the arrows, Enter)');
});

s.types(F, [ROW.onSubmit], tsx`
import React from 'react';
import {TextInput} from '@inkjs/ui';
${EQ}
type Props = React.ComponentProps<typeof TextInput>;
export const type: Equal<NonNullable<Props['onSubmit']>, (value: string) => void> = true;
export const ok = <TextInput onSubmit={(value: string) => {}} />;
export const wrong = <TextInput onSubmit={(value: number) => {}} />; //! TS2322
`);
s.fact(F, [ROW.onSubmit], { kind: 'R' }, async (t, q) => {
  const prop = q.tok('onSubmit');
  const [, , paramType] = q.tok('(value: string) => void').match(/^\((\w+): (\w+)\) => void$/);
  const onSubmit = spy();
  const app = await open(h(ui.TextInput, { [prop]: onSubmit, defaultValue: 'ab' }));
  await app.press('c');
  t.deepEqual(onSubmit.calls, [], 'typing does not submit');
  await app.press(keys.enter);
  t.deepEqual(onSubmit.calls, [['abc']], 'Enter submits the current value');
  t.equal(typeof onSubmit.calls[0][0], paramType, 'a string');
  await app.press(keys.enter);
  t.equal(onSubmit.calls.length, 2, 'every Enter submits again');
});

// ===================================================================== EmailInput

const EMAIL = 'Same props as `TextInput` except `suggestions`, plus `domains?: string[]` (default: the common providers — aol.com, gmail.com, yahoo.com, hotmail.com, live.com, outlook.com, icloud.com, hey.com) used to autocomplete after `@` (Enter accepts the suggestion).';

s.types(F, [EMAIL], tsx`
import React from 'react';
import {TextInput, EmailInput} from '@inkjs/ui';
${EQ}
type TextProps = React.ComponentProps<typeof TextInput>;
type EmailProps = React.ComponentProps<typeof EmailInput>;
export const sameKeysButSuggestions: Equal<keyof EmailProps, Exclude<keyof TextProps, 'suggestions'> | 'domains'> = true;
export const sameTypes: Equal<Omit<EmailProps, 'domains'>, Omit<TextProps, 'suggestions'>> = true;
export const domains: Equal<Pick<EmailProps, 'domains'>, {readonly domains?: string[]}> = true;
export const optional: Equal<{} extends Pick<EmailProps, 'domains'> ? true : false, true> = true;
export const ok = <EmailInput domains={['example.org']} placeholder="e" defaultValue="d" isDisabled onChange={() => {}} onSubmit={() => {}} />;
export const noSuggestions = <EmailInput suggestions={['a@b.c']} />; //! TS2322
export const wrong = <EmailInput domains="example.org" />; //! TS2322
`);

s.fact(F, [EMAIL], { kind: 'D' }, async (t, q) => {
  const domainsProp = q.tok('domains?: string[]').split('?')[0];
  const at = q.tok('@');
  const TextInput = q.api(ui, 'TextInput');
  const suggestionsProp = q.tok('suggestions');
  const listed = MD.match(/\(default: the common providers — ([^)]*)\)/)[1].split(', ');
  const declared = JSON.parse(uiFile('components/email-input/email-input.d.ts').match(/@default (\[[^\]]*\])/)[1]);
  t.deepEqual(listed, declared, 'the default list is the one the package declares');
  t.equal(listed.length, 8, 'eight providers');

  const type = async (props, ...chars) => {
    const calls = [];
    const app = await open(h(ui.EmailInput, { onSubmit: (v) => calls.push(v), ...props }));
    await app.press(...chars);
    return { app, calls };
  };
  for (const domain of listed) {
    // the completion is the first provider that starts with what was typed after the @: type the
    // shortest prefix of this one that no provider listed before it starts with
    const earlier = listed.slice(0, listed.indexOf(domain));
    const typed = [...domain].reduce((prefix, character) => (earlier.some((other) => other.startsWith(prefix)) ? prefix + character : prefix), '');
    const { app } = await type({}, 'm', 'e', at, ...typed);
    t.equal(app.screen(), `me${at}${domain}`, `me${at}${typed} is completed to the default provider ${domain}`);
  }
  const before = await type({}, 'm', 'e');
  t.equal(before.app.screen(), 'me', 'nothing is suggested before the @');
  const none = await type({}, 'm', 'e', at, 'z');
  t.equal(none.app.screen(), `me${at}z`, 'nor for a domain no provider starts with');
  const accepted = await type({}, 'm', 'e', at, 'g', keys.enter);
  t.deepEqual(accepted.calls, [`me${at}gmail.com`], 'Enter accepts the suggestion: the submitted value is the completed address');
  const custom = await type({ [domainsProp]: ['example.org'] }, 'm', 'e', at, 'e');
  t.equal(custom.app.screen(), `me${at}example.org`, 'a custom domains list is what is completed');
  const replaced = await type({ [domainsProp]: ['example.org'] }, 'm', 'e', at, 'g');
  t.equal(replaced.app.screen(), `me${at}g`, 'and replaces the default providers');

  // the other props are the ones of TextInput: same behaviour
  const app = await open(h(ui.EmailInput, { defaultValue: 'a@', placeholder: 'p' }));
  t.equal(app.screen(), 'a@aol.com', 'defaultValue starts the field (and is completed)');
  const off = await open(h(ui.EmailInput, { isDisabled: true, placeholder: 'Enter email...' }));
  await off.press('a');
  t.equal(off.screen(), 'Enter email...', 'isDisabled ignores the keyboard');
  const withSuggestions = await open(h(ui.EmailInput, { [suggestionsProp]: ['abc'] }));
  await withSuggestions.press('a');
  t.equal(withSuggestions.screen(), 'a', 'suggestions, which TextInput has, does nothing here');
  const control = await open(h(TextInput, { [suggestionsProp]: ['abc'] }));
  await control.press('a');
  t.equal(control.screen(), 'abc', 'positive control: it does on TextInput');
});

s.fence(F, 2, {
  run: async (t, fence) => {
    const { mod } = await runFence(fence);
    const logged = await captureConsole(async () => {
      const app = await open(h(mod.Example));
      t.equal(app.screen(), 'Enter email...', 'the placeholder is shown');
      await app.press('a', '@', 'g', keys.enter);
    });
    t.deepEqual(logged, [['a@gmail.com']], 'Enter logs the completed address');
  },
});

// ===================================================================== PasswordInput

const PASSWORD = "Same as `TextInput` minus `suggestions`/`defaultValue` — masks input as it's typed, showing each character as `*` (the callbacks still receive the real text).";

s.types(F, [PASSWORD], tsx`
import React from 'react';
import {TextInput, PasswordInput} from '@inkjs/ui';
${EQ}
type TextProps = React.ComponentProps<typeof TextInput>;
type PasswordProps = React.ComponentProps<typeof PasswordInput>;
export const sameKeys: Equal<keyof PasswordProps, Exclude<keyof TextProps, 'suggestions' | 'defaultValue'>> = true;
export const sameTypes: Equal<PasswordProps, Omit<TextProps, 'suggestions' | 'defaultValue'>> = true;
export const noSuggestions = <PasswordInput suggestions={['x']} />; //! TS2322
export const noDefault = <PasswordInput defaultValue="x" />; //! TS2322
export const ok = <PasswordInput isDisabled placeholder="p" onChange={() => {}} onSubmit={() => {}} />;
// the same two props are fine on TextInput
export const text = <TextInput suggestions={['x']} defaultValue="x" />;
`, { ctx: ['*'] });

s.fact(F, [PASSWORD], { kind: 'R' }, async (t, q) => {
  const mask = q.tok('*');
  const TextInput = q.api(ui, 'TextInput');
  const dropped = [q.tok('suggestions'), q.tok('defaultValue')];
  const onChange = spy();
  const onSubmit = spy();
  const app = await open(h(ui.PasswordInput, { placeholder: 'Enter password...', onChange, onSubmit }));
  t.equal(app.screen(), 'Enter password...');
  await app.press('s', 'e', 'c');
  t.equal(app.screen(), mask.repeat(3), 'each typed character is shown as a mask character');
  t.ok(!/s|e|c/.test(app.screen()), 'and the text itself never appears');
  t.deepEqual(onChange.calls, [['s'], ['se'], ['sec']], 'onChange receives the real text');
  await app.press(keys.enter);
  t.deepEqual(onSubmit.calls, [['sec']], 'and so does onSubmit');
  // what TextInput has and PasswordInput does not
  const [suggestionsProp, defaultValueProp] = dropped;
  const withSuggestions = async (Input) => {
    const app = await open(h(Input, { [suggestionsProp]: ['xyz'] }));
    await app.press('x');
    return app.screen();
  };
  t.equal(await withSuggestions(TextInput), 'xyz', 'positive control: TextInput completes a suggestion');
  t.equal(await withSuggestions(ui.PasswordInput), mask, 'PasswordInput does not: only the mask is shown');
  const withDefault = async (Input) => (await open(h(Input, { [defaultValueProp]: 'secret', placeholder: 'ph' }))).screen();
  t.equal(await withDefault(TextInput), 'secret', 'positive control: TextInput starts with its defaultValue');
  t.equal(await withDefault(ui.PasswordInput), 'ph', 'PasswordInput starts empty: neither the text nor a mask is shown');
  const quiet = spy();
  const off = await open(h(ui.PasswordInput, { isDisabled: true, onChange: quiet, onSubmit: quiet }));
  await off.press('a', keys.enter);
  t.deepEqual(quiet.calls, [], 'isDisabled works as on TextInput');
});

s.fence(F, 3, {
  run: async (t, fence) => {
    const { mod } = await runFence(fence);
    const logged = await captureConsole(async () => {
      const app = await open(h(mod.Example));
      t.equal(app.screen(), 'Enter password...', 'the placeholder is shown');
      await app.press('p', 'w', keys.enter);
      t.equal(app.screen(), '**', 'the typed text is masked');
    });
    t.deepEqual(logged, [['pw']], 'but the submitted value is the real one');
  },
});

// ===================================================================== ConfirmInput

s.fact(F, ['A yes/no prompt: Y confirms and N cancels, in either case.'], { kind: 'R' }, async (t) => {
  const confirms = spy();
  const cancels = spy();
  const app = await open(h(ui.ConfirmInput, { onConfirm: confirms, onCancel: cancels }));
  t.equal(app.screen(), 'Y/n', 'it shows the yes/no choices');
  await app.press('y');
  await app.press('Y');
  t.equal(confirms.calls.length, 2, 'y and Y confirm');
  t.equal(cancels.calls.length, 0);
  await app.press('n');
  await app.press('N');
  t.equal(cancels.calls.length, 2, 'n and N cancel');
  t.equal(confirms.calls.length, 2);
  await app.press('x', ' ', keys.tab, keys.left);
  t.equal(confirms.calls.length + cancels.calls.length, 4, 'other keys do nothing');
});

s.types(
  F,
  ['`onConfirm`/`onCancel` are **required**, not optional — pressing the key for a missing handler throws.'],
  tsx`
import React from 'react';
import {ConfirmInput} from '@inkjs/ui';
${EQ}
type Props = React.ComponentProps<typeof ConfirmInput>;
export const onConfirm: Equal<{} extends Pick<Props, 'onConfirm'> ? true : false, false> = true;
export const onCancel: Equal<{} extends Pick<Props, 'onCancel'> ? true : false, false> = true;
export const ok = <ConfirmInput onConfirm={() => {}} onCancel={() => {}} />;
export const noConfirm = <ConfirmInput onCancel={() => {}} />; //! TS2741
export const noCancel = <ConfirmInput onConfirm={() => {}} />; //! TS2741
export const none = <ConfirmInput />; //! TS2739
// required is the TypeScript modifier
export const required: Equal<Required<Pick<Props, 'onConfirm'>>, Pick<Props, 'onConfirm'>> = true;
`,
);

s.fact(
  F,
  ['`onConfirm`/`onCancel` are **required**, not optional — pressing the key for a missing handler throws.'],
  { kind: 'R', ctx: ['required'] },
  async (t, q) => {
    const [confirm, cancel] = [q.tok('onConfirm'), q.tok('onCancel')];
    const press = async (props, key) => {
      const app = await open(h(ui.ConfirmInput, props));
      let thrown = null;
      try {
        app.stdin.write(key);
        await app.flush();
      } catch (error) {
        thrown = error;
      }
      return thrown;
    };
    const given = spy();
    t.equal(await press({ [confirm]: given, [cancel]: given }, 'y'), null, 'positive control: with both handlers pressing y is fine');
    t.equal(given.calls.length, 1);
    const withoutConfirm = await press({ [cancel]: given }, 'y');
    t.ok(withoutConfirm instanceof TypeError, 'y without onConfirm throws');
    t.match(withoutConfirm.message, new RegExp(`${confirm} is not a function`));
    const withoutCancel = await press({ [confirm]: given }, 'n');
    t.ok(withoutCancel instanceof TypeError, 'n without onCancel throws');
    t.match(withoutCancel.message, new RegExp(`${cancel} is not a function`));
    t.equal(await press({ [cancel]: given }, 'n'), null, 'a handler that was passed is not affected by the other missing one');
  },
);

s.fence(F, 4, {
  run: async (t, fence) => {
    const { mod } = await runFence(fence);
    const logged = await captureConsole(async () => {
      const app = await open(h(mod.Example));
      t.equal(app.screen(), 'Y/n');
      await app.press(keys.enter);
      await app.press('n');
    });
    t.deepEqual(logged, [['confirmed'], ['cancelled']], 'Enter confirms, n cancels');
  },
});

s.types(
  F,
  ["`defaultChoice` (`'confirm' | 'cancel'`, default `'confirm'`) controls what pressing Enter does."],
  tsx`
import React from 'react';
import {ConfirmInput} from '@inkjs/ui';
${EQ}
type Props = React.ComponentProps<typeof ConfirmInput>;
export const type: Equal<Props['defaultChoice'], 'confirm' | 'cancel' | undefined> = true;
export const confirm = <ConfirmInput defaultChoice="confirm" onConfirm={() => {}} onCancel={() => {}} />;
export const cancel = <ConfirmInput defaultChoice="cancel" onConfirm={() => {}} onCancel={() => {}} />;
export const wrong = <ConfirmInput defaultChoice="maybe" onConfirm={() => {}} onCancel={() => {}} />; //! TS2322
`,
);
s.fact(
  F,
  ["`defaultChoice` (`'confirm' | 'cancel'`, default `'confirm'`) controls what pressing Enter does."],
  { kind: 'D' },
  async (t, q) => {
    const prop = q.tok('defaultChoice');
    const choices = literals(q.tok("'confirm' | 'cancel'"));
    const dflt = literals(q.tok("'confirm'"))[0];
    t.deepEqual(choices, ['confirm', 'cancel'], 'two choices');
    const handlerOf = (choice) => `on${choice[0].toUpperCase()}${choice.slice(1)}`;
    const enter = async (props) => {
      const calls = [];
      const handlers = Object.fromEntries(choices.map((choice) => [handlerOf(choice), () => calls.push(choice)]));
      const app = await open(h(ui.ConfirmInput, { ...handlers, ...props }));
      await app.press(keys.enter);
      return { calls, screen: app.screen() };
    };
    for (const choice of choices) {
      const { calls } = await enter({ [prop]: choice });
      t.deepEqual(calls, [choice], `defaultChoice ${choice}: Enter calls ${handlerOf(choice)}`);
    }
    t.deepEqual((await enter({})).calls, [dflt], `without the prop Enter does what ${dflt} does`);
    t.equal((await enter({})).screen, (await enter({ [prop]: dflt })).screen, 'and the prompt reads the same');
    t.notEqual((await enter({ [prop]: 'cancel' })).screen, (await enter({ [prop]: 'confirm' })).screen, 'while the other choice reads differently');
  },
);

s.fact(
  F,
  ['Set `submitOnEnter={false}` to require an explicit "Y" keypress instead of letting Enter silently accept the default'],
  { kind: 'D' },
  async (t, q) => {
    const [, prop, expression] = q.tok('submitOnEnter={false}').match(/^(\w+)=\{(.*)\}$/);
    const value = JSON.parse(expression);
    const key = q.tok('Y');
    const run = async (props, ...presses) => {
      const calls = [];
      const app = await open(h(ui.ConfirmInput, { onConfirm: () => calls.push('confirm'), onCancel: () => calls.push('cancel'), ...props }));
      await app.press(...presses);
      return calls;
    };
    t.deepEqual(await run({}, keys.enter), ['confirm'], 'positive control: by default Enter accepts');
    t.deepEqual(await run({ [prop]: !value }, keys.enter), ['confirm'], 'also with the prop set to true');
    t.deepEqual(await run({ [prop]: value }, keys.enter), [], 'with the prop false Enter does nothing');
    t.deepEqual(await run({ [prop]: value, defaultChoice: 'cancel' }, keys.enter), [], 'whichever choice is the default');
    t.deepEqual(await run({ [prop]: value }, keys.enter, key), ['confirm'], 'and the explicit Y confirms');
  },
);

s.guidance(F, ['worth doing for a destructive confirmation.'], 'a recommendation about when to require an explicit keypress; what the option does is proven by the claim on the sentence it belongs to');

// ===================================================================== Select

const SELECT_OPTIONS = [
  { label: 'Red', value: 'red' },
  { label: 'Green', value: 'green' },
  { label: 'Blue', value: 'blue' },
];

s.fence(F, 5, {
  run: async (t, fence) => {
    const { mod } = await runFence(fence);
    const logged = await captureConsole(async () => {
      const app = await open(h(mod.Example));
      t.deepEqual(lines(app).map((line) => line.replace(/^[❯ ] ?/, '').trim()), ['Red', 'Green', 'Blue'], 'the three options, in order');
      t.match(lines(app)[0], /^❯ Red/, 'the first one is focused');
      await app.press(keys.down, keys.enter);
    });
    t.deepEqual(logged, [['green']], 'choosing Green logs its value');
  },
});

s.types(F, ['`options: {label: string; value: string}[]` is required.'], tsx`
import React from 'react';
import {Select} from '@inkjs/ui';
${EQ}
type Props = React.ComponentProps<typeof Select>;
export const type: Equal<Props['options'], {label: string; value: string}[]> = true;
export const required: Equal<{} extends Pick<Props, 'options'> ? true : false, false> = true;
export const declared: Equal<Pick<Props, 'options'>, {readonly options: {label: string; value: string}[]}> = true;
export const ok = <Select options={[{label: 'Red', value: 'red'}]} />;
export const missing = <Select />; //! TS2741
export const noValue = <Select options={[{label: 'Red'}]} />; //! TS2741
export const noLabel = <Select options={[{value: 'red'}]} />; //! TS2741
`);
s.fact(F, ['`options: {label: string; value: string}[]` is required.'], { kind: 'R' }, async (t, q) => {
  const [, prop, shape] = q.tok('options: {label: string; value: string}[]').match(/^(\w+): \{(.*)\}\[\]$/);
  const [labelKey, valueKey] = shape.split('; ').map((member) => member.split(': ')[0]);
  const calls = [];
  const app = await open(h(ui.Select, { [prop]: [{ [labelKey]: 'First one', [valueKey]: 'v1' }, { [labelKey]: 'Second one', [valueKey]: 'v2' }], onChange: (v) => calls.push(v) }));
  t.deepEqual(lines(app).map((l) => l.replace(/^[❯ ] ?/, '').trim()), ['First one', 'Second one'], 'the labels are what is shown');
  await app.press(keys.down, keys.enter);
  t.deepEqual(calls, ['v2'], 'and the value is what is reported');
  const thrown = (() => {
    try {
      ink.renderToString(h(ui.Select, {}));
      return null;
    } catch (error) {
      return error;
    }
  })();
  t.ok(thrown instanceof Error, 'without options the component cannot render');
});

s.fact(
  F,
  ['`visibleOptionCount` (default `5`) caps how many options render at once — the list scrolls internally as the user moves past that.'],
  { kind: 'D' },
  async (t, q) => {
    const prop = q.tok('visibleOptionCount');
    const count = Number(q.tok('5'));
    const many = Array.from({ length: 9 }, (_, i) => ({ label: `Item ${i + 1}`, value: `v${i + 1}` }));
    const shown = (app) => lines(app).map((line) => line.replace(/^[❯ ] ?/, '').trim());
    const dflt = await open(h(ui.Select, { options: many }));
    t.equal(shown(dflt).length, count, 'by default that many options are shown');
    t.deepEqual(shown(dflt), many.slice(0, count).map((o) => o.label), 'the first ones');
    t.equal(shown(await open(h(ui.Select, { options: many, [prop]: count }))).length, count, 'and passing it explicitly changes nothing');
    t.equal(shown(await open(h(ui.Select, { options: many, [prop]: count + 1 }))).length, count + 1, 'a larger value shows more');
    t.equal(shown(await open(h(ui.Select, { options: many, [prop]: 2 }))).length, 2, 'a smaller one fewer');
    t.equal(shown(await open(h(ui.Select, { options: many.slice(0, 2) }))).length, 2, 'there are never more rows than options');
    for (let i = 0; i < count - 1; i++) await dflt.press(keys.down);
    t.deepEqual(shown(dflt), many.slice(0, count).map((o) => o.label), 'moving within the window does not scroll');
    await dflt.press(keys.down);
    t.deepEqual(shown(dflt), many.slice(1, count + 1).map((o) => o.label), 'moving past it scrolls the list by one');
    t.match(lines(dflt).at(-1), /^❯ Item 6/, 'with the focus on the last visible option');
    for (let i = 0; i < 20; i++) await dflt.press(keys.down);
    t.deepEqual(shown(dflt), many.slice(-count).map((o) => o.label), 'down to the end of the list');
  },
);

s.fact(
  F,
  ['`highlightText` highlights the first occurrence of a substring within option labels — pass a filter/search input\'s text to it when combining `Select` with one above it.'],
  { kind: 'R' },
  async (t, q) => {
    const prop = q.tok('highlightText');
    const Select = q.api(ui, 'Select');
    const options = [{ label: 'Green', value: 'green' }, { label: 'Blue', value: 'blue' }, { label: 'Red', value: 'red' }];
    const app = await open(h(Select, { options, [prop]: 'e' }));
    const bytes = app.bytes();
    t.ok(bytes.includes(`Gr${BOLD}e${NOT_BOLD}en`), 'the first occurrence inside a label is bold, the second is not');
    t.ok(bytes.includes(`Blu${BOLD}e${NOT_BOLD}`), 'in every label that contains it');
    t.ok(bytes.includes(`R${BOLD}e${NOT_BOLD}d`));
    const none = await open(h(Select, { options, [prop]: 'zz' }));
    t.ok(!none.bytes().includes(BOLD), 'a text no label contains highlights nothing');
    const plain = await open(h(Select, { options }));
    t.ok(!plain.bytes().includes(BOLD), 'positive control: without the prop nothing is bold');

    // combined with a text input above it: what is typed is what is highlighted
    const { useState } = React;
    const Search = () => {
      const [text, setText] = useState('');
      return h(ink.Box, { flexDirection: 'column' }, h(ui.TextInput, { onChange: setText }), h(Select, { options, [prop]: text }));
    };
    const search = await open(h(Search));
    const bytesBefore = search.bytes().length;
    await search.press('l');
    const afterTyping = search.bytes().slice(bytesBefore);
    t.ok(afterTyping.includes(`B${BOLD}l${NOT_BOLD}ue`), 'typing l into the input above highlights the l in Blue');
    t.equal(afterTyping.split(BOLD).length - 1, 1, 'and nothing else: only one label contains it, so there is one highlighted run');
  },
);

// ===================================================================== MultiSelect

const MULTI = 'Same shape as `Select` but `defaultValue`/`onChange` are `string[]`, and it adds `onSubmit?: (value: string[]) => void` for confirming the whole selection with Enter (vs. `onChange` firing on every Space toggle).';

s.types(F, [MULTI], tsx`
import React from 'react';
import {Select, MultiSelect} from '@inkjs/ui';
${EQ}
type SelectProps = React.ComponentProps<typeof Select>;
type MultiProps = React.ComponentProps<typeof MultiSelect>;
export const sameKeysPlusOnSubmit: Equal<keyof MultiProps, keyof SelectProps | 'onSubmit'> = true;
export const sameOthers: Equal<Omit<MultiProps, 'defaultValue' | 'onChange' | 'onSubmit'>, Omit<SelectProps, 'defaultValue' | 'onChange'>> = true;
export const defaultValue: Equal<MultiProps['defaultValue'], string[] | undefined> = true;
export const selectDefaultValue: Equal<SelectProps['defaultValue'], string | undefined> = true;
export const onChange: Equal<NonNullable<MultiProps['onChange']>, (value: string[]) => void> = true;
export const onSubmit: Equal<Pick<MultiProps, 'onSubmit'>, {readonly onSubmit?: (value: string[]) => void}> = true;
export const optional: Equal<{} extends Pick<MultiProps, 'onSubmit'> ? true : false, true> = true;
export const selectHasNoOnSubmit = <Select options={[]} onSubmit={() => {}} />; //! TS2322
export const ok = <MultiSelect options={[]} defaultValue={['a']} onChange={(value: string[]) => {}} onSubmit={(value: string[]) => {}} />;
export const wrongDefault = <MultiSelect options={[]} defaultValue="a" />; //! TS2322
export const wrongChange = <MultiSelect options={[]} onChange={(value: string) => {}} />; //! TS2322
`);

s.fact(F, [MULTI], { kind: 'R' }, async (t, q) => {
  const Select = q.api(ui, 'Select');
  const [defaultValueProp, onChangeProp] = [q.tok('defaultValue'), q.tok('onChange')];
  const submitProp = q.tok('onSubmit?: (value: string[]) => void').split('?')[0];
  const arrayType = q.tok('string[]');
  const options = SELECT_OPTIONS;
  const run = async (props, ...presses) => {
    const changes = [];
    const submits = [];
    const app = await open(h(ui.MultiSelect, { options, [onChangeProp]: (v) => changes.push(v), [submitProp]: (v) => submits.push(v), ...props }));
    await app.press(...presses);
    return { app, changes, submits };
  };
  const toggled = await run({}, ' ', keys.down, ' ', ' ');
  t.deepEqual(toggled.changes, [['red'], ['red', 'green'], ['red']], 'onChange gets an array of the selected values on every Space toggle, selecting and deselecting');
  t.ok(toggled.changes.every((value) => Array.isArray(value) && value.every((entry) => typeof entry === arrayType.replace('[]', ''))), `arrays of strings (${arrayType})`);
  t.deepEqual(toggled.submits, [], 'onSubmit is not called by toggling');
  await toggled.app.press(keys.enter);
  t.deepEqual(toggled.submits, [[ 'red' ]], 'Enter submits the whole selection');
  t.equal(toggled.changes.length, 3, 'without another onChange');
  const preselected = await run({ [defaultValueProp]: ['green'] }, keys.enter);
  t.deepEqual(preselected.submits, [['green']], 'defaultValue is an array of values that start selected');
  t.match(lines(preselected.app)[1], /Green ✔/, 'and are drawn as selected');
  t.deepEqual(preselected.changes, [], 'without calling onChange');
  const optional = await open(h(ui.MultiSelect, { options }));
  await optional.press(' ', keys.enter);
  t.match(lines(optional)[0], /Red ✔/, 'onSubmit is optional: Enter without one is harmless');
  // Select: the single-value counterpart
  const picked = [];
  const select = await open(h(Select, { options, [defaultValueProp]: 'green', [onChangeProp]: (v) => picked.push(v) }));
  t.match(lines(select)[1], /Green ✔/, 'on Select defaultValue is a single string');
  await select.press(keys.down, keys.down, keys.enter);
  t.deepEqual(picked, ['blue'], 'and onChange receives one string value');
});

s.fence(F, 6, {
  run: async (t, fence) => {
    const { mod } = await runFence(fence);
    const toggled = await captureConsole(async () => {
      const app = await open(h(mod.Example));
      await app.press(' ', keys.down, keys.down, ' ');
    });
    t.deepEqual(toggled, [], 'toggling logs nothing: only onSubmit is wired up');
    const logged = await captureConsole(async () => {
      const app = await open(h(mod.Example));
      await app.press(' ', keys.down, keys.down, ' ', keys.enter);
    });
    t.deepEqual(logged, [[['red', 'blue']]], 'Enter logs the selected values');
  },
});
