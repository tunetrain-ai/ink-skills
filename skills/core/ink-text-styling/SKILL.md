---
name: ink-text-styling
description: Style and control text output in Ink — <Text> color/backgroundColor/bold/italic/underline/strikethrough/inverse/dimColor/wrap, <Newline>, <Spacer>, and <Transform> for post-processing rendered output (uppercase, hanging indent, gradients). Use for anything about how text looks or wraps.
metadata:
  ink: "8.0.0"
  category: core
---

# Text styling: `<Text>`, `<Newline>`, `<Spacer>`, `<Transform>`

## `<Text>`

The component that renders text — a string placed directly inside a `<Box>`
throws. `<Text>` allows only text nodes and text components (nested `<Text>`,
`<Newline>`, `<Transform>`) as children — `<Box>` cannot be nested inside
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
| `color` | `string` | — | Powered by [chalk](https://github.com/chalk/chalk) — chalk's named colors (`green`, `redBright`), hex (`"#005cc5"`), `rgb(...)`, `ansi256(...)`. Any other string is ignored. |
| `backgroundColor` | `string` | — | Same value space as `color`. |
| `dimColor` | `boolean` | `false` | Dims the text (the terminal's faint attribute). |
| `bold` / `italic` / `underline` / `strikethrough` | `boolean` | `false` | |
| `inverse` | `boolean` | `false` | Reverse video (SGR 7) — swaps foreground/background. |
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
// => 'Hel…rld'
```

- `wrap` (default): breaks onto multiple lines at word boundaries.
- `hard`: fills each line to the full column width, breaking words wherever a line ends.
- `truncate*`: renders one line, cutting the rest with `…` at the end, start,
  or middle.

## `<Newline count?>`

Inserts one or more `\n` characters. Must be used inside `<Text>` — as a
sibling in a `<Box>` it is a text node of its own and leaves two blank rows
instead of ending the line. A raw `\n` in a string works too, while
`<Newline>` can sit between differently-styled `<Text>` runs:

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
`<Box>`, filling all available room between siblings, so it pushes content to
opposite ends of a row (or to the top and bottom of a tall column):

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

Rewrites the rendered text of its `<Text>` children before it's written —
used by packages like `ink-gradient` and `ink-link` (see `ink-decoration`),
whose effects work on a string rather than on React elements. `<Transform>`
must wrap only text (`<Text>` or a plain string; a `<Box>` throws) and must
not change the output's dimensions (no adding/removing lines or characters
that change wrapped width): layout is computed before `transform` runs, so
the surrounding layout will be wrong.

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
passed to `transform` contains raw ANSI escape codes. `.trim()` then leaves the
whitespace between those codes in place and slicing by index can cut an escape
sequence in half, so use ANSI-aware helpers (`slice-ansi`, `strip-ansi`) for
whitespace and substring operations.

Related skills: ink-layout, ink-decoration, ink-borders-and-backgrounds
