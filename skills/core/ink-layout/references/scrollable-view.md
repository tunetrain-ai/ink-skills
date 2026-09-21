# Scrolling a long list (windowing)

Ink 7 has no `contentOffset`/scroll-offset prop on `<Box>` — there is no way
to lay out content once and then shift a viewport over it. The pattern that
does work against the published API is **windowing**: keep a scroll index in
state, and render only the slice of items that fits the available height.
Verified against ink 7.1.1.

```tsx
import React, {useState} from 'react';
import {Box, Text, useInput} from 'ink';

type ScrollListProps = {
	items: string[];
	height: number;
};

const ScrollList = ({items, height}: ScrollListProps) => {
	const [scrollTop, setScrollTop] = useState(0);
	const maxScrollTop = Math.max(0, items.length - height);
	// Clamp every render — the maximum shrinks as `items` or `height` change.
	const clampedScrollTop = Math.min(scrollTop, maxScrollTop);
	const visible = items.slice(clampedScrollTop, clampedScrollTop + height);

	useInput((input, key) => {
		if (key.upArrow) {
			setScrollTop(Math.max(0, clampedScrollTop - 1));
		}

		if (key.downArrow) {
			setScrollTop(Math.min(maxScrollTop, clampedScrollTop + 1));
		}
	});

	return (
		<Box flexDirection="column" height={height}>
			{visible.map((item, index) => (
				<Text key={clampedScrollTop + index}>{item}</Text>
			))}
		</Box>
	);
};
```

## Why not measure-and-clip instead

An alternative that comes up naturally is: render everything inside a
fixed-height `<Box overflow="hidden">` and rely on Ink clipping whatever
doesn't fit. That clips the *bottom* of the content — there's no equivalent
of `scrollTop` to shift which part is visible, so it only gets you a
"show the first N rows" view, not scrolling. Windowing (slicing the data
before rendering) is what actually lets you move the visible range.

## Variable-height items

The example above assumes one item = one row. For items with variable
height (wrapped multi-line text, nested boxes), slicing by item **count**
stops being accurate — you'd need to slice by cumulative rendered height
instead, which means measuring items as they render (see `ink-layout`'s
`measureElement`/`useBoxMetrics` section) and adjusting the window
dynamically. This is exactly what `ink-scroll-view`, `ink-scroll-list`, and
`ink-virtual-list` handle for you — see `ink-navigation` — reach for one of
them once item heights stop being uniform, rather than reimplementing
height-aware windowing by hand.
