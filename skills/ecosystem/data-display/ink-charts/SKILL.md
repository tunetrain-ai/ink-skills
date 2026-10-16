---
name: ink-charts
description: Render sparklines, bar charts, stacked bar charts, and line graphs in an Ink terminal UI with the @pppp606/ink-chart package (Sparkline, BarChart, StackedBarChart, LineGraph), or build a simple custom chart from <Box> blocks. Use when the user wants a chart, graph, or sparkline in their CLI output.
metadata:
  ink: "8.0.0"
  category: ecosystem
---

# Charts

## `@pppp606/ink-chart`

```sh
npm install @pppp606/ink-chart
```

**Do not install `ink-chart`** — that unscoped name is an unrelated,
abandoned package with a different API (a default-exported `Chart`), and the
components below are `undefined` when imported from it. The package
documented here is the scoped `@pppp606/ink-chart`: ESM, ships its own types,
peer `ink >=6` (covers Ink 8), and pre-1.0 — pin the version.

```tsx
import React from 'react';
import {render, Box} from 'ink';
import {BarChart, Sparkline} from '@pppp606/ink-chart';

render(
	<Box flexDirection="column">
		<Sparkline data={[1, 3, 2, 8, 4]} width={30} colorScheme="red" caption="Sales Trend" />
		<BarChart
			data={[
				{label: 'Success', value: 22, color: '#4aaa1a'},
				{label: 'Errors', value: 15, color: '#a61d24'},
			]}
			showValue="right"
			width={50}
		/>
	</Box>,
);
```

`width` on every component is `'auto' | 'full' | number`.

| Component | Purpose | Props |
| --- | --- | --- |
| `Sparkline` | Compact inline trend line | `data: number[]`, `width?`, `height?: 1 \| 2 \| 'braille'`, `mode?: 'block' \| 'braille'`, `yDomain?: 'auto' \| [number, number]`, `threshold?: number \| number[]`, `colorScheme?: 'red' \| 'blue' \| 'green'`, `caption?` |
| `BarChart` | Horizontal bars, one per category | `data: {label, value, color?, char?}[]`, `max?: 'auto' \| number`, `sort?: 'none' \| 'asc' \| 'desc'`, `showValue?: 'right' \| 'inside' \| 'none'`, `format?: (value) => string`, `barChar?: '▆' \| '█' \| '▓' \| '▒' \| '░'`, `padding?: 0 \| 1 \| 2`, `width?`, `color?` |
| `StackedBarChart` | 100%-stacked or absolute horizontal bars | `data: {label, value, color?, char?}[]`, `mode?: 'percentage' \| 'absolute'`, `max?`, `width?`, `showLabels?`, `showValues?`, `format?: (value, mode) => string` |
| `LineGraph` | Multi-series line graph with axes | `data: {values: number[], color?}[]`, `width?`, `height?: number`, `yDomain?`, `caption?`, `showYAxis?`, `yLabels?`, `xLabels?` |

It also exports a `useAutoWidth()` hook and the ANSI helpers
(`red`, `green`, `bold`, `colorize`, …) it uses internally.

## Hand-rolled bar chart

For a single simple bar chart, a `<Box width>` filled proportionally is
often less overhead than a dependency:

```tsx
import React from 'react';
import {Box, Text} from 'ink';

const Bar = ({label, value, max}: {label: string; value: number; max: number}) => (
	<Box>
		<Box width={12}>
			<Text>{label}</Text>
		</Box>
		<Box width={Math.round((value / max) * 30)} backgroundColor="green" />
		<Text> {value}</Text>
	</Box>
);
```

Reach for `@pppp606/ink-chart` once you need more than one series, axis
labels, or a sparkline/line-graph shape — those aren't worth reimplementing.

Related skills: ink-layout, ink-ecosystem-overview
