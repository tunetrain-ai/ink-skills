---
name: ink-decoration
description: Decorative text and layout components for Ink — clickable terminal links (ink-link), gradient-colored text (ink-gradient), large ASCII banner text (ink-big-text), section dividers (ink-divider), titled boxes (ink-titled-box), and inline images (ink-picture). Use for branding, banners, section headers, or clickable links.
metadata:
  ink: "7.1.1"
  category: ecosystem
---

# Decoration

## `ink-link` — clickable terminal links

```tsx no-check
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

```tsx no-check
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

```tsx no-check
import BigText from 'ink-big-text';

<BigText text="unicorns" />;
```

All props except `text` pass through to [`cfonts`](https://github.com/dominikwilkowski/cfonts)
(note: its `background` option is renamed `backgroundColor` here).

## `ink-divider` — section dividers

```tsx no-check
import Divider from 'ink-divider';

<Divider title="Section title" />
// ─────────── Section title ───────────
```

Automatically grows to the width of its container.

## `ink-titled-box` and `ink-picture`

`ink-titled-box` renders a bordered `<Box>` with a title embedded in the
border; `ink-picture` renders raster images inline (terminal-support
dependent, similar to `ink-link`'s escape-sequence requirement). Neither
publishes a readme worth summarizing here beyond that description — check
each package's own docs for its current prop API before using it, since this
catalog can't verify props for a package with no published documentation to
verify against.

Related skills: ink-text-styling, ink-layout, ink-ecosystem-overview
