---
name: ink-decoration
description: Decorative text and layout components for Ink — clickable terminal links (ink-link), gradient-colored text (ink-gradient), large ASCII banner text (ink-big-text), section dividers drawn with a <Box> border, titled boxes (@mishieck/ink-titled-box), and inline images (ink-picture). Use for branding, banners, section headers, or clickable links.
metadata:
  ink: "8.0.0"
  category: ecosystem
---

# Decoration

## `ink-link` — clickable terminal links

```tsx
import React from 'react';
import {render, Text} from 'ink';
import Link from 'ink-link';

render(
	<Link url="https://example.com">
		My <Text color="cyan">Website</Text>
	</Link>,
);
```

Only works in [terminals that support the OSC 8 hyperlink escape
sequence](https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda).
For unsupported terminals, `fallback` (default `true`) prints the URL after
the text instead (`My website https://example.com`); pass `false` to
suppress it, or a function `(text, url) => string` for a custom fallback
format (e.g. Markdown-style `[text](url)`).

## `ink-gradient` — gradient-colored text

```tsx
import React from 'react';
import {render} from 'ink';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';

render(
	<Gradient name="rainbow">
		<BigText text="unicorns" />
	</Gradient>,
);
```

`name` picks a [built-in gradient](https://github.com/bokub/gradient-string#available-built-in-gradients)
(mutually exclusive with `colors: string[] | object[]` for a custom
gradient). Accepts a string or Ink component as children. Multiple `<Text>`
children are treated as separate gradient runs (preserving layout inside a
`flexDirection="column"` box) — for one continuous gradient across multiple
lines, pass a single string or single `<Text>` containing `\n`.

## `ink-big-text` — large ASCII banner text

```tsx
import React from 'react';
import BigText from 'ink-big-text';

const Banner = () => <BigText text="unicorns" />;
```

All props except `text` pass through to [`cfonts`](https://github.com/dominikwilkowski/cfonts)
(note: its `background` option is renamed `backgroundColor` here).

## Dividers — draw them with a `<Box>` border

`ink-divider` cannot be used on Ink 8: it hard-depends on `ink ^5.1.0`, so it
installs a second, old copy of Ink whose reconciler crashes on React 19. A
border on a single side does the same job and fills its parent's width:

```tsx
import React from 'react';
import {Box, Text, type BoxProps} from 'ink';

const Rule = (props: BoxProps) => (
	<Box
		borderStyle="single"
		borderBottom={false}
		borderLeft={false}
		borderRight={false}
		{...props}
	/>
);

const Divider = ({title}: {title?: string}) =>
	title ? (
		<Box>
			<Text>── </Text>
			<Text bold>{title}</Text>
			<Text> </Text>
			<Rule flexGrow={1} />
		</Box>
	) : (
		<Rule />
	);
// <Divider title="Section title" />  →  ── Section title ──────────────
```

A bare `<Rule />` stretches across a column parent; only the titled form
needs `flexGrow` (it sits in a row and fills what the title leaves). Don't
put `flexGrow` on a bare rule inside a fixed-height column — it would absorb
the free vertical space. `borderStyle` picks the line glyph (`'double'`,
`'bold'`, `'round'`, …); see `ink-borders-and-backgrounds`.

## `@mishieck/ink-titled-box` — a border with a title

A bordered `<Box>` with titles embedded in its top border. The unscoped
name `ink-titled-box` does not exist on npm — install the scoped package. Its
peer range is `ink ^6`, so it needs `--legacy-peer-deps`; its first frame
renders on Ink 8 but it was not exercised further.

```tsx no-check
import React from 'react';
import {Text} from 'ink';
import {TitledBox} from '@mishieck/ink-titled-box';

const Panel = () => (
	<TitledBox titles={['Status']} borderStyle="round" padding={1}>
		<Text>All systems go</Text>
	</TitledBox>
);
```

`titles: string[]` and `borderStyle` are required; it also takes
`titleJustify`, `titleStyles`, and the other `<Box>` props. If you only need a
plain title row above a bordered box, composing a `<Text>` with a `<Box>`
avoids the peer conflict entirely.

## `ink-picture` — inline images

Renders raster images inline, detecting the terminal's best protocol (Kitty,
iTerm2, Sixel) and falling back to half-block, braille or ASCII text. Its
README says to wrap the **whole app** in `<InkPictureProvider>` once, at the
root; on mount the provider queries the terminal and holds stdin for up to a
second while it does, buffering keystrokes and replaying them afterwards. It
was **not exercised on Ink 8** — test it in a real terminal before relying on
it.

```tsx no-check
import React from 'react';
import {render} from 'ink';
import Image, {InkPictureProvider} from 'ink-picture';

render(
	<InkPictureProvider>
		<Image src="./logo.png" width={20} height={10} alt="Logo" />
	</InkPictureProvider>,
);
```

`src` (a path, URL or buffer), `width` and `height` (a number of cells or a
percentage of a parent `<Box>` with a determinable size) are required; `alt`,
`objectFit` (`'fill' | 'contain' | 'cover'`) and `protocol` (to force one
rendering protocol) are optional.

Related skills: ink-text-styling, ink-layout, ink-borders-and-backgrounds, ink-ecosystem-overview
