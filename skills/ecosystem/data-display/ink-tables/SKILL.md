---
name: ink-tables
description: Render tabular data in an Ink terminal UI — using the ink-table package (data/columns/padding/header/cell/skeleton props) or a hand-rolled <Box>/<Text> grid when you need full control. Use when the user wants to display rows of data in columns.
metadata:
  ink: "7.1.1"
  category: ecosystem
---

# Tables

## `ink-table`

```tsx no-check
import React from 'react';
import {render} from 'ink';
import Table from 'ink-table';

const data = [
	{name: 'Sosa Saunders', age: 17, email: 'sosa.saunders@mail.com'},
	{name: 'Angelina Kirk', age: 3, email: 'angelina@kirk.io'},
];

render(<Table data={data} />);
```

| Prop | Type | Notes |
| --- | --- | --- |
| `data` | `T[]` | Rows — array of objects. **Required.** |
| `columns` | `(keyof T)[]` | Which keys to show as columns, in order. Defaults to all keys of the first row if omitted. |
| `padding` | `number` | Cell padding. |
| `header` | `(props) => JSX.Element` | Custom header-row renderer. |
| `cell` | `(props) => JSX.Element` | Custom cell renderer. |
| `skeleton` | `(props) => JSX.Element` | Custom border/divider renderer. |

Peer range predates Ink 7 (see `ink-ecosystem-overview`) — its layout is
built on plain `<Box>`/`<Text>` primitives that haven't changed, so in
practice it keeps working, but there's no current alternative package to
recommend instead; verify it against your installed Ink version before
depending on it in new code.

## Hand-rolled table

When `ink-table`'s column/cell model doesn't fit (mixed cell content,
per-cell coloring you don't want to route through a custom `cell` renderer,
or avoiding a dependency for a small, fixed table), a table is just a
`<Box flexDirection="column">` of row `<Box>`s with fixed-width cells:

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
