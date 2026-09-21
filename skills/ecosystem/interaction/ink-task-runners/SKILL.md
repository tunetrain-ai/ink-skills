---
name: ink-task-runners
description: Task-list UIs with per-step status (ink-task-list), composing and running child processes with live status (ink-spawn), and a standalone legacy progress bar (ink-progress-bar). Use when the user wants a "running task 1, 2, 3..." UI or needs to spawn and display subprocess output with status.
metadata:
  ink: "7.1.1"
  category: ecosystem
---

# Task runners

## `ink-task-list` — a list of steps with status

```tsx no-check
import React from 'react';
import {render} from 'ink';
import {TaskList, Task} from 'ink-task-list';
import spinners from 'cli-spinners';

render(
	<TaskList>
		<Task label="Pending" state="pending" />
		<Task label="Installing" state="loading" spinner={spinners.dots} />
		<Task label="Built" state="success" />
		<Task label="Deprecated flag" state="warning" />
		<Task label="Tests failed" state="error" />
		<Task label="Nested step" isExpanded>
			<Task label="Sub-step" state="loading" spinner={spinners.dots} />
		</Task>
	</TaskList>,
);
```

`state`: `'pending' | 'loading' | 'success' | 'warning' | 'error'`. `Task`
accepts nested `Task` children for a sub-step breakdown, shown when
`isExpanded`. Peer range predates Ink 7 (see `ink-ecosystem-overview`) — no
current alternative exists specifically for this "list of labeled steps"
shape; verify against your installed version. For a list of items that
should permanently stop re-rendering once complete (rather than update
their status in place), `<Static>` (`ink-static-output`) may be the simpler
fit — the difference is whether items still need to *change* state
(`ink-task-list`) or are done the moment they appear (`<Static>`).

## `ink-spawn` — composable subprocess execution with status

```tsx no-check
import React from 'react';
import {Text} from 'ink';
import {Spawn, Script} from 'ink-spawn';

const App = () => (
	<>
		<Text>Running build steps</Text>
		<Script>
			<Spawn command="npm" args={['run', 'lint']} />
			<Script parallel>
				<Spawn command="npm" args={['run', 'test']} />
				<Spawn command="npm" args={['run', 'typecheck']} />
			</Script>
			<Spawn command="npm" args={['run', 'build']} />
		</Script>
		<Text>Done</Text>
	</>
);
```

`<Spawn>` starts its process on mount, kills it on unmount, shows a status
(running/succeeded/failed) and the tail of its output, and propagates
Ctrl+C. `<Script>` composes multiple `<Spawn>`/`<Script>` children —
sequential by default (renders only completed steps plus the currently
running one), or `parallel` to run all children at once. Scripts nest
arbitrarily (parallel inside sequential inside parallel...), which is the
main reason to reach for this over hand-rolling subprocess orchestration
with `useEffect` (see `ink-async-and-suspense`'s subprocess pattern) — once
you need more than one subprocess with dependencies between them, `ink-spawn`
handles the sequencing your own `useEffect` chain would otherwise have to.

## `ink-progress-bar` — standalone progress bar

A much older package predating `@inkjs/ui`. Its own usage example still
imports Ink's long-removed `<Color>` component, which is a strong signal
its documentation (not necessarily its code) hasn't kept pace — **prefer
`@inkjs/ui`'s `ProgressBar`** (`inkjs-ui-feedback`) for new code. If you do
use it: `percent` is a **fraction between 0 and 1** (not 0–100 like
`@inkjs/ui`'s `value`) — mixing the two up silently renders a bar stuck at
0% or maxed out. `character` (default `'█'`) sets the fill glyph;
`left`/`right` reserve columns for text placed beside the bar on the same
line.

Related skills: ink-async-and-suspense, ink-static-output, inkjs-ui-feedback, ink-ecosystem-overview
