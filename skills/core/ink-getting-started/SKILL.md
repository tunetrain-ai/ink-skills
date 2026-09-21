---
name: ink-getting-started
description: Scaffold a new Ink project — create-ink-app, TypeScript/ESM setup, the package.json bin field for a CLI entry point, and the Node.js process model an Ink app runs under. Use when starting a new Ink CLI, adding Ink to an existing project, or the app exits immediately instead of rendering.
metadata:
  ink: "7.1.1"
  category: core
---

# Getting started with Ink

## Scaffold a new project

The fastest path is [`create-ink-app`](https://github.com/vadimdemedes/create-ink-app),
which sets up TypeScript, ESM, and a `bin` entry in one step:

```sh
npx create-ink-app my-ink-cli
# or, explicitly TypeScript (recommended — ink's own types require react >=19.2.0)
npx create-ink-app --typescript my-ink-cli
```

## Minimal hand-written setup

Ink components are ordinary React. With a TypeScript + ESM toolchain (`tsx`, `esbuild`,
or `tsc` compiled ahead of time) no Babel config is needed — `tsconfig.json` just needs
`"jsx": "react-jsx"`.

```tsx
#!/usr/bin/env node
import React from 'react';
import {render, Text} from 'ink';

const Demo = () => <Text>Hello World</Text>;

render(<Demo />);
```

Run it directly with a TS-aware runtime (`npx tsx source.tsx`) during development, or
compile ahead of time for distribution.

<details>
<summary>Manual JavaScript + Babel setup (no TypeScript)</summary>

```sh
npm install --save-dev @babel/preset-react
```

```json
{"presets": ["@babel/preset-react"]}
```

Save as `babel.config.json`, then transpile and run:

```sh
npx babel source.js -o cli.js
node cli.js
```

</details>

## Wiring up a CLI binary

For a publishable CLI, point `package.json`'s `bin` field at the compiled entry and keep
the shebang line as the very first line of the **compiled** output (some bundlers strip
it — verify after building):

```json
{
  "name": "my-ink-cli",
  "bin": "dist/cli.js",
  "type": "module"
}
```

## The process model

An Ink app is a plain Node.js process — it only stays alive while there's active work in
the event loop (timers, pending promises, `useInput` listening on stdin). **A component
tree with no async work renders once and exits immediately.** This trips people up
constantly: if your CLI prints its UI and then quits before you can interact with it,
you're missing something that keeps the event loop alive — typically `useInput` (see
`ink-input-handling`) or an unresolved promise.

See `ink-rendering-and-lifecycle` for `render()`'s full option set, `waitUntilExit()`, and
how to exit deliberately instead of relying on the process just running out of work.

## Flexbox mental model

Every Ink element is a Yoga flexbox container — think of every `<Box>` as a browser
`<div>` with `display: flex` already applied. There is no non-flex layout mode. All text
must be wrapped in `<Text>`; raw strings as children of `<Box>` are not rendered as text.
See `ink-layout` for the full flexbox API.

Related skills: ink-rendering-and-lifecycle, ink-layout, ink-input-handling
