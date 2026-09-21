---
name: ink-navigation
description: Tabs (ink-tab), step wizards (ink-stepper), and scrollable/virtualized lists (ink-scroll-view, ink-scroll-list, ink-virtual-list) for Ink. Use when the user wants tabbed navigation, a multi-step wizard flow, or a scrollable/long list that shouldn't render every item at once.
metadata:
  ink: "7.1.1"
  category: ecosystem
---

# Navigation components

## `ink-tab` — tabs

Its own documentation lives on a separate docs site (not in its GitHub
readme) — check [the ink-tab docs](https://jdeniau.gitbook.io/ink-tab/) for
current props before using it. Its peer range (`^4 || ^5 || ^6`) doesn't
yet explicitly list `^7`, so verify it against your installed Ink version
first (see `ink-ecosystem-overview`).

## `ink-stepper` — step wizards

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
navigation controls (`goNext`, `goBack`); `canProceed` gates advancing past
a step until a condition (e.g. validation) is met. Current for Ink 7/React
19. For a *linear* wizard without named steps, back-navigation, or async
validation gates, plain `useState` tracking a step index is simpler — see
`ink-app-architecture`.

## Scrolling and virtualized lists

Three packages solve overlapping problems — the practical difference is
where each one draws the line between "controlled by you" and "handled for
you":

| Package | What it gives you | Reach for it when |
| --- | --- | --- |
| `ink-scroll-view` | A generic scrollable viewport — auto-measures children, handles resize/dynamic content. You still own selection state. | You need to scroll arbitrary, non-list content (e.g. a long log or document view). |
| `ink-scroll-list` | Built on `ink-scroll-view` — a **controlled** selectable list (`selectedIndex` prop you own) with auto-scroll-to-selection and alignment modes (`auto`/`top`/`bottom`/`center`). | You need a scrollable, keyboard-navigable list and want scroll-into-view handled automatically. |
| `ink-virtual-list` | Renders only the items visible in the viewport (true virtualization, not just scroll-clipping) — auto-scrolling, resize-aware, imperative ref API. | The list can be very long (hundreds+ items) and per-item render cost matters, not just visual scrolling. |

```tsx no-check
import React, {useState} from 'react';
import {VirtualList} from 'ink-virtual-list';
import {Text} from 'ink';

const items = Array.from({length: 1000}, (_, i) => `Item ${i}`);

const App = () => {
	const [selectedIndex, setSelectedIndex] = useState(0);

	return (
		<VirtualList
			items={items}
			selectedIndex={selectedIndex}
			onSelectedIndexChange={setSelectedIndex}
			renderItem={(item) => <Text>{item}</Text>}
		/>
	);
};
```

All three are current for Ink 7 (`ink-scroll-view`/`ink-scroll-list` require
Ink `^7` and Node `>=22` specifically; `ink-virtual-list` also supports Ink
`^6`). See `ink-layout`'s own windowing recipe
(`references/scrollable-view.md`) for the underlying technique if you'd
rather not add a dependency for a single simple list.

Related skills: ink-layout, ink-focus-management, ink-app-architecture, ink-ecosystem-overview
