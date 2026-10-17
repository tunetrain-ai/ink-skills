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
8 unless you pass `--legacy-peer-deps` (or add an `overrides` entry). All five
render on Ink 8.

## `ink-tab` — tabs

Peer `^4 || ^5 || ^6`. Its readme has no prop list: it links to [the ink-tab
docs](https://jdeniau.gitbook.io/ink-tab/), and the installed package ships its
docs pages under `docs/` (`docs/api/tabs.md` lists the `Tabs` props).

```tsx
import React from 'react';
import {render} from 'ink';
import {Tab, Tabs} from 'ink-tab';

const App = () => (
	<Tabs onChange={(name) => console.log(name)}>
		<Tab name="overview">Overview</Tab>
		<Tab name="logs">Logs</Tab>
	</Tabs>
);

render(<App />);
```

It renders a row like `1. Overview | 2. Logs`. The Right and Left arrows (Down
and Up when `flexDirection` is `"column"`) and Tab and Shift+Tab move to the
next and previous tab, wrapping around at the ends; Alt with a digit (`1` to
`9`) jumps to that tab, and a bare digit does nothing. `keyMap` changes this:
`useNumbers: false` and `useTab: false` turn the digit and Tab shortcuts off,
and `previous` and `next` (arrays of key names such as `['h']`) replace the
arrows. `Tabs` also takes `flexDirection` and `width`. `onChange`
fires once on mount with the first tab's `name`, then on each switch. The
`Tab` children are only the label — it does not render tab *contents*, so
switch on the `name` from `onChange` yourself. `children` is typed as an array,
so give it at least two `<Tab>` elements.

## `ink-stepper` — step wizards

Peer `^6.6.0 || ^7.0.0`.

```tsx
import React from 'react';
import {stat} from 'node:fs/promises';
import {render, Text, useInput} from 'ink';
import {Stepper, Step} from 'ink-stepper';

const ThemeSelector = () => <Text>Pick a theme</Text>;

const PathInput = ({onConfirm, onBack}: {onConfirm: () => void; onBack: () => void}) => {
	useInput((input) => {
		if (input === 'c') onConfirm();
		if (input === 'b') onBack();
	});

	return <Text>c to confirm, b to go back</Text>;
};

const pathIsValid = async () => (await stat('.')).isDirectory();

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

render(<App />);
```

By default Enter advances and Escape goes back (on the first step it calls
`onCancel`); `keyboardNav={false}` turns both off.

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
or document view. `ink-layout` has the full component
(`references/scrollable-view.md`).

Reach for a package when you want selection, scroll-into-view or true
virtualization on top of that:

| Package | Peer `ink` | What it gives you | Reach for it when |
| --- | --- | --- | --- |
| `ink-scroll-view` | `^7` | A generic scrollable viewport — auto-measures children, handles resize/dynamic content. You still own selection state. | You need to scroll arbitrary, non-list content (a long log or document view) and don't want to write the offset clamping yourself. |
| `ink-scroll-list` | `^7` | Built on `ink-scroll-view` — a **controlled** selectable list (`selectedIndex` prop you own) with auto-scroll-to-selection and alignment modes (`scrollAlignment`: `auto`/`top`/`bottom`/`center`) and an imperative ref API. | You need a scrollable, keyboard-navigable list and want scroll-into-view handled automatically. |
| `ink-virtual-list` | `^6 \|\| ^7` | Renders only the items visible in the viewport (true virtualization, not just scroll-clipping), with "N more" overflow indicators and an imperative ref (`scrollToIndex`, which keeps the selected item in view). | The list can be very long (hundreds+ items) and per-item render cost matters, not just visual scrolling. |

`ink-scroll-view`, `ink-scroll-list` and `ink-virtual-list` do not move on the
arrow keys by themselves: you own the selection state (for `ink-scroll-view`,
the scroll offset) and drive it from `useInput`. With that wiring,
`ink-scroll-list` and `ink-virtual-list` scroll the window to follow the
selection.

```tsx
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
to `<Text>` as a child, which throws `Objects are not valid as a React child`.
There is no `onSelectedIndexChange` prop; `height` defaults to `10` (or `"auto"`
to fill the terminal, with `reservedLines` for headers/footers).

Related skills: ink-layout, ink-input-handling, ink-focus-management, ink-app-architecture, ink-ecosystem-overview
