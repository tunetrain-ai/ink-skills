---
name: inkjs-ui-feedback
description: "@inkjs/ui feedback components: Spinner, ProgressBar, Badge, StatusMessage, Alert — for loading states, progress, tags, and success/error/warning/info messages. Use whenever the user wants a spinner, progress bar, status tag, or colored alert/message box."
metadata:
  ink: "8.0.0"
  category: ecosystem
---

# `@inkjs/ui` feedback components

## `Spinner`

```tsx
import React from 'react';
import {Spinner} from '@inkjs/ui';

const Example = () => <Spinner label="Loading" />;
```

| Prop | Type | Notes |
| --- | --- | --- |
| `label` | `string` | Shown next to the spinner glyph. |
| `type` | spinner name | From [`cli-spinners`](https://github.com/sindresorhus/cli-spinners) — default `'dots'`. |

For a fully custom spinner (different timing model, `time`/`delta`-based
animation instead of a fixed frame set), drop down to Ink's own
`useAnimation` hook — see `ink-animation-and-performance` — rather than
trying to configure this component beyond its `type` choices.

## `ProgressBar`

```tsx
import React from 'react';
import {ProgressBar} from '@inkjs/ui';

const Example = () => <ProgressBar value={50} />;
```

One prop: `value` (`number`, `0`–`100`; **required** in the types). It's a controlled,
presentational component only — track progress in your own state and pass it
in; `ProgressBar` doesn't animate or advance on its own.

## `Badge`

A small inline tag.

```tsx
import React from 'react';
import {Badge} from '@inkjs/ui';

const Example = () => <Badge color="green">Passing</Badge>;
```

`children: ReactNode` (required), `color?: TextProps['color']` (default
`'magenta'`) — accepts the same color values as Ink's `<Text color>`.

## `StatusMessage`

A single-line message prefixed with a variant-colored symbol.

```tsx
import React from 'react';
import {StatusMessage} from '@inkjs/ui';

const Example = () => <StatusMessage variant="success">Deployed successfully</StatusMessage>;
```

`variant: 'info' | 'success' | 'error' | 'warning'` is **required** — there's
no default, since the variant is the entire point of the component.

## `Alert`

A boxed, multi-line message — reach for `Alert` over `StatusMessage` when
the content is more than one line or needs a title.

```tsx
import React from 'react';
import {Alert} from '@inkjs/ui';

const Example = () => (
	<Alert variant="error" title="Deployment failed">
		Check the build logs for details.
	</Alert>
);
```

`variant` is the same union as `StatusMessage` (required); `title?: string`
is optional.

## Choosing between them

| Need | Component |
| --- | --- |
| "still working" indicator | `Spinner` |
| Quantified progress (0–100%) | `ProgressBar` |
| A short inline tag/label | `Badge` |
| One line of pass/fail/warn/info feedback | `StatusMessage` |
| A boxed, possibly multi-line message, optionally titled | `Alert` |
| A list of completed steps that shouldn't re-render | `<Static>` (`ink-static-output`) or `ink-task-runners`' `ink-task-list` |

Related skills: ink-animation-and-performance, ink-static-output, ink-task-runners
