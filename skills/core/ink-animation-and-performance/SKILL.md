---
name: ink-animation-and-performance
description: Animate Ink components with useAnimation (frame/time/delta/reset, a single shared internal timer), and tune render performance with maxFps, incrementalRendering, and concurrent mode (useTransition/useDeferredValue). Use for spinners, progress animations, or "my UI updates too fast/flickers" performance questions.
metadata:
  ink: "7.1.1"
  category: core
---

# Animation and performance

## `useAnimation(options?)`

Drives frame-based animation. All components using `useAnimation` share a
**single internal timer**, so many animated components on screen still
consolidate into one render cycle rather than each running its own interval.

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
| `frame` | `number` | Discrete counter, +1 per interval — indexed sequences like spinner frames. |
| `time` | `number` | Total elapsed ms since start/reset — continuous math like `Math.sin(time / 1000 * Math.PI * 2)`. |
| `delta` | `number` | Ms since the previous *rendered* tick (accounts for throttled renders) — physics/velocity-driven motion: `position += speed * delta`. |
| `reset` | `() => void` | Resets `frame`/`time`/`delta` to `0`, restarts timing — for one-shot animations triggered by an event. |

For a simple spinner, prefer `@inkjs/ui`'s `Spinner` (see
`inkjs-ui-feedback`) over hand-rolling one — reach for `useAnimation`
directly when you need custom frames, `time`-based easing, or
`delta`-driven motion.

## Performance controls on `render()`

Set on `render(tree, options)` — see `ink-rendering-and-lifecycle` for the
full option list. Three matter specifically for animation-heavy or
fast-updating UIs:

- **`maxFps`** (default `30`) caps how often a frame is actually written,
  independent of how often your components re-render — lower it for
  components that update far more often than a terminal needs to redraw, to
  cut CPU.
- **`incrementalRendering`** (default `false`) redraws only the lines that
  changed instead of the whole frame — reduces flicker on wide/tall UIs
  that update small regions frequently.
- **`concurrent`** (default `false`) turns on React Concurrent Mode:
  `Suspense` boundaries behave correctly with async data, and
  `useTransition`/`useDeferredValue` become functional, letting updates be
  interrupted for higher-priority work. See `ink-async-and-suspense` for
  `Suspense` specifics. Note: some tests need `act()` under concurrent mode
  to reliably await updates, and reusing the same `stdout` across renders
  without unmounting is unsupported regardless of mode.

Related skills: ink-async-and-suspense, ink-rendering-and-lifecycle, inkjs-ui-feedback
