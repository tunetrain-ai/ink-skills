// Claims for skills/ecosystem/interaction/ink-forms/SKILL.md.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import semver from 'semver';
import { skill, tsx, ink, h, mount, keys, waitFor, runFence, importedPackages, runExternal, extPkg, extPackageDir, extReadFile, packageDir } from '../lib/index.mjs';

const s = skill('ink-forms');
const F = 'SKILL.md';
const { Text, Box } = ink;

/** ink-form's own list of built-in field managers (not exported from the package: read from its file). */
const builtInManagers = async () => (await import(pathToFileURL(join(packageDir('ink-form'), 'lib', 'managers', 'managers.js')).href)).managers;

/** A form with one section and one field, focused and opened for editing (Down, then Enter). */
async function openEditor(field, props = {}) {
  const { Form } = await import('ink-form');
  const form = { title: 'T', sections: [{ title: 'S', fields: [field] }] };
  const submitted = [];
  const app = mount(h(Form, { form, onSubmit: (value) => submitted.push(value), ...props }), { columns: 80, rows: 30 });
  await app.flush();
  await app.press(keys.down);
  await app.press(keys.enter);
  return { app, submitted };
}

/** Load a package in a clean Node process the way a user's project would (Ink 8 is ESM with top-level await). */
async function load(name) {
  const run = await runExternal({ code: `try { await import('${name}'); console.log(JSON.stringify({loaded: true})); } catch (e) { console.log(JSON.stringify({loaded: false, code: e.code})); }` });
  return run.json;
}

// ===================================================================== description

const DESCRIPTION = 'Build multi-field forms and search-driven selection in Ink with ink-form (declarative multi-section forms with string/integer/float/select/boolean fields) and an @inkjs/ui TextInput + Select filterable picker.';
s.fact(
  F,
  [DESCRIPTION],
  { kind: 'D', timeout: 30_000 },
  async (t) => {
    const { Form } = await import('ink-form');
    // the field types named in the sentence are the ones ink-form ships
    const named = DESCRIPTION.match(/with ([a-z/]+) fields/)[1].split('/');
    t.deepEqual((await builtInManagers()).map((manager) => manager.type).sort(), [...named].sort(), 'string/integer/float/select/boolean are ink-form\'s field types');
    // multi-section: one tab per section, each with its own fields
    const form = {
      title: 'T',
      sections: [
        { title: 'One', fields: [{ type: 'string', name: 'a', label: 'Alpha' }] },
        { title: 'Two', fields: [{ type: 'string', name: 'b', label: 'Beta' }] },
      ],
    };
    const app = mount(h(Form, { form }), { columns: 80, rows: 30 });
    await app.flush();
    t.match(app.screen(), /\[1\] One \[2\] Two/, 'a form has several sections');
    t.match(app.screen(), /Alpha/);
    t.doesNotMatch(app.screen(), /Beta/, 'of which one shows its fields at a time');
    await app.press(keys.right);
    t.match(app.screen(), /Beta/, 'the next section shows its own');
    // a filterable picker from @inkjs/ui's TextInput and Select
    const { mod } = await s.runFence(F, 1);
    const picker = mount(h(mod.SearchSelect, { onSelect: () => {} }), { columns: 60, rows: 20 });
    await picker.flush();
    await picker.press('b', 'a', 'n');
    t.deepEqual(picker.screen().split('\n').slice(1).map((line) => line.trim()), ['Banana', 'Bandit'], 'a TextInput filters the options of a Select');
  },
);

s.guidance(F, ['Use when the user wants a form with several fields, or a searchable/filterable list picker.'], 'a trigger for loading the skill; it asserts nothing about behaviour');

// ===================================================================== single field

s.fact(F, ['For a *single* field, prefer `@inkjs/ui` (`inkjs-ui-inputs`) — `TextInput`, `Select`, `ConfirmInput`, etc.'], { kind: 'R', ctx: ['inkjs-ui-inputs'] }, async (t, q) => {
  const ui = await import(q.tok('@inkjs/ui'));
  const TextInput = q.api(ui, 'TextInput');
  const Select = q.api(ui, 'Select');
  const ConfirmInput = q.api(ui, 'ConfirmInput');
  const shown = async (element) => {
    const app = mount(element, { columns: 40 });
    await app.flush();
    return app.screen();
  };
  t.equal(await shown(h(TextInput, { placeholder: 'Name' })), 'Name', 'TextInput is one text field');
  t.deepEqual((await shown(h(Select, { options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }] }))).split('\n').map((line) => line.trim()), ['❯ A', 'B'], 'Select is one choice');
  t.match(await shown(h(ConfirmInput, { onConfirm() {}, onCancel() {} })), /Y\/n/, 'ConfirmInput is one yes/no question');
});

s.guidance(
  F,
  ['Reach for the packages below when you need several fields presented and navigated as one form, or search-filtered selection.'],
  'a recommendation about when to reach for the packages below; the behaviour it points to is proven where each is taught',
);

// ===================================================================== ink-form

s.fact(F, ['Describes the whole form as data (sections → fields), and either renders it as a component or drives it imperatively:'], { kind: 'R' }, async (t) => {
  const inkForm = await import('ink-form');
  t.equal(typeof inkForm.Form, 'function', 'there is a component');
  t.equal(typeof inkForm.openForm, 'function', 'and an imperative function');
  // the data is plain objects: sections hold fields, and what shows is what the data says
  const structure = { title: 'Data', sections: [{ title: 'Only', fields: [{ type: 'string', name: 'x', label: 'Label from data' }] }] };
  const app = mount(h(inkForm.Form, { form: structure }), { columns: 80, rows: 30 });
  await app.flush();
  t.match(app.screen(), /Data/);
  t.match(app.screen(), /\[1\] Only/, 'a section is a tab');
  t.match(app.screen(), /Label from data/, 'a field is a row');
});

s.types(
  F,
  ['Describes the whole form as data (sections → fields), and either renders it as a component or drives it imperatively:'],
  tsx`
import type {FormProps, FormStructure, FormSection, FormField} from 'ink-form';

type Sections = FormStructure['sections'];
type Fields = FormSection['fields'];
export const sectionsAreSections: Sections extends FormSection[] ? true : false = true;
export const fieldsAreFields: Fields extends FormField[] ? true : false = true;
export const props: FormProps = {form: {sections: [{title: 'S', fields: [{type: 'string', name: 'a'}]}]}};
export const noSections: FormProps = {form: {title: 'T'}}; //! TS2741
export const fieldsNotInSection: FormProps = {form: {sections: [{title: 'S'}]}}; //! TS2741
`,
);

s.fence(F, 0, {
  run: async (t, fence) => {
    const logged = [];
    const log = console.log;
    console.log = (...args) => logged.push(args);
    try {
      const { apps } = await runFence(fence, { mountOptions: { columns: 80, rows: 30 } });
      const app = apps[0];
      await app.flush();
      t.match(app.screen(), /Form title/);
      t.match(app.screen(), /\[1\] Text and number fields \[2\] Select fields/, 'the form shows its sections');
      t.match(app.screen(), /Name: Initial value/, 'the first section shows its fields, the initial value in place');
      // Down, Down: the Count field; Enter opens it; Up, Up: 0, then one step; Enter keeps it
      await app.press(keys.down, keys.down, keys.enter);
      await app.press(keys.up, keys.up);
      await app.press(keys.enter);
      t.match(app.screen(), /Count: 1/, 'a number field steps with the arrow keys');
      await app.press(keys.right);
      t.match(app.screen(), /Choice:/, 'the second section has the select field');
      await app.press(keys.left, keys.down);
      await app.press(keys.enter);
      t.deepEqual(logged, [['Finished with value', { field1: 'Initial value', field2: 1 }]], 'onSubmit receives the value of every field, by name');
    } finally {
      console.log = log;
    }
  },
});

s.fact(
  F,
  ["Field `type`s are exactly `string` (with an optional `mask` for a password-style field), `integer` / `float` (with `min` / `max` / `step`), `select`, and `boolean` — there is **no** `multiselect` (use `@inkjs/ui`'s `MultiSelect`, `inkjs-ui-inputs`, or add your own field type through `customManagers`)."],
  { kind: 'D', ctx: ['no', 'inkjs-ui-inputs'], timeout: 30_000 },
  async (t, q) => {
    const type = q.tok('type');
    const [string, integer, float, select, boolean] = ['string', 'integer', 'float', 'select', 'boolean'].map((name) => q.tok(name));
    const [mask, min, max, step] = ['mask', 'min', 'max', 'step'].map((name) => q.tok(name));
    const multiselect = q.tok('multiselect');
    const customManagers = q.tok('customManagers');
    const { Form } = await import('ink-form');

    // exactly these: the registry the component looks types up in
    t.deepEqual((await builtInManagers()).map((manager) => manager.type).sort(), [string, integer, float, select, boolean].sort(), 'ink-form has a manager for each of these types and for no other');

    // each of them opens its own editor ...
    const editors = {
      [string]: { field: { [type]: string, name: 'f', label: 'Field' }, keys: ['h', 'i'], shows: /│hi\s+│/ },
      [integer]: { field: { [type]: integer, name: 'f', label: 'Field' }, keys: [], shows: /Press UP\/DOWN to increase or decrease the value\./ },
      [float]: { field: { [type]: float, name: 'f', label: 'Field' }, keys: [], shows: /Press UP\/DOWN to increase or decrease the value\./ },
      [select]: { field: { [type]: select, name: 'f', label: 'Field', options: [{ label: 'First option', value: 'a' }] }, keys: [], shows: /First option/ },
      [boolean]: { field: { [type]: boolean, name: 'f', label: 'Field' }, keys: [' '], shows: /\[True\]/ },
    };
    for (const [name, { field, keys: typed, shows }] of Object.entries(editors)) {
      const { app } = await openEditor(field);
      await app.press(...typed);
      t.match(app.screen(), shows, `${name} has its editor`);
      t.doesNotMatch(app.screen(), /No formfield manager/, `and ${name} is a known type`);
    }

    // ... and a type outside the list has none
    t.equal(multiselect, q.tok('MultiSelect').toLowerCase(), 'multiselect is the type a multiple choice would have');
    const unknown = await openEditor({ [type]: multiselect, name: 'f', label: 'Field' });
    t.match(unknown.app.screen(), new RegExp(`No formfield manager for form field of type ${multiselect} available\\.`), 'there is no multiselect');

    // an own type goes in through customManagers
    const manager = { [type]: multiselect, renderField: () => h(Text, null, 'my own editor'), renderValue: () => h(Text, null, 'my own value') };
    const custom = await openEditor({ [type]: multiselect, name: 'f', label: 'Field' }, { [customManagers]: [manager] });
    t.match(custom.app.screen(), /my own editor/, 'a manager passed as customManagers supplies the editor');
    t.doesNotMatch(custom.app.screen(), /No formfield manager/);

    // @inkjs/ui has the multiple choice
    const ui = await import(q.tok('@inkjs/ui'));
    const MultiSelect = q.api(ui, 'MultiSelect');
    const chosen = [];
    const chooser = mount(h(MultiSelect, { options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }], onChange: (values) => chosen.push(values) }), { columns: 40 });
    await chooser.flush();
    await chooser.press(keys.space, keys.down, keys.space);
    t.deepEqual(chooser.screen().split('\n').map((line) => line.trim()), ['A ✔', '❯ B ✔'], 'MultiSelect ticks several options');
    t.deepEqual(chosen.at(-1), ['a', 'b'], 'and reports them all');

    // string with a mask: a password-style field
    const password = await openEditor({ [type]: string, name: 'pw', label: 'Password', [mask]: '*' });
    await password.app.press('s', 'e', 'c', 'r', 'e', 't');
    t.match(password.app.screen(), /\*{6}/, 'the editor shows one * per character');
    t.doesNotMatch(password.app.screen(), /secret/);
    await password.app.press(keys.enter);
    t.match(password.app.screen(), /Password: \*{6}/, 'and so does the field once it is closed');
    t.doesNotMatch(password.app.screen(), /secret/);
    const plain = await openEditor({ [type]: string, name: 'pw', label: 'Password' });
    await plain.app.press('s', 'e', 'c', 'r', 'e', 't');
    t.match(plain.app.screen(), /secret/, 'without a mask the text shows');

    // integer and float: min, max and the step of the arrow keys
    for (const [kind, limits] of [[integer, { [min]: 0, [max]: 10, [step]: 5 }], [float, { [min]: 0, [max]: 1, [step]: 0.5 }]]) {
      const top = limits[max];
      const increment = limits[step];
      const { app, submitted } = await openEditor({ [type]: kind, name: 'n', label: 'Number', ...limits });
      const shown = () => app.screen().split('\n').find((line) => line.includes('│') && !line.includes('Press'))?.replace(/[│\s]/g, '');
      await app.press(keys.up);
      t.equal(shown(), '0', `${kind}: the arrow key starts from 0, which is within the limits`);
      await app.press(keys.up);
      t.equal(shown(), String(increment), `${kind}: and moves by the step`);
      await app.press(keys.up);
      t.equal(shown(), String(top), `${kind}: up to the maximum`);
      await app.press(keys.up);
      t.match(app.screen(), new RegExp(`too big, must be below or equal to ${top}\\.`), `${kind}: a step past the maximum is an error`);
      await app.press(keys.down, keys.down); // the first one leaves the error behind at 0, the second goes below it
      t.match(app.screen(), /too small, must be above or equal to 0\./, `${kind}: and so is one below the minimum`);
      t.deepEqual(submitted, [], `${kind}: nothing is submitted by editing`);
    }
  },
);

s.types(
  F,
  ['`string` (with an optional `mask` for a password-style field), `integer` / `float` (with `min` / `max` / `step`)'],
  tsx`
import type {FormFieldString, FormFieldInteger, FormFieldFloat} from 'ink-form';

export const string: FormFieldString = {type: 'string', name: 'a', mask: '*'};
export const integer: FormFieldInteger = {type: 'integer', name: 'b', min: 0, max: 10, step: 1};
export const float: FormFieldFloat = {type: 'float', name: 'c', min: 0, max: 1, step: 0.1};
export const maskOnInteger: FormFieldInteger = {type: 'integer', name: 'd', mask: '*'}; //! TS2353
export const minOnString: FormFieldString = {type: 'string', name: 'e', min: 1}; //! TS2353
export const stepOnString: FormFieldString = {type: 'string', name: 'f', step: 1}; //! TS2353
`,
);

s.fact(F, ["There's also an imperative `openForm(options)` that renders the form itself and returns a promise of the submitted value — useful for a one-off prompt in an otherwise-imperative script."], { kind: 'R', timeout: 30_000 }, async (t, q) => {
  const inkForm = await import('ink-form');
  const openForm = q.api(inkForm, 'openForm(options)');
  t.equal(typeof openForm, 'function');
  const { runIsolated } = await import('../lib/index.mjs');
  const down = keys.down;
  const run = await runIsolated({ probe: 'ink-forms-open-form', tty: { isTTY: true, columns: 80, rows: 30 }, stdin: [[400, down], [700, down], [1000, keys.enter]], timeout: 20_000 });
  t.equal(run.code, 0);
  t.equal(run.json.isPromise, true, 'the call returns a promise at once');
  t.match(run.stdout, /Prompt/, 'the form was drawn by openForm itself');
  t.deepEqual(run.json.value, { answer: 'yes' }, 'which resolves with the submitted value, by field name');
});

// ===================================================================== filterable select

s.fact(
  F,
  ['`ink-quicksearch-input` cannot be used on Ink 8 (it peers `ink 2.6.x`, uses the removed `<Color>` component, and its CommonJS build fails to load).'],
  { kind: 'P', timeout: 30_000 },
  async (t, q) => {
    const name = q.tok('ink-quicksearch-input');
    const [peerName, range] = q.tok('ink 2.6.x').split(' ');
    const removed = q.tok('<Color>').replace(/[<>]/g, '');
    const meta = extPkg(name);
    t.equal(meta.peerDependencies[peerName], range, 'it peers that Ink');
    t.equal(semver.major(extPkg('ink').version), Number(q.tok('8')), 'the Ink in use');
    t.ok(!semver.satisfies(extPkg('ink').version, range), 'which is outside that range');
    t.match(extReadFile(name, meta.main), new RegExp(`ink_1\\.${removed}\\b`), `it renders ${removed} from Ink`);
    t.equal(removed in (await import('ink')), false, `which Ink 8 does not export`);
    t.notEqual(meta.type, 'module', 'its build is CommonJS');
    const result = await load(name);
    t.equal(result.loaded, false, 'and it cannot be loaded');
    if (semver.gte(process.versions.node, '22.12.0')) t.equal(result.code, 'ERR_REQUIRE_ASYNC_MODULE', 'because it require()s an ESM Ink with top-level await');
  },
);

s.fact(F, ['A filterable picker needs nothing beyond `@inkjs/ui`:'], { kind: 'R' }, async (t, q) => {
  const fence = s.fenceOf(F, 1);
  const packages = [...importedPackages(fence.code)].sort();
  t.deepEqual(packages, ['@inkjs/ui', 'ink', 'react'], 'the picker imports Ink, React and @inkjs/ui, and nothing else');
  t.ok(packages.includes(q.tok('@inkjs/ui')));
  const { mod } = await s.runFence(F, 1);
  t.equal(typeof mod.SearchSelect, 'function', 'and it is a component of its own');
});

s.fence(F, 1, {
  run: async (t, fence) => {
    const { mod } = await runFence(fence);
    const picked = [];
    const app = mount(h(mod.SearchSelect, { onSelect: (value) => picked.push(value) }), { columns: 60, rows: 20 });
    await app.flush();
    const options = () => app.screen().split('\n').slice(1).map((line) => line.replace('❯', '').trim());
    t.equal(app.screen().split('\n')[0], 'Type to filter…');
    t.deepEqual(options(), ['Animal', 'Animation', 'Antelope', 'Banana', 'Bandit'], 'all options before typing');
    await app.press('a', 'n', 'i');
    t.deepEqual(options(), ['Animal', 'Animation'], 'typing narrows them');
    await app.press('m', 'a', 't');
    t.deepEqual(options(), ['Animation'], 'down to the match');
    await app.press('z');
    t.equal(app.screen().split('\n')[1], 'No matches', 'and to none');
    t.deepEqual(picked, []);
  },
});

s.fact(
  F,
  ['Both inputs listen for keys at the same time, so only one is enabled at a time: typing filters the list live, Enter in the `TextInput` hands control to the `Select`, and Enter in the `Select` reports the highlighted option through `onChange`.'],
  { kind: 'R', timeout: 20_000 },
  async (t, q) => {
    const ui = await import('@inkjs/ui');
    const TextInput = q.api(ui, 'TextInput');
    const Select = q.api(ui, 'Select');
    const change = q.tok('onChange');
    // both enabled: one Enter reaches both
    const calls = [];
    const Both = () => h(Box, { flexDirection: 'column' }, h(TextInput, { onSubmit: () => calls.push('TextInput submit') }), h(Select, { options: [{ label: 'A', value: 'a' }], [change]: () => calls.push('Select change') }));
    const both = mount(h(Both), { columns: 40 });
    await both.flush();
    await both.press(keys.enter);
    t.deepEqual(calls.sort(), ['Select change', 'TextInput submit'], 'with both enabled, Enter is handled by both');
    // the picker enables one at a time
    const { mod } = await s.runFence(F, 1);
    const picked = [];
    const app = mount(h(mod.SearchSelect, { onSelect: (value) => picked.push(value) }), { columns: 60, rows: 20 });
    await app.flush();
    const screen = () => app.screen().split('\n');
    const pointer = () => screen().findIndex((line) => line.startsWith('❯'));
    await app.press('a', 'n', 'i');
    t.deepEqual(screen().slice(1), ['  Animal', '  Animation'], 'typing filters the list live');
    await app.press(keys.down);
    t.equal(pointer(), -1, 'while the TextInput is enabled the Select ignores the arrow keys');
    await app.press(keys.enter);
    t.equal(pointer(), 1, 'Enter in the TextInput hands control to the Select');
    await app.press('x');
    t.equal(screen()[0], 'ani', 'which is now the only one that reacts: the TextInput ignores typing');
    await app.press(keys.down);
    t.equal(pointer(), 2, 'the Select moves its highlight');
    t.deepEqual(picked, [], 'without reporting anything yet');
    await app.press(keys.enter);
    t.deepEqual(picked, ['animation'], 'Enter in the Select reports the highlighted option through onChange');
  },
);

s.fact(F, ['(`Select` has no `onSubmit` — `onChange` is its selection callback.)'], { kind: 'R' }, async (t, q) => {
  const ui = await import('@inkjs/ui');
  const Select = q.api(ui, 'Select');
  const submit = q.tok('onSubmit');
  const change = q.tok('onChange');
  const { TextInput } = ui;
  // control: onSubmit is a real callback name, of TextInput
  const typed = [];
  const field = mount(h(TextInput, { defaultValue: 'x', [submit]: (value) => typed.push(value) }), { columns: 40 });
  await field.flush();
  await field.press(keys.enter);
  t.deepEqual(typed, ['x'], 'TextInput calls onSubmit on Enter');
  const calls = [];
  const options = [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }];
  const app = mount(h(Select, { options, [submit]: (value) => calls.push(['submit', value]), [change]: (value) => calls.push(['change', value]) }), { columns: 40 });
  await app.flush();
  await app.press(keys.down);
  t.deepEqual(calls, [], 'moving the highlight calls nothing');
  await app.press(keys.enter);
  t.deepEqual(calls, [['change', 'b']], 'Enter selects: onChange gets the value, and an onSubmit prop is never called');
});

s.types(
  F,
  ['(`Select` has no `onSubmit` — `onChange` is its selection callback.)'],
  tsx`
import React from 'react';
import {Select} from '@inkjs/ui';

const options = [{label: 'A', value: 'a'}];
export const ok = <Select options={options} onChange={(value: string) => value} />;
export const noSubmit = <Select options={options} onSubmit={() => {}} />; //! TS2322
`,
);

s.guidance(F, ['See `ink-focus-management` if you need Tab to move between them instead.'], 'a pointer to the skill that covers focus management; it asserts nothing about behaviour');

// ===================================================================== ink-confirm-input

s.fact(
  F,
  ["`ink-confirm-input` — don't use it on Ink 8", '`ink-confirm-input` is another CommonJS build that fails to load on Ink 8.', "Use `@inkjs/ui`'s `ConfirmInput` (see `inkjs-ui-inputs`)."],
  { kind: 'P', ctx: ['inkjs-ui-inputs'], timeout: 30_000 },
  async (t, q) => {
    const name = q.tok('ink-confirm-input');
    t.equal(semver.major(extPkg('ink').version), Number(q.tok('8')), 'the Ink in use');
    const meta = extPkg(name);
    t.notEqual(meta.type, 'module', 'not an ES module');
    const source = readFileSync(join(extPackageDir(name), meta.main), 'utf8');
    t.match(source, /exports\.default = /, 'a CommonJS build');
    t.match(source, /require\("ink-text-input"\)/, 'which reaches Ink through the CommonJS ink-text-input it requires');
    t.notEqual(extPkg('ink-text-input', { from: name }).type, 'module');
    const result = await load(name);
    t.equal(result.loaded, false, 'and it cannot be loaded');
    if (semver.gte(process.versions.node, '22.12.0')) t.equal(result.code, 'ERR_REQUIRE_ASYNC_MODULE', 'because Ink is an ES module with top-level await');
    const ui = await import(q.tok('@inkjs/ui'));
    const ConfirmInput = q.api(ui, 'ConfirmInput');
    const answers = [];
    const app = mount(h(ConfirmInput, { onConfirm: () => answers.push('confirm'), onCancel: () => answers.push('cancel') }), { columns: 40 });
    await app.flush();
    await app.press('n');
    await app.press('y');
    t.deepEqual(answers, ['cancel', 'confirm'], 'the replacement answers yes and no');
  },
);
