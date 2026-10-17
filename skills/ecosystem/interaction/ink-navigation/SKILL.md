---
name: ink-navigation
description: Tabs (ink-tab), step wizards (ink-stepper), and scrollable/virtualized lists for Ink — native <Box contentOffsetY> scrolling plus ink-scroll-view, ink-scroll-list and ink-virtual-list. Use when the user wants tabbed navigation, a multi-step wizard flow, or a scrollable/long list that shouldn't render every item at once.
metadata:
  ink: "8.0.0"
  category: ecosystem
---

# Navigation components

**Install caveat for everything below.** `ink-tab`, `ink-stepper`,
`ink-scroll-view`, `ink-scroll-list` and `ink-virtual-list` all declare peer
ranges that stop at Ink 6 or 7, so `npm install` fails with `ERESOLVE` on Ink
8 unless you pass `--legacy-peer-deps` (or add an `overrides` entry). Their
first frames were rendered on Ink 8.0.0 — that is the extent of what was
verified (see `ink-ecosystem-overview`); the snippets here are `no-check`
because the packages cannot be installed with strict peers.

## `ink-tab` — tabs

Peer `^4 || ^5 || ^6`. Its own documentation lives on a separate docs site
(not in its GitHub readme) — check [the ink-tab
docs](https://jdeniau.gitbook.io/ink-tab/) for the full prop list.

```tsx no-check
import React from 'react';
import {Tab, Tabs} from 'ink-tab';

const App = () => (
	<Tabs onChange={(name, activeTab) => console.log(name)}>
		<Tab name="overview">Overview</Tab>
		<Tab name="logs">Logs</Tab>
	</Tabs>
);
```

It renders a row like `1. Overview | 2. Logs`. In a test on Ink 8 (through
`ink-testing-library`) the Right arrow and Tab switched tabs, but the digit
shortcuts its `keyMap` enables by default (`useNumbers`) did not — verify them
in a real terminal, or don't advertise them. `keyMap` also takes `useTab`,
`previous` and `next`; `Tabs` takes `flexDirection` and `width`. `onChange`
fires once on mount with the first tab's `name`, then on each switch. The
`Tab` children are only the label — it does not render tab *contents*, so
switch on the `name` from `onChange` yourself. `children` is typed as an array,
so give it at least two `<Tab>` elements.

## `ink-stepper` — step wizards

Peer `^6.6.0 || ^7.0.0`.

```tsx no-check
import React from 'react';
import {Stepper, Step} from 'ink-stepper';

const App = () => (
	<Stepper onComplete={() => process.exit(0)} onCancel={() => process.exit(1)}>
		<Step name="Theme">
			<ThemeSelector />
		</Step>
		<Step name="Directory" canProceed={pathIsValid}>
			{({goNext, goBack}) => <PathInput onConfirm={goNext} onBack={goBack} />}
		</Step>
	</Stepper>
);
```

Each `<Step>` can be a plain child or a render-prop function receiving
navigation controls (`goNext`, `goBack`, and a raw `goTo` that skips
`canProceed`); `canProceed` is a boolean or a (possibly async) function that
gates advancing past a step. `Stepper` also takes `onStepChange`,
`onEnterStep`, `onExitStep` (return `false` to cancel the move), `onError`,
and `step` for a controlled wizard. For a *linear* wizard without named
steps, back-navigation, or async validation gates, plain `useState` tracking a
step index is simpler — see `ink-app-architecture`.

## Scrolling a region — start with Ink itself

Ink 8 scrolls natively: put the content in a fixed-height
`<Box overflow="hidden">`, wrap it in a `flexShrink={0}` content box, and shift
the content with `contentOffsetY`. Measure both boxes with `useBoxMetrics` and
clamp the offset to `content.height - viewport.clientHeight`. That needs no
dependency, handles variable item heights, and is the right default for a log
or document view. `ink-layout` has the full, typechecked component
(`references/scrollable-view.md`).

Reach for a package when you want selection, scroll-into-view or true
virtualization on top of that:

| Package | Peer `ink` | What it gives you | Reach for it when |
| --- | --- | --- | --- |
| `ink-scroll-view` | `^7` | A generic scrollable viewport — auto-measures children, handles resize/dynamic content. You still own selection state. | You need to scroll arbitrary, non-list content (a long log or document view) and don't want to write the offset clamping yourself. |
| `ink-scroll-list` | `^7` | Built on `ink-scroll-view` — a **controlled** selectable list (`selectedIndex` prop you own) with auto-scroll-to-selection and alignment modes (`auto`/`top`/`bottom`/`center`) and an imperative ref API. | You need a scrollable, keyboard-navigable list and want scroll-into-view handled automatically. |
| `ink-virtual-list` | `^6 \|\| ^7` | Renders only the items visible in the viewport (true virtualization, not just scroll-clipping), with "N more" overflow indicators and an imperative ref (`scrollToIndex`). | The list can be very long (hundreds+ items) and per-item render cost matters, not just visual scrolling. |

`ink-scroll-list` and `ink-virtual-list` do not move on the arrow keys by
themselves (tested): you own the selection state and drive it from
`useInput`. With that wiring, `ink-virtual-list` scrolls the window to follow
the selection.

```tsx no-check
import React, {useState} from 'react';
import {Text, useInput} from 'ink';
import {VirtualList} from 'ink-virtual-list';

const items = Array.from({length: 1000}, (_, i) => `Item ${i}`);

const App = () => {
	const [selectedIndex, setSelectedIndex] = useState(0);

	useInput((_input, key) => {
		if (key.upArrow) setSelectedIndex((i) => Math.max(0, i - 1));
		if (key.downArrow) setSelectedIndex((i) => Math.min(items.length - 1, i + 1));
	});

	return (
		<VirtualList
			items={items}
			height={10}
			selectedIndex={selectedIndex}
			renderItem={({item, isSelected}) => <Text inverse={isSelected}>{item}</Text>}
		/>
	);
};
```

`renderItem` receives an object — `{item, index, isSelected}` — not the item
itself. Writing `renderItem={(item) => <Text>{item}</Text>}` passes that object
to `<Text>` as a child and renders nothing. There is no
`onSelectedIndexChange` prop; `height` defaults to `10` (or `"auto"` to fill the
terminal, with `reservedLines` for headers/footers).

Related skills: ink-layout, ink-input-handling, ink-focus-management, ink-app-architecture, ink-ecosystem-overview
