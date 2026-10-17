---
name: ink-animation-and-performance
description: Animate Ink components with useAnimation (frame/time/delta/reset, a single shared internal timer), and tune how Ink renders with maxFps, incrementalRendering, and the concurrent option (Suspense, useTransition and useDeferredValue work with or without it). Use for spinners, progress animations, or "my UI updates too fast/flickers" performance questions.
metadata:
  ink: "8.0.0"
  category: core
---

# Animation and performance

## `useAnimation(options?)`

Drives frame-based animation. All components using `useAnimation` share a
**single internal timer**: many animated components run off one timer rather
than each starting its own interval.

```tsx
import React from 'react';
import {Text, useAnimation} from 'ink';

const Spinner = () => {
	const {frame} = useAnimation({interval: 80});
	const characters = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

	return <Text>{characters[frame % characters.length]}</Text>;
};
```

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `interval` | `number` | `100` | Milliseconds between ticks. |
| `isActive` | `boolean` | `true` | Stops the animation when `false`. Toggling back to `true` resets everything to `0` — it does not resume from where it left off. |

| Return value | Type | Use for |
| --- | --- | --- |
| `frame` | `number` | Discrete counter, +1 per interval elapsed (it jumps by more when renders are throttled) — indexed sequences like spinner frames. |
| `time` | `number` | Total elapsed ms since start/reset — continuous math like `Math.sin(time / 1000 * Math.PI * 2)`. |
| `delta` | `number` | Ms since the previous *rendered* tick (accounts for throttled renders) — physics/velocity-driven motion: `position += speed * delta`. |
| `reset` | `() => void` | Resets `frame`/`time`/`delta` to `0`, restarts timing — for one-shot animations triggered by an event. |

For a simple spinner, prefer `@inkjs/ui`'s `Spinner` (see
`inkjs-ui-feedback`) over hand-rolling one — reach for `useAnimation`
directly when you need custom frames, `time`-based easing, or
`delta`-driven motion.

## Performance controls on `render()`

Set on `render(tree, options)` — see `ink-rendering-and-lifecycle` for the
full option list.

- **`maxFps`** (default `30`) caps how many frames per second Ink writes,
  however often your components re-render; a lower value writes fewer frames.
- **`incrementalRendering`** (default `false`) redraws only the lines that
  changed instead of the whole frame. It also skips each changed line's
  unchanged prefix when safe; a line containing an OSC 8 hyperlink is redrawn
  whole.
- **`concurrent`** (default `false`) changes when `render()` writes: it then
  returns before the initial output is written, where by default that output is
  already written when it returns. `Suspense`, `useTransition` and
  `useDeferredValue` do not need it — they work in either mode; see
  `ink-async-and-suspense` for `Suspense` specifics. Reusing the same `stdout`
  for another `render()` without unmounting is unsupported in either mode: Ink
  warns on stderr and keeps the first instance's options.

Related skills: ink-async-and-suspense, ink-rendering-and-lifecycle, inkjs-ui-feedback
