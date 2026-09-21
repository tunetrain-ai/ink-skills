---
name: ink-forms
description: Build multi-field forms and search-driven selection in Ink with ink-form (declarative multi-section forms with text/number/select/boolean fields) and ink-quicksearch-input (filterable select). Use when the user wants a form with several fields, or a searchable/filterable list picker.
metadata:
  ink: "7.1.1"
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

```tsx no-check
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

Field `type`s: `string` (with optional `mask` for a password-style field),
`integer`/`float` (with `min`/`max`/`step`), `select`, `multiselect`,
`boolean`. There's also an imperative `openForm(options)` that returns a
promise instead of rendering a controlled component — useful for a one-off
prompt in an otherwise-imperative script.

## `ink-quicksearch-input` — filterable select

```tsx no-check
import React, {useState} from 'react';
import {Text} from 'ink';
import {QuickSearchInput} from 'ink-quicksearch-input';

const Demo = () => {
	const [result, setResult] = useState('');
	return (
		<>
			<Text>The user selected {result}.</Text>
			<QuickSearchInput
				items={[
					{value: 1, label: 'Animal'},
					{value: 2, label: 'Animation'},
					{value: 3, label: 'Antilope'},
				]}
				onSelect={(item) => setResult(item.label)}
			/>
		</>
	);
};
```

Typing filters the `items` list live — items not matching the query are
removed from the list entirely (not just visually dimmed), which is the one
behavioral difference from the older `ink-quicksearch` it was forked from.
`@inkjs/ui`'s `Select`/`MultiSelect` (`inkjs-ui-inputs`) support a
`highlightText` prop for a similar filtered-list feel if you're already
depending on `@inkjs/ui` and don't want another package just for this.

## A legacy confirm-input package exists too

`ink-confirm-input` (a much older, pre-`@inkjs/ui` package) does the same
job as `@inkjs/ui`'s `ConfirmInput` — **prefer `@inkjs/ui`'s** (see
`inkjs-ui-inputs`) for new code; it's actively maintained and its peer range
is current for Ink 7, unlike this one.

Related skills: inkjs-ui-inputs, ink-focus-management, ink-ecosystem-overview
