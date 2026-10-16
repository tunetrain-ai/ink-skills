---
name: ink-tables
description: Render tabular data in an Ink terminal UI — using @alcalzone/ink-table (data/columns/padding/header/cell/skeleton props, per-column alignment) or a hand-rolled <Box>/<Text> grid when you need full control. Use when the user wants to display rows of data in columns.
metadata:
  ink: "8.0.0"
  category: ecosystem
---

# Tables

## `@alcalzone/ink-table`

The original `ink-table` is a CommonJS package that `require()`s Ink, so it
throws `ERR_REQUIRE_ASYNC_MODULE` on Ink 8 and cannot be used (see
`ink-ecosystem-overview`). `@alcalzone/ink-table` is an ESM fork with the same
props and a **named** `Table` export. Its last release is old (2023) but it
renders on Ink 8 and installs with strict peer dependencies.

```sh
npm install @alcalzone/ink-table
```

```tsx
import React from 'react';
import {render} from 'ink';
import {Table} from '@alcalzone/ink-table';

const data = [
	{name: 'Sosa Saunders', age: 17, email: 'sosa.saunders@mail.com'},
	{name: 'Angelina Kirk', age: 3, email: 'angelina@kirk.io'},
];

render(<Table data={data} columns={['name', {key: 'age', align: 'right'}]} />);
```

| Prop | Type | Notes |
| --- | --- | --- |
| `data` | `T[]` | Rows — array of plain objects whose values are `string \| number \| boolean \| null \| undefined`. **Required.** |
| `columns` | `(keyof T \| {key: keyof T; align?: 'left' \| 'right' \| 'center'})[]` | Which keys to show, in order. Defaults to the union of the keys of **all** rows. |
| `padding` | `number` | Cell padding. |
| `header` | `(props) => JSX.Element` | Custom header-row renderer. |
| `cell` | `(props: {column: number; children}) => JSX.Element` | Custom cell renderer. |
| `skeleton` | `(props) => JSX.Element` | Custom border/divider renderer. |

`Table` is a class component and `T` must be an object type with scalar
values: declare row types with `type Row = {…}` (an `interface` has no index
signature and is rejected) or let TypeScript infer them from the array, as
above. Nested objects and arrays are not supported as cell values — format
them to strings first.

## Hand-rolled table

When the column/cell model doesn't fit (mixed cell content, per-cell coloring
you don't want to route through a custom `cell` renderer, or avoiding a
dependency for a small, fixed table), a table is just a
`<Box flexDirection="column">` of row `<Box>`es with fixed-width cells:

```tsx
import React from 'react';
import {Box, Text} from 'ink';

type Row = {name: string; age: number};

const SimpleTable = ({rows}: {rows: Row[]}) => (
	<Box flexDirection="column">
		<Box>
			<Box width={20}>
				<Text bold>Name</Text>
			</Box>
			<Box width={5}>
				<Text bold>Age</Text>
			</Box>
		</Box>
		{rows.map((row) => (
			<Box key={row.name}>
				<Box width={20}>
					<Text>{row.name}</Text>
				</Box>
				<Box width={5}>
					<Text>{row.age}</Text>
				</Box>
			</Box>
		))}
	</Box>
);
```

Fixed `width` on each column `<Box>` is what keeps columns aligned — text
that overflows a column wraps by default (see `ink-text-styling`'s `wrap`
prop to truncate instead). For column widths that should adapt to content
(e.g. the widest cell in each column), compute the max string length per
column before rendering — there's no automatic "auto" column sizing in
plain `<Box>` layout.

Related skills: ink-layout, ink-text-styling, ink-ecosystem-overview
