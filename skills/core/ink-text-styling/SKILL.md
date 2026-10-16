---
name: ink-text-styling
description: Style and control text output in Ink — <Text> color/backgroundColor/bold/italic/underline/strikethrough/inverse/dimColor/wrap, <Newline>, <Spacer>, and <Transform> for post-processing rendered output (uppercase, hanging indent, gradients). Use for anything about how text looks or wraps.
metadata:
  ink: "8.0.0"
  category: core
---

# Text styling: `<Text>`, `<Newline>`, `<Spacer>`, `<Transform>`

## `<Text>`

The only component that renders characters. `<Text>` allows only text nodes
and nested `<Text>` components as children — `<Box>` cannot be nested inside
`<Text>`.

```tsx
import React from 'react';
import {render, Text} from 'ink';

const Example = () => (
	<>
		<Text color="green">I am green</Text>
		<Text color="black" backgroundColor="white">
			I am black on white
		</Text>
		<Text bold>I am bold</Text>
		<Text italic>I am italic</Text>
		<Text underline>I am underline</Text>
		<Text strikethrough>I am strikethrough</Text>
		<Text inverse>I am inversed</Text>
	</>
);

render(<Example />);
```

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `color` | `string` | — | Powered by [chalk](https://github.com/chalk/chalk) — named colors, hex (`"#005cc5"`), `rgb(...)`. |
| `backgroundColor` | `string` | — | Same value space as `color`. |
| `dimColor` | `boolean` | `false` | Makes the color less bright. |
| `bold` / `italic` / `underline` / `strikethrough` | `boolean` | `false` | |
| `inverse` | `boolean` | `false` | Swaps foreground/background. |
| `wrap` | `'wrap' \| 'hard' \| 'truncate' \| 'truncate-start' \| 'truncate-middle' \| 'truncate-end'` | `'wrap'` | See below. `truncate` is an alias for `truncate-end`. |

### Wrap modes

```tsx
import React from 'react';
import {Box, Text} from 'ink';

const Example = () => (
	<Box width={7}>
		<Text wrap="truncate-middle">Hello World</Text>
	</Box>
);
// => 'He…ld'
```

- `wrap` (default): breaks onto multiple lines at word boundaries.
- `hard`: fills every line to the full column width, breaking words if needed.
- `truncate*`: renders one line, cutting the rest with `…` at the end, start,
  or middle.

## `<Newline count?>`

Inserts one or more `\n` characters. Must be used inside `<Text>` — a raw
`\n` in a string works too, but `<Newline>` reads clearly when interleaving
differently-styled `<Text>` runs:

```tsx
import React from 'react';
import {render, Text, Newline} from 'ink';

const Example = () => (
	<Text>
		<Text color="green">Hello</Text>
		<Newline />
		<Text color="red">World</Text>
	</Text>
);

render(<Example />);
```

## `<Spacer>`

A flexible space that expands along the major axis of its containing
`<Box>`, filling all available room between siblings — the standard way to
push content to opposite ends of a row (or top/bottom of a tall column):

```tsx
import React from 'react';
import {render, Box, Text, Spacer} from 'ink';

const Example = () => (
	<Box>
		<Text>Left</Text>
		<Spacer />
		<Text>Right</Text>
	</Box>
);

render(<Example />);
```

In a `flexDirection="column"` box, `<Spacer>` pushes vertically instead — the
container needs a fixed `height` tall enough to see the gap.

## `<Transform transform={(line, index) => string}>`

Rewrites the plain-text output of its `<Text>` children before it's written —
used by packages like `ink-gradient` and `ink-link` (see `ink-decoration`)
that need a plain string to apply their own effect to. `<Transform>` must
wrap only `<Text>` descendants and must not change the output's dimensions
(no adding/removing lines or characters that change wrapped width), or the
surrounding layout will be wrong.

```tsx
import React from 'react';
import {render, Text, Transform} from 'ink';

const Example = () => (
	<Transform transform={(output) => output.toUpperCase()}>
		<Text>Hello World</Text>
	</Transform>
);

render(<Example />);
// => "HELLO WORLD"
```

`transform` is called once per rendered line, with the zero-indexed line
number as the second argument — useful for a hanging indent:

```tsx
import React, {type ReactNode} from 'react';
import {render, Text, Transform} from 'ink';

type HangingIndentProps = {
	indent?: number;
	children: ReactNode;
};

const HangingIndent = ({indent = 4, children}: HangingIndentProps) => (
	<Transform
		transform={(line, index) =>
			index === 0 ? line : ' '.repeat(indent) + line
		}
	>
		{children}
	</Transform>
);

render(
	<HangingIndent>
		<Text>First line stays flush{'\n'}continuation lines are indented</Text>
	</HangingIndent>,
);
```

**Warning:** when children use styling props like `color`/`bold`, the string
passed to `transform` contains raw ANSI escape codes. Whitespace/substring
operations (`.trim()`, slicing) need ANSI-aware helpers (`slice-ansi`,
`strip-ansi`) or they'll corrupt the escape sequences.

Related skills: ink-layout, ink-decoration, ink-borders-and-backgrounds
