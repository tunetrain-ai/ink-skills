---
name: ink-layout
description: Lay out terminal UI with Ink's <Box>, a Yoga flexbox container — width/height, padding/margin, gap, flex-grow/shrink/basis, flexDirection, alignItems/justifyContent, position, overflow, scrolling with contentOffsetX/contentOffsetY, and measuring a box at runtime with measureElement/useBoxMetrics. Use for any "how do I position/size/center/space out" question in Ink.
metadata:
  ink: "8.0.0"
  category: core
---

# Layout with `<Box>`

`<Box>` is Ink's only layout primitive. Every `<Box>` is a Yoga flexbox
container — think `<div style="display: flex">`, always, with no other
display mode. There is no CSS Grid, no absolute-by-default positioning, and
no implicit block layout. `<Box>` renders nothing itself; only `<Text>`
renders characters.

```tsx
import React from 'react';
import {render, Box, Text} from 'ink';

const Example = () => (
	<Box margin={2}>
		<Text>This is a box with margin</Text>
	</Box>
);

render(<Example />);
```

For the full prop reference (every dimension/spacing/flex/position/overflow
prop, with examples) see `references/box-props.md`. This file covers the
mental model and the handful of things that trip people up.

## The flex default is `row`, not `column`

Unlike a browser `<div>`, `<Box>`'s default `flexDirection` is `row` — children
lay out left-to-right unless you set `flexDirection="column"`. This is the #1
source of "why is my vertical list rendering as one line" bugs.

```tsx
import React from 'react';
import {Box, Text} from 'ink';

const VerticalList = () => (
	<Box flexDirection="column">
		<Text>Line one</Text>
		<Text>Line two</Text>
	</Box>
);
```

## Sizing units are terminal cells, not pixels

`width`/`height` are counted in character columns/rows. Percentages resolve
against the parent's resolved size. `minWidth`/`maxWidth` accept only numbers
(cells); percentage strings are a type error. `minHeight`/`maxHeight` still
accept percentages.

## Spacing: `gap` vs `margin` vs `padding`

- `gap` (and `columnGap`/`rowGap`) space out a box's **direct children**, only
  between them — no gap before the first or after the last child.
- `margin*` pushes a box away from its siblings.
- `padding*` adds space inside a box, between its border and its content.

Prefer `gap` over adding `marginRight` to every child but the last — it's
shorter and doesn't need a special case for the last item.

## Centering and spacing content

Three tools cover almost every layout request:

```tsx
import React from 'react';
import {Box, Text} from 'ink';

// Center a single child in both axes
const Centered = () => (
	<Box justifyContent="center" alignItems="center" height={5}>
		<Text>Centered</Text>
	</Box>
);
```

```tsx
import React from 'react';
import {Box, Text, Spacer} from 'ink';

// Push content to opposite ends — <Spacer> eats all remaining space
const Header = () => (
	<Box>
		<Text>Left</Text>
		<Spacer />
		<Text>Right</Text>
	</Box>
);
```

```tsx
import React from 'react';
import {Box, Text} from 'ink';

// Fill remaining space with flexGrow instead of a fixed width
const StatusLine = () => (
	<Box>
		<Text>Label:</Text>
		<Box flexGrow={1}>
			<Text>Fills all remaining space</Text>
		</Box>
	</Box>
);
```

## Measuring a box at runtime

`measureElement(ref.current)` and the `useBoxMetrics(ref)` hook both return a
box's resolved layout, and both return zeros until the first layout pass:

- `measureElement` → `{x, y, width, height, clientWidth, clientHeight}`
- `useBoxMetrics` → `{width, height, left, top, clientWidth, clientHeight, hasMeasured}`

Two differences:

- `useBoxMetrics` is a hook that **re-renders your component** when layout
  changes (resize, content changes); `measureElement` is an **imperative,
  point-in-time read** you call from `useEffect`/`useLayoutEffect`, an input
  handler, or a timer — never during render, where it returns all zeros
  because layout hasn't run yet.
- `measureElement` takes a non-null `DOMElement`, so guard `ref.current`
  before calling it (a ref is `null` until the element mounts).

`clientWidth`/`clientHeight` are the size excluding borders but **not**
padding. `left`/`top` are relative to the parent and `x`/`y` accumulate up the
layout tree; neither includes an ancestor's `contentOffsetX`/`contentOffsetY`,
so subtract the offset when hit-testing inside a scrolled box.

```tsx
import React, {useRef, useEffect, useState} from 'react';
import {render, measureElement, Box, Text} from 'ink';
import type {DOMElement} from 'ink';

const Example = () => {
	const ref = useRef<DOMElement | null>(null);
	const [width, setWidth] = useState(0);

	useEffect(() => {
		if (!ref.current) return;
		// only reliable here — post-render
		setWidth(measureElement(ref.current).width);
	}, []);

	return (
		<Box width={100}>
			<Box ref={ref} flexGrow={1}>
				<Text>This box grows to 100 columns, measured: {width}</Text>
			</Box>
		</Box>
	);
};

render(<Example />);
```

## Scrolling a long list

`<Box>` has `contentOffsetX`/`contentOffsetY` (cells, default `0`) that shift
its children left/up. Put the content in a fixed-size `overflow="hidden"`
viewport and set `contentOffsetY={scrollTop}`; clamp `scrollTop` to
`content.height - viewport.clientHeight`, both measured with `useBoxMetrics`.
See `references/scrollable-view.md` for a full component.

Everything inside a `contentOffset` viewport is still laid out, so for very
large or unbounded lists render only a slice of the items (windowing) instead —
that file shows it too. `ink-navigation` covers drop-in libraries
(`ink-scroll-view`, `ink-scroll-list`, `ink-virtual-list`).

Related skills: ink-getting-started, ink-borders-and-backgrounds, ink-fullscreen-layouts, ink-terminal-io
