---
name: ink-markdown-and-code
description: Render Markdown text or syntax-highlighted source code in an Ink terminal UI — marked + marked-terminal for Markdown and cli-highlight for code, both turned into ANSI strings inside <Text> — and the status on Ink 8 of ink-markdown, @kud/ink-markdown and ink-syntax-highlight. Use when the user wants to display formatted Markdown or colorized code in their CLI.
metadata:
  ink: "8.0.0"
  category: ecosystem
---

# Markdown and code rendering

Ink passes ANSI escape sequences inside a string through `<Text>` intact and
measures them correctly, so the most reliable approach is to turn Markdown or
source code into an **ANSI string** with a plain library and render that. These
libraries have no Ink peer range to go stale, unlike the wrapper packages
below.

```sh
npm install marked@^15 marked-terminal cli-highlight
```

`marked-terminal@7` accepts `marked <16`, so pin `marked@^15`.
`marked-terminal` ships no types — add `@types/marked-terminal` for
TypeScript.

```tsx
import React, {useMemo} from 'react';
import {render, Box, Text, useWindowSize} from 'ink';
import {Marked, type MarkedExtension} from 'marked';
import {markedTerminal} from 'marked-terminal';
import {highlight} from 'cli-highlight';

const markdown = `# Hello

This is **markdown** printed in the \`terminal\`.

- one
- two`;

const source = "const hello: string = 'world';";

const Demo = () => {
	const {columns} = useWindowSize();
	const rendered = useMemo(() => {
		// @types/marked-terminal still types this as the pre-v7 TerminalRenderer;
		// marked-terminal@7 actually returns a MarkedExtension.
		const extension = markedTerminal({width: columns, reflowText: true}) as unknown as MarkedExtension;
		return new Marked(extension).parse(markdown, {async: false}).trimEnd();
	}, [columns]);

	return (
		<Box flexDirection="column">
			<Text>{rendered}</Text>
			<Text>{highlight(source, {language: 'typescript'})}</Text>
		</Box>
	);
};

render(<Demo />);
```

- **Width.** `reflowText` defaults to `false`, in which case `marked-terminal`
  leaves paragraphs unwrapped and Ink wraps them to the box. `width` (default
  `80`) only takes effect with `reflowText: true`, which re-wraps paragraphs
  and sizes horizontal rules to it — pass the terminal width from
  `useWindowSize()` so it follows resizes.
- **Colors.** The output contains color codes only when `chalk` detects color
  support (a TTY, or `FORCE_COLOR`). In tests, strip ANSI or set
  `FORCE_COLOR=0` (see `ink-testing`).
- **Streaming Markdown** (a growing LLM response): re-run the same `parse` on
  the accumulated text each time it changes; memoize on the text.
- `highlight()` takes any [highlight.js
  language](https://github.com/highlightjs/highlight.js/blob/master/SUPPORTED_LANGUAGES.md)
  as `language` and auto-detects when it is omitted — pass it when you know it,
  since auto-detection can guess wrong on short snippets. Its `theme` option is
  a [`cli-highlight` theme](https://github.com/felixfbecker/cli-highlight#themes).

## The wrapper packages, on Ink 8

| Package | Status | Notes |
| --- | --- | --- |
| `ink-markdown` | **cannot be loaded** | CommonJS build that `require()`s Ink: `ERR_REQUIRE_ASYNC_MODULE`. It only wrapped `marked-terminal`, which the recipe above uses directly. |
| `@kud/ink-markdown` | peer `7.x` | Imports on Ink 8 but rendering was not exercised. An actively developed alternative to watch. |
| `ink-syntax-highlight` | peer `ink ^5.1.0`, `react ^18.3.1` | Installs only with `--legacy-peer-deps`, but its first frame renders on Ink 8 + React 19. Calling `cli-highlight` directly (above) avoids the conflict. |

If you do use `ink-syntax-highlight`:

```tsx no-check
import React from 'react';
import {render} from 'ink';
import SyntaxHighlight from 'ink-syntax-highlight';

render(<SyntaxHighlight code="const hello = 'world';" language="javascript" />);
```

| Prop | Type | Notes |
| --- | --- | --- |
| `code` | `string` | Source to highlight. **Required.** |
| `language` | `string` | Any highlight.js language; auto-detected if omitted. |
| `theme` | `Theme` | A `cli-highlight` theme object, for custom colors. |

Related skills: ink-text-styling, ink-terminal-io, ink-testing, ink-ecosystem-overview
