# `<Box>` full prop reference

All props are optional.

## Dimensions

| Prop | Type | Notes |
| --- | --- | --- |
| `width` | `number \| string` | Cells, or `"50%"` of the resolved parent width. |
| `height` | `number \| string` | Rows, or `"50%"` of the resolved parent height. |
| `minWidth` | `number` | Number only (cells); percentage strings are a type error. |
| `minHeight` | `number \| string` | Percentage supported. |
| `maxWidth` | `number` | Number only (cells); percentage strings are a type error. |
| `maxHeight` | `number \| string` | Percentage supported. |
| `aspectRatio` | `number` | width/height. Needs at least one size constraint so Ink can derive the other dimension. |

```tsx
import React from 'react';
import {Box, Text} from 'ink';

const Example = () => (
	<Box width={6} borderStyle="single">
		<Text>X</Text>
	</Box>
);
// ┌────┐
// │X   │
// └────┘
```

## Padding

`paddingTop` / `paddingBottom` / `paddingLeft` / `paddingRight` — each
`number`, default `0`. Shorthands: `paddingX` (left+right), `paddingY`
(top+bottom), `padding` (all four).

## Margin

`marginTop` / `marginBottom` / `marginLeft` / `marginRight` — each `number`,
default `0`. Shorthands: `marginX`, `marginY`, `margin`.

## Gap

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `gap` | `number` | `0` | Shorthand for `columnGap` + `rowGap`. |
| `columnGap` | `number` | `0` | Space between columns. |
| `rowGap` | `number` | `0` | Space between rows. |

```tsx
import React from 'react';
import {Box, Text} from 'ink';

const Example = () => (
	<Box gap={1} width={3} flexWrap="wrap">
		<Text>A</Text>
		<Text>B</Text>
		<Text>C</Text>
	</Box>
);
// A B
//
// C
```

## Flex

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `flexGrow` | `number` | `0` | [flex-grow](https://css-tricks.com/almanac/properties/f/flex-grow/) |
| `flexShrink` | `number` | `1` | [flex-shrink](https://css-tricks.com/almanac/properties/f/flex-shrink/) |
| `flexBasis` | `number \| string` | — | [flex-basis](https://css-tricks.com/almanac/properties/f/flex-basis/) |
| `flexDirection` | `'row' \| 'row-reverse' \| 'column' \| 'column-reverse'` | `'row'` | **Default is row**, not column. |
| `flexWrap` | `'nowrap' \| 'wrap' \| 'wrap-reverse'` | `'nowrap'` | |
| `alignItems` | `'flex-start' \| 'center' \| 'flex-end' \| 'stretch' \| 'baseline'` | `'stretch'` | Cross-axis alignment of children. |
| `alignSelf` | `'auto' \| 'flex-start' \| 'center' \| 'flex-end' \| 'stretch' \| 'baseline'` | `'auto'` | Overrides parent's `alignItems` for one child. |
| `alignContent` | `'flex-start' \| 'flex-end' \| 'center' \| 'stretch' \| 'space-between' \| 'space-around' \| 'space-evenly'` | `'flex-start'` | Only matters with `flexWrap` creating multiple lines. Ink defaults to `flex-start` (not `stretch`), so wrapped lines stay compact. |
| `justifyContent` | `'flex-start' \| 'center' \| 'flex-end' \| 'space-between' \| 'space-around' \| 'space-evenly'` | `'flex-start'` | Main-axis alignment of children. |

```tsx
import React from 'react';
import {Box, Text} from 'ink';

const Example = () => (
	<Box justifyContent="space-between" width={8}>
		<Text>X</Text>
		<Text>Y</Text>
	</Box>
);
// X      Y
```

## Position

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `position` | `'relative' \| 'absolute' \| 'static'` | `'relative'` | When `'static'`, `top`/`right`/`bottom`/`left` are ignored. |
| `top` / `right` / `bottom` / `left` | `number \| string` | — | Offset for positioned elements; percentage of parent size supported. |

## Visibility & overflow

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `display` | `'flex' \| 'none'` | `'flex'` | `'none'` hides the element entirely. |
| `overflowX` / `overflowY` | `'visible' \| 'hidden'` | `'visible'` | |
| `overflow` | `'visible' \| 'hidden'` | `'visible'` | Shorthand for both axes. Clips content that doesn't fit. Pair with `contentOffsetX`/`contentOffsetY` to scroll; see `scrollable-view.md`. |
| `contentOffsetX` | `number` | `0` | Shifts children left by N columns. Combine with `overflow="hidden"` to scroll. Fractional values truncate toward zero; non-finite → `0`. |
| `contentOffsetY` | `number` | `0` | Shifts children up by N rows. Same rules. |

## Borders & background

See `ink-borders-and-backgrounds` for `borderStyle`/`borderColor`/per-edge
variants and `backgroundColor`.
