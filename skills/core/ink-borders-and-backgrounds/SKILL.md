---
name: ink-borders-and-backgrounds
description: Add borders and background colors to Ink's <Box> — borderStyle presets (single, double, round, bold, classic), custom border glyphs, per-edge borderColor/borderDimColor/borderBackgroundColor, showing/hiding individual edges, and backgroundColor fill and inheritance. Use when the user wants a bordered panel, box background, or custom box-drawing characters.
metadata:
  ink: "8.0.0"
  category: core
---

# Borders and backgrounds

## Border style

`borderStyle` adds a border; unset (the default) means no border. Presets
come from [`cli-boxes`](https://github.com/sindresorhus/cli-boxes):
`single`, `double`, `round`, `bold`, `singleDouble`, `doubleSingle`,
`classic`, `arrow`.

```tsx
import React from 'react';
import {Box, Text} from 'ink';

const Example = () => (
	<Box borderStyle="round" marginRight={2}>
		<Text>round</Text>
	</Box>
);
```

Or supply a custom glyph set for every edge/corner (all eight glyphs are required):

```tsx
import React from 'react';
import {Box, Text} from 'ink';

const Example = () => (
	<Box
		borderStyle={{
			topLeft: '↘',
			top: '↓',
			topRight: '↙',
			left: '→',
			bottomLeft: '↗',
			bottom: '↑',
			bottomRight: '↖',
			right: '←',
		}}
	>
		<Text>Custom</Text>
	</Box>
);
```

## Border color

`borderColor` sets all four edges at once — same value space as `<Text>`'s
`color` (named colors, hex, `rgb(...)`).

```tsx
import React from 'react';
import {Box, Text} from 'ink';

const Example = () => (
	<Box borderStyle="round" borderColor="green">
		<Text>Green Rounded Box</Text>
	</Box>
);
```

Per-edge overrides: `borderTopColor`, `borderRightColor`, `borderBottomColor`,
`borderLeftColor`.

## Dimming and per-edge visibility

`borderDimColor` (boolean, default `false`) dims all edges; per-edge
variants: `borderTopDimColor`, `borderBottomDimColor`, `borderLeftDimColor`,
`borderRightDimColor`.

Each edge can be hidden independently — `borderTop`, `borderRight`,
`borderBottom`, `borderLeft` are booleans, default `true`. Useful for a
divider that only has a bottom rule, or a panel that's visually continuous
with an adjacent one.

## Border background color

`borderBackgroundColor` fills the border glyphs themselves (not the box
interior — that's plain `backgroundColor`, below). Per-edge overrides
(`borderTopBackgroundColor`, `borderBottomBackgroundColor`,
`borderRightBackgroundColor`, `borderLeftBackgroundColor`) fall back to
`borderBackgroundColor` when not set.

```tsx
import React from 'react';
import {Box, Text} from 'ink';

const Example = () => (
	<Box borderStyle="round" borderColor="white" borderBackgroundColor="green">
		<Text>Hello world</Text>
	</Box>
);
```

## Background

`backgroundColor` fills the whole `<Box>`, inside any border, and is
**inherited by child `<Text>` components** unless a child sets its own
`backgroundColor`:

```tsx
import React from 'react';
import {Box, Text} from 'ink';

const Example = () => (
	<Box backgroundColor="blue" alignSelf="flex-start">
		<Text>Blue inherited </Text>
		<Text backgroundColor="yellow">Yellow override </Text>
		<Text>Blue inherited again</Text>
	</Box>
);
```

Backgrounds compose with borders and padding — the fill applies to the
padded interior, inside the border:

```tsx
import React from 'react';
import {Box, Text} from 'ink';

const Example = () => (
	<Box backgroundColor="cyan" borderStyle="round" padding={1} alignSelf="flex-start">
		<Text>Background with border and padding</Text>
	</Box>
);
```

Related skills: ink-layout, ink-text-styling
