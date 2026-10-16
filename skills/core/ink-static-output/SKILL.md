---
name: ink-static-output
description: Render permanent, append-only output above a live-updating Ink UI with <Static> — completed task lists, logs, or any growing collection of items you can't bound in advance. Covers the items/style/children(item) API and why previously-rendered items never re-render. Use when the user wants a scrolling log or a "completed items" list alongside a live progress UI.
metadata:
  ink: "8.0.0"
  category: core
---

# `<Static>`: permanent output above a live UI

`<Static>` renders its output **once**, permanently, above everything else —
for activity that doesn't change after it's shown: completed tasks, log
lines, anything you can't know the final count of ahead of time. Ink's own
documentation for it names Tap's completed-test list and Gatsby's
generated-page log, running alongside a live progress bar, as examples.

```tsx
import React, {useState, useEffect} from 'react';
import {render, Static, Box, Text} from 'ink';

const Example = () => {
	const [tests, setTests] = useState<{id: number; title: string}[]>([]);

	useEffect(() => {
		let completedTests = 0;
		let timer: ReturnType<typeof setTimeout>;

		const run = () => {
			if (completedTests++ < 10) {
				setTests((previousTests) => [
					...previousTests,
					{id: previousTests.length, title: `Test #${previousTests.length + 1}`},
				]);
				timer = setTimeout(run, 100);
			}
		};

		run();
		return () => clearTimeout(timer);
	}, []);

	return (
		<>
			{/* Rendered once, permanently, as each item is added */}
			<Static items={tests}>
				{(test) => (
					<Box key={test.id}>
						<Text color="green">✔ {test.title}</Text>
					</Box>
				)}
			</Static>

			{/* Keeps re-rendering as state changes */}
			<Box marginTop={1}>
				<Text dimColor>Completed tests: {tests.length}</Text>
			</Box>
		</>
	);
};

render(<Example />);
```

| Prop | Type | Notes |
| --- | --- | --- |
| `items` | `Array` | Items of any type to render. |
| `style` | `object` | Applied to the container of rendered children — accepts every `<Box>` style property (see `ink-layout`). |
| `children(item, index)` | `Function` | Called once per item in `items`. **Must assign a `key` to the root element it returns.** |

## The one rule that matters

`<Static>` renders **only the items past the previous `items.length`** — it
counts items, it does not diff them, so it never re-renders or erases an item it
already rendered. If you mutate an object already present in a previous `items`
array, replace an earlier item, or shrink the array, nothing on screen changes;
only append new items. After a shrink, appended items are counted from the
new, shorter length. Each item's render function runs once, however many times
the list grows, and the elements it returns are removed from the tree as soon as
they have been written: a component inside an item is unmounted right away, so
keep items free of state, effects and timers.

## When not to use it

`<Static>` is for content that's genuinely done changing. For a live-updating
list where earlier entries can still change (e.g. a task list where a
"pending" row later becomes "done" in place), use ordinary state and
`ink-task-runners`' `ink-task-list`, or plain `<Box>`/`<Text>` — not
`<Static>`.

Related skills: ink-rendering-and-lifecycle, ink-task-runners, ink-async-and-suspense
