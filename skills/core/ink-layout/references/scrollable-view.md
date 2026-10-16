# Scrolling a view (`contentOffset`)

`<Box>` can scroll its children: `contentOffsetX`/`contentOffsetY` shift them
left/up (in cells), and `overflow="hidden"` clips whatever falls outside the
box. Ink does not track the offset, read input, or clamp it — you keep
`scrollTop` in state, bound it to the measured content, and wire it to keys.
Verified against ink 8.0.0.

The pattern: a fixed-size `overflow="hidden"` **viewport** with
`contentOffsetY={scrollTop}`, wrapping a **content** box that holds everything.
Measure both with `useBoxMetrics` and clamp `scrollTop` to
`content.height - viewport.clientHeight`.

```tsx
import React, {useRef, useState, type ReactNode} from 'react';
import {render, Box, Text, useInput, useBoxMetrics, type DOMElement} from 'ink';

type ScrollViewProps = {
	height: number;
	children: ReactNode;
};

const ScrollView = ({height, children}: ScrollViewProps) => {
	const viewportRef = useRef<DOMElement>(null);
	const contentRef = useRef<DOMElement>(null);
	const {clientHeight} = useBoxMetrics(viewportRef);
	const content = useBoxMetrics(contentRef);
	const [requestedScrollTop, setRequestedScrollTop] = useState(0);

	const maxScrollTop = Math.max(0, content.height - clientHeight);
	// Clamp every render — the maximum shrinks as the content or viewport change.
	const scrollTop = Math.min(requestedScrollTop, maxScrollTop);

	useInput((_input, key) => {
		if (key.upArrow) {
			setRequestedScrollTop(Math.max(0, scrollTop - 1));
		}

		if (key.downArrow) {
			setRequestedScrollTop(Math.min(maxScrollTop, scrollTop + 1));
		}
	});

	return (
		<Box
			ref={viewportRef}
			height={height}
			flexDirection="column"
			overflow="hidden"
			contentOffsetY={scrollTop}
		>
			<Box ref={contentRef} flexDirection="column" flexShrink={0}>
				{children}
			</Box>
		</Box>
	);
};

const App = () => (
	<ScrollView height={5}>
		{Array.from({length: 20}, (_, index) => (
			<Text key={index}>Row {index + 1}</Text>
		))}
	</ScrollView>
);

render(<App />);
```

`useBoxMetrics` returns zeros until the first layout pass, so the first frame
shows the top of the content (`maxScrollTop` is `0`) and the view settles on
the next render.

## Gotchas

- **Keep `flexShrink={0}` on the content wrapper.** Boxes shrink by default, so
  without it Yoga squeezes the wrapper — and the rows inside it — down to the
  viewport height. The rows then overlap (20 rows in a 5-row viewport rendered
  `Row 4`, `Row 8`, `Row 12`, `Row 16`, `Row 20`), `content.height` equals the
  viewport height, `maxScrollTop` is `0`, and nothing scrolls.
- **Padding goes on the content wrapper, not the viewport.**
  `clientWidth`/`clientHeight` exclude borders but not padding, and padding does
  not clip, so `content.height - clientHeight` is only exact for an unpadded
  viewport. A border on the viewport is fine.
- **Variable item heights work for free** — wrapped multi-line text, nested
  boxes — because the content height is measured, not computed from an item
  count.
- **Hit-testing:** a child's `left`/`top` (`useBoxMetrics`) and `x`/`y`
  (`measureElement`) are layout coordinates and ignore an ancestor's
  `contentOffset`. Subtract the offset (`scrollTop` here) to get where it is
  drawn.
- **Offsets are whole cells.** Fractional values truncate toward zero and
  non-finite values become `0`; round `scrollTop` yourself if you animate it.
- **Wide characters:** when the viewport edge splits a wide character (CJK), Ink
  draws a space (keeping the cell's styles) instead of half a glyph.
- **Horizontal scrolling** works the same with `contentOffsetX`, but give the
  content wrapper an explicit `width` wider than the viewport (plus
  `flexShrink={0}`). Without it, text wraps to the viewport width instead of
  running off the edge. Clamp to `content.width - clientWidth`.

## When to still window

Everything inside a `contentOffset` viewport is laid out and measured, even the
rows that are clipped, so the cost grows with the total item count. For very
large or unbounded lists, render only the slice that fits instead — **windowing**:
keep a scroll index in state and slice the data before rendering. This version
assumes one item per row.

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

	useInput((_input, key) => {
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

export default ScrollList;
```

Slicing by item **count** stops being exact once items have different heights
(wrapped text, nested boxes). Either keep items one row tall, or reach for
`ink-scroll-view`, `ink-scroll-list`, or `ink-virtual-list` (see
`ink-navigation`) — `contentOffset` handles variable heights on its own, so a
library is only needed for virtualization.
