---
name: ink-markdown-and-code
description: Render Markdown text or syntax-highlighted source code in an Ink terminal UI, using ink-markdown and ink-syntax-highlight. Use when the user wants to display formatted Markdown or colorized code in their CLI.
metadata:
  ink: "7.1.1"
  category: ecosystem
---

# Markdown and code rendering

Both packages predate Ink 7 in their declared peer range (see
`ink-ecosystem-overview`) — no current alternative exists for either, so
verify against your installed version rather than avoiding them outright.

## `ink-markdown`

Wraps [`marked-terminal`](https://github.com/mikaelbr/marked-terminal) —
props are passed straight through as `marked-terminal` options.

```tsx no-check
import React from 'react';
import {render} from 'ink';
import Markdown from 'ink-markdown';

const text = `# Hello

This is **markdown** printed in the \`terminal\``;

render(<Markdown>{text}</Markdown>);
```

## `ink-syntax-highlight`

```tsx no-check
import React from 'react';
import {render} from 'ink';
import SyntaxHighlight from 'ink-syntax-highlight';

render(<SyntaxHighlight code="const hello = 'world';" language="javascript" />);
```

| Prop | Type | Notes |
| --- | --- | --- |
| `code` | `string` | Source to highlight. **Required.** |
| `language` | `string` | Any [highlight.js language](https://github.com/highlightjs/highlight.js/blob/master/SUPPORTED_LANGUAGES.md). Auto-detected if omitted — pass it explicitly when you know it, since auto-detection can guess wrong on short snippets. |
| `theme` | `Theme` | A [`cli-highlight`](https://github.com/felixfbecker/cli-highlight#themes) theme object, for custom colors. |

Related skills: ink-text-styling, ink-ecosystem-overview
