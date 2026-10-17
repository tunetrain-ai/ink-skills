---
name: inkjs-ui-inputs
description: "@inkjs/ui input components: TextInput, EmailInput, PasswordInput, ConfirmInput, Select, MultiSelect — props, onChange/onSubmit callbacks, defaultValue, and disabling. Use for prompting the user for text, email, a password, yes/no confirmation, or picking from a list of options."
metadata:
  ink: "8.0.0"
  category: ecosystem
---

# `@inkjs/ui` inputs

`@inkjs/ui` (peer `ink >=5`, which covers Ink 8) is the component library by Ink's
authors (`vadimdemedes/ink-ui`; not an Anthropic project). It renders on Ink 8.
Its inputs are uncontrolled — there is no `value` prop — each managing its own
keyboard handling internally. Prefer these over hand-rolling the same thing
with `useInput` unless a component's behavior is a poor fit.

```sh
npm install @inkjs/ui
```

## `TextInput`

```tsx
import React from 'react';
import {TextInput} from '@inkjs/ui';

const Example = () => (
	<TextInput
		placeholder="Enter your name..."
		onSubmit={(value) => {
			console.log(value);
		}}
	/>
);
```

| Prop | Type | Notes |
| --- | --- | --- |
| `isDisabled` | `boolean` (default `false`) | Ignores input while disabled. |
| `placeholder` | `string` | Shown when empty. |
| `defaultValue` | `string` | Initial value. |
| `suggestions` | `string[]` | Autocomplete candidates; Enter accepts the first one that starts with the typed text. |
| `onChange` | `(value: string) => void` | Fires each time the value changes. |
| `onSubmit` | `(value: string) => void` | Fires on Enter. |

## `EmailInput`

Same props as `TextInput` except `suggestions`, plus `domains?: string[]`
(default: the common providers — aol.com, gmail.com, yahoo.com, hotmail.com,
live.com, outlook.com, icloud.com, hey.com) used to autocomplete after `@`
(Enter accepts the suggestion).

```tsx
import React from 'react';
import {EmailInput} from '@inkjs/ui';

const Example = () => <EmailInput placeholder="Enter email..." onSubmit={console.log} />;
```

## `PasswordInput`

Same as `TextInput` minus `suggestions`/`defaultValue` — masks input as it's
typed, showing each character as `*` (the callbacks still receive the real
text).

```tsx
import React from 'react';
import {PasswordInput} from '@inkjs/ui';

const Example = () => <PasswordInput placeholder="Enter password..." onSubmit={console.log} />;
```

## `ConfirmInput`

A yes/no prompt: Y confirms and N cancels, in either case. `onConfirm`/`onCancel`
are **required**, not optional — pressing the key for a missing handler throws.

```tsx
import React from 'react';
import {ConfirmInput} from '@inkjs/ui';

const Example = () => (
	<ConfirmInput
		defaultChoice="confirm"
		onConfirm={() => console.log('confirmed')}
		onCancel={() => console.log('cancelled')}
	/>
);
```

`defaultChoice` (`'confirm' | 'cancel'`, default `'confirm'`) controls what
pressing Enter does. Set `submitOnEnter={false}` to require an explicit "Y"
keypress instead of letting Enter silently accept the default — worth doing
for a destructive confirmation.

## `Select`

```tsx
import React from 'react';
import {Select} from '@inkjs/ui';

const Example = () => (
	<Select
		options={[
			{label: 'Red', value: 'red'},
			{label: 'Green', value: 'green'},
			{label: 'Blue', value: 'blue'},
		]}
		onChange={(value) => console.log(value)}
	/>
);
```

`options: {label: string; value: string}[]` is required. `visibleOptionCount`
(default `5`) caps how many options render at once — the list scrolls
internally as the user moves past that. `highlightText` highlights the
first occurrence of a substring within option labels — pass a filter/search
input's text to it when combining `Select` with one above it.

## `MultiSelect`

Same shape as `Select` but `defaultValue`/`onChange` are `string[]`, and it
adds `onSubmit?: (value: string[]) => void` for confirming the whole
selection with Enter (vs. `onChange` firing on every Space toggle).

```tsx
import React from 'react';
import {MultiSelect} from '@inkjs/ui';

const Example = () => (
	<MultiSelect
		options={[
			{label: 'Red', value: 'red'},
			{label: 'Green', value: 'green'},
			{label: 'Blue', value: 'blue'},
		]}
		onSubmit={(values) => console.log(values)}
	/>
);
```

Related skills: ink-focus-management, ink-forms, inkjs-ui-theming
