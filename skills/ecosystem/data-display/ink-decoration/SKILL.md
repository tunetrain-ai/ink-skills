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
the text instead (`My Website https://example.com` for the example above);
pass `false` to suppress it, or a function `(text, url) => string` for a custom fallback
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

`name` picks a [built-in gradient](https://github.com/bokub/gradient-string#available-built-in-gradients);
`colors` takes an array of colour strings or objects for a custom gradient.
The two are mutually exclusive — passing both throws. Children can be a string
or Ink components. Each line is coloured on its own, so every line spans the
whole gradient however the text is passed. Multiple `<Text>` children are
separate gradient runs: the gradient restarts in each, and their layout is
preserved (stacked, for example, inside a `flexDirection="column"` box).

## `ink-big-text` — large ASCII banner text

```tsx
import React from 'react';
import BigText from 'ink-big-text';

const Banner = () => <BigText text="unicorns" />;
```

Props other than `text` are passed to [`cfonts`](https://github.com/dominikwilkowski/cfonts)
as its options. The typed ones are `font`, `align`, `colors`,
`backgroundColor`, `letterSpacing`, `lineHeight`, `space` and `maxLength`. Of
these cfonts ignores `space`; the option that removes the empty rows around the
text is `spaceless`, which the types do not list.

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
// In a 31-column terminal, <Divider title="Section title" />  →  ── Section title ──────────────
```

A bare `<Rule />` stretches across a column parent; only the titled form
needs `flexGrow` (it sits in a row and fills what the title leaves). Don't
put `flexGrow` on a bare rule inside a fixed-height column — it would absorb
the free vertical space. `borderStyle` picks the line glyph (`'single'` `─`,
`'double'` `═`, `'bold'` `━`, `'classic'` `-`); see `ink-borders-and-backgrounds`.

## `@mishieck/ink-titled-box` — a border with a title

A bordered `<Box>` with titles embedded in its top border. The unscoped
name `ink-titled-box` does not exist on npm — install the scoped package. Its
peer range is `ink ^6`, so it needs `--legacy-peer-deps`; on Ink 8 it renders
and lays out like any other `<Box>`.

```tsx
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
renders on Ink 8: its peer range, `ink >=5`, includes it.

```tsx
import React from 'react';
import {render} from 'ink';
import Image, {InkPictureProvider} from 'ink-picture';

render(
	<InkPictureProvider>
		<Image src="./logo.png" width={20} height={10} alt="Logo" />
	</InkPictureProvider>,
);
```

`src` (a path, URL or buffer) is required. `width` and `height` (a number of
cells or a percentage of a parent `<Box>` with a determinable size) default to
`"100%"`. `alt`, `objectFit` (`'fill' | 'contain' | 'cover'`, default `'fill'`)
and `protocol` (to force one rendering protocol) are optional.

Related skills: ink-text-styling, ink-layout, ink-borders-and-backgrounds, ink-ecosystem-overview
