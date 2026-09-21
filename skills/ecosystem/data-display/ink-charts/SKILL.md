---
name: ink-charts
description: Render sparklines, bar charts, stacked bar charts, and line graphs in an Ink terminal UI with the ink-chart package, or build a simple custom chart from <Box> blocks. Use when the user wants a chart, graph, or sparkline in their CLI output.
metadata:
  ink: "7.1.1"
  category: ecosystem
---

# Charts

## `ink-chart`

A young, actively-developed package exporting several chart components.
**Its declared peer range predates Ink 7** (see `ink-ecosystem-overview`) —
verify the installed version's actual API before relying on the prop names
below, since a young package like this can move fast.

```tsx no-check
import {Sparkline} from 'ink-chart';

<Sparkline data={[1, 3, 2, 8, 4]} width={30} colorScheme="red" caption="Sales Trend" />;
```

| Component | Purpose | Key props |
| --- | --- | --- |
| `Sparkline` | Compact inline trend line | `data: number[]`, `width`, `threshold?`, `colorScheme?: 'red' \| 'blue' \| 'green'`, `mode?: 'block' \| 'braille'`, `caption?` |
| `BarChart` | Horizontal bars, one per category | `data: {label, value, color?}[]`, `sort?`, `showValue?`, `width?`, `max?`, `format?`, `barChar?` |
| `StackedBarChart` | 100%-stacked or absolute horizontal bars | `data: {label, value, color?}[]`, `mode?: 'percentage' \| 'absolute'`, `max?`, `showLabels?`, `showValues?` |
| `LineGraph` | Multi-series line graph with axes | `data: {values: number[], color?}[]`, `width?`, `height?`, `yDomain?`, `showYAxis?`, `yLabels?`, `xLabels?`, `caption?` |

```tsx no-check
import {BarChart} from 'ink-chart';

<BarChart
	data={[
		{label: 'Success', value: 22, color: '#4aaa1a'},
		{label: 'Errors', value: 15, color: '#a61d24'},
	]}
	showValue="right"
	width={50}
/>;
```

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

Reach for `ink-chart` once you need more than one series, axis labels, or a
sparkline/line-graph shape — those aren't worth reimplementing.

Related skills: ink-layout, ink-ecosystem-overview
