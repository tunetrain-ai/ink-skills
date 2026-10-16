---
name: ink-forms
description: Build multi-field forms and search-driven selection in Ink with ink-form (declarative multi-section forms with string/integer/float/select/boolean fields) and an @inkjs/ui TextInput + Select filterable picker. Use when the user wants a form with several fields, or a searchable/filterable list picker.
metadata:
  ink: "8.0.0"
  category: ecosystem
---

# Forms

For a *single* field, prefer `@inkjs/ui` (`inkjs-ui-inputs`) — `TextInput`,
`Select`, `ConfirmInput`, etc. Reach for the packages below when you need
several fields presented and navigated as one form, or search-filtered
selection.

## `ink-form` — declarative multi-section forms

Describes the whole form as data (sections → fields), and either renders it
as a component or drives it imperatively:

```tsx
import React from 'react';
import {render} from 'ink';
import {Form, type FormProps} from 'ink-form';

const options = [
	{label: 'Opt 1', value: 'a'},
	{label: 'Opt 2', value: 'b'},
];

const form: FormProps = {
	form: {
		title: 'Form title',
		sections: [
			{
				title: 'Text and number fields',
				fields: [
					{type: 'string', name: 'field1', label: 'Name', initialValue: 'Initial value'},
					{type: 'integer', name: 'field2', label: 'Count', min: 0, max: 10, step: 1},
				],
			},
			{
				title: 'Select fields',
				fields: [{type: 'select', name: 'field3', label: 'Choice', options}],
			},
		],
	},
};

render(
	<Form
		{...form}
		onSubmit={(result) => {
			console.log('Finished with value', result);
		}}
	/>,
);
```

Field `type`s are exactly `string` (with an optional `mask` for a
password-style field), `integer` / `float` (with `min` / `max` / `step`),
`select`, and `boolean` — there is **no** `multiselect` (use `@inkjs/ui`'s
`MultiSelect`, `inkjs-ui-inputs`, or add your own field type through
`customManagers`). There's also an
imperative `openForm(options)` that renders the form itself and returns a
promise of the submitted value — useful for a one-off prompt in an
otherwise-imperative script.

## Filterable select — `TextInput` + `Select` from `@inkjs/ui`

`ink-quicksearch-input` cannot be used on Ink 8 (it peers `ink 2.6.x`, uses
the removed `<Color>` component, and its CommonJS build fails to load). A
filterable picker needs nothing beyond `@inkjs/ui`:

```tsx
import React, {useState} from 'react';
import {Box, Text} from 'ink';
import {Select, TextInput} from '@inkjs/ui';

const animals = ['Animal', 'Animation', 'Antelope', 'Banana', 'Bandit'].map((label) => ({
	label,
	value: label.toLowerCase(),
}));

const SearchSelect = ({onSelect}: {onSelect: (value: string) => void}) => {
	const [query, setQuery] = useState('');
	const [stage, setStage] = useState<'filter' | 'pick'>('filter');
	const options = animals.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));

	return (
		<Box flexDirection="column">
			<TextInput
				placeholder="Type to filter…"
				isDisabled={stage !== 'filter'}
				onChange={setQuery}
				onSubmit={() => setStage('pick')}
			/>
			{options.length > 0 ? (
				<Select
					options={options}
					highlightText={query}
					isDisabled={stage !== 'pick'}
					onChange={onSelect}
				/>
			) : (
				<Text dimColor>No matches</Text>
			)}
		</Box>
	);
};
```

Both inputs listen for keys at the same time, so only one is enabled at a
time: typing filters the list live, Enter in the `TextInput` hands control to
the `Select`, and Enter in the `Select` reports the highlighted option
through `onChange`. (`Select` has no `onSubmit` — `onChange` is its
selection callback.) See `ink-focus-management` if you need Tab to move
between them instead.

## `ink-confirm-input` — don't use it on Ink 8

`ink-confirm-input` is another CommonJS build that fails to load on Ink 8. Use
`@inkjs/ui`'s `ConfirmInput` (see `inkjs-ui-inputs`).

Related skills: inkjs-ui-inputs, ink-focus-management, ink-ecosystem-overview
