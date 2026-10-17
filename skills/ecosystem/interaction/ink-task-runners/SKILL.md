---
name: ink-task-runners
description: Task-list UIs with per-step status (ink-task-list) and composing and running child processes with live status (ink-spawn). Use when the user wants a live list of tasks, each with its own status, or needs to spawn and display subprocess output with status; also covers why ink-progress-bar does not work on Ink 8.
metadata:
  ink: "8.0.0"
  category: ecosystem
---

# Task runners

## `ink-task-list` — a list of steps with status

```tsx
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

`state`: `'pending' | 'loading' | 'success' | 'warning' | 'error'`.
**`state="loading"` requires a `spinner`** (`{interval, frames}` — the shape of
a [`cli-spinners`](https://github.com/sindresorhus/cli-spinners) entry); the
types reject it without one. `Task` also takes `status` and `output` strings —
`status` renders in brackets after the label (`✔ Build [3/10]`) and `output`
as an indented `→ …` line below it — and nested `Task` children for a sub-step
breakdown, shown when `isExpanded` (an expanded task shows `❯` in place of its
state glyph). Peer `ink >=3.0.0` covers Ink 8, and it renders there
(`✔ Built`, `◼ Pending`, an animated spinner for `loading`). Outside Windows the
glyphs are Unicode unless `TERM` is `linux`, where it draws `√ Built` and
`■ Pending`. `<Static>` (`ink-static-output`) writes each item once and never
updates it, so it fits items that are done the moment they appear;
`ink-task-list` redraws a `Task` in place when its `state` changes.

## `ink-spawn` — composable subprocess execution with status

```tsx
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

`<Spawn>` starts its process on mount and does not stop it on unmount. It shows
a status (running, succeeded or failed); while running it also shows the tail
of the output — at most `maxOutputLines` lines, 5 by default, the empty line
after a final newline included — and after a failure the stderr. A failure
sets `process.exitCode` to the process's exit code. `<Spawn>` forwards
`SIGINT` and `SIGTERM` received by the Node process to its process, and sends
it `SIGTERM` when the Node process exits. `<Spawn>` crashes the Node process
with `TypeError: dest.end is not a function` when stdin is a file or
`/dev/null`; with a pipe it is fine. A finished
`<Spawn command="echo" args={['hi']} />` renders `✔ Ran 'echo hi'`.

`<Script>` composes multiple `<Spawn>`/`<Script>` children — sequential by
default (renders only completed steps plus the currently running one), or
`parallel` to run all children at once. Scripts nest (parallel inside
sequential inside parallel...), so once you need more than one subprocess with
dependencies between them, `ink-spawn` handles the sequencing that your own
`useEffect` chain (see `ink-async-and-suspense`'s subprocess pattern) would
otherwise have to. Peer `ink >=4.0.0`.

## `ink-progress-bar` — don't use it on Ink 8

`ink-progress-bar` is a CommonJS package that `require()`s Ink,
so it throws `ERR_REQUIRE_ASYNC_MODULE` on Ink 8 (see
`ink-ecosystem-overview`) — its README also still imports `<Color>` from Ink,
which Ink no longer exports. Use `@inkjs/ui`'s `ProgressBar`
(`inkjs-ui-feedback`) instead: it takes `value` as a number from `0` to `100`.
(If you meet old code using `ink-progress-bar`, its `percent` prop was a
*fraction* between 0 and 1 — don't carry that scale over to `value`.)

Related skills: ink-async-and-suspense, ink-static-output, inkjs-ui-feedback, ink-ecosystem-overview
