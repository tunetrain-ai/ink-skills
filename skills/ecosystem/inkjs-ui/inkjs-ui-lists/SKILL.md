---
name: inkjs-ui-lists
description: "@inkjs/ui UnorderedList and OrderedList components (with .Item subcomponents) for rendering nested bullet/numbered lists with correct terminal indentation. Use when the user wants a bullet list, numbered list, or nested list rendered in the terminal."
metadata:
  ink: "8.0.0"
  category: ecosystem
---

# `@inkjs/ui` lists

Static (non-interactive) list rendering with correct bullet/number glyphs
and nested indentation — for selectable lists, see `inkjs-ui-inputs`'s
`Select`/`MultiSelect` instead.

## `UnorderedList`

```tsx
import React from 'react';
import {UnorderedList} from '@inkjs/ui';
import {Text} from 'ink';

const Example = () => (
	<UnorderedList>
		<UnorderedList.Item>
			<Text>Red</Text>
		</UnorderedList.Item>
		<UnorderedList.Item>
			<Text>Green</Text>
		</UnorderedList.Item>
	</UnorderedList>
);
```

## `OrderedList`

Same shape, numbered instead of bulleted:

```tsx
import React from 'react';
import {OrderedList} from '@inkjs/ui';
import {Text} from 'ink';

const Example = () => (
	<OrderedList>
		<OrderedList.Item>
			<Text>First</Text>
		</OrderedList.Item>
		<OrderedList.Item>
			<Text>Second</Text>
		</OrderedList.Item>
	</OrderedList>
);
```

## Nesting

Both accept another list as an item's child — indentation compounds
automatically:

```tsx
import React from 'react';
import {UnorderedList} from '@inkjs/ui';
import {Text} from 'ink';

const Example = () => (
	<UnorderedList>
		<UnorderedList.Item>
			<Text>Fruits</Text>
			<UnorderedList>
				<UnorderedList.Item>
					<Text>Apple</Text>
				</UnorderedList.Item>
				<UnorderedList.Item>
					<Text>Banana</Text>
				</UnorderedList.Item>
			</UnorderedList>
		</UnorderedList.Item>
	</UnorderedList>
);
```

Note: `@inkjs/ui` does **not** re-export `<Text>` — import it from `ink`
directly, as above. Text in a list item must still be inside
`<Text>` — a bare string throws, as it does anywhere in Ink.

Related skills: ink-text-styling, ink-tables
