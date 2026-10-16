---
name: ink
description: Router for building terminal UIs (CLIs, TUIs) with Ink, the React renderer for command-line apps built on Yoga flexbox. Use when the user is building, styling, or debugging a Node.js/TypeScript command-line interface with React — mentions Ink, <Box>/<Text>, a TUI, an interactive CLI, or terminal rendering. Points to focused sub-skills for layout, components, hooks, testing, and the component ecosystem (@inkjs/ui, ink-spinner, ink-form, etc.) rather than answering from general React knowledge.
metadata:
  ink: "8.0.0"
  category: router
---

# Ink

[Ink](https://github.com/vadimdemedes/ink) lets you build command-line apps using React
components instead of imperative `console.log` calls. Every element is a Yoga flexbox
container; all text must be wrapped in `<Text>`. This skill is a **router** — it does not
itself contain component APIs or code. Its job is to identify which sub-skill has the
answer and defer to it.

## Routing policy

- **Always route before answering an Ink-specific question.** Even a question that looks
  answerable from general React knowledge (e.g. "how do I center content?") maps to an
  Ink-specific mechanism (Yoga flexbox via `<Box>`, not CSS) — load the matching sub-skill
  rather than answering from memory, so the props and defaults you use are correct for
  Ink 8.
- **One sub-skill is usually enough.** Most tasks land in a single row below. Only load a
  second skill when the task genuinely spans two concerns (e.g. a focusable, animated
  list touches both `ink-focus-management` and `ink-animation-and-performance`).
- **Don't route for plain React/JavaScript questions** that happen to occur inside an Ink
  project (e.g. "how do I use `useReducer`?") — those aren't Ink-specific, answer directly.
- **New project?** Start at `ink-getting-started` regardless of the specific question —
  it covers the scaffold, TypeScript/ESM setup, and `package.json` `bin` wiring that
  almost every other skill assumes is already in place.
- **Recommending a third-party component?** Always load `ink-ecosystem-overview` first
  and check its compatibility table. A peer range does not tell you whether a package works
  on Ink 8: several popular ones cannot be loaded at all (`ink-table`, `ink-markdown`,
  `ink-progress-bar`, `ink-divider`) even though their ranges look permissive, while others
  declare ranges that exclude Ink 8 yet render on it (`ink-tab`, `ink-scroll-view`).

## Routing table

### Core

| Skill | Use when the task involves… |
| --- | --- |
| `ink-getting-started` | scaffolding a new Ink project, `create-ink-app`, TypeScript/ESM/Babel setup, the `bin` field |
| `ink-rendering-and-lifecycle` | `render()` options, the returned `Instance`, `renderToString`, exiting/`waitUntilExit`, `suspendTerminal` (hand the terminal to `$EDITOR`/`less`), CI rendering behavior |
| `ink-layout` | `<Box>`, flexbox props (`flexDirection`, `gap`, `alignItems`…), dimensions, `measureElement`, `useBoxMetrics`, `contentOffsetX`/`contentOffsetY` scroll views, `clientWidth`/`clientHeight` |
| `ink-text-styling` | `<Text>` styling (color, bold, wrap), `<Newline>`, `<Spacer>`, `<Transform>` |
| `ink-borders-and-backgrounds` | `borderStyle`/`borderColor` (incl. per-edge), box and border backgrounds |
| `ink-input-handling` | `useInput`, `usePaste`, raw mode, the kitty keyboard protocol |
| `ink-focus-management` | `useFocus`, `useFocusManager`, tab order, focus ids |
| `ink-terminal-io` | `useStdout`, `useStderr`, `useStdin`, `useWindowSize`, `useCursor`; migrating `useStdout().stdout.columns/rows/isTTY` (no longer type-checks) → `useWindowSize` |
| `ink-static-output` | `<Static>`, logging permanent output above a live UI |
| `ink-animation-and-performance` | `useAnimation`, `maxFps`, `incrementalRendering`, `concurrent` mode, `useTransition`/`useDeferredValue` |
| `ink-accessibility` | `useIsScreenReaderEnabled`, `aria-label`/`aria-hidden`/`aria-role`/`aria-state` |

### Patterns

| Skill | Use when the task involves… |
| --- | --- |
| `ink-app-architecture` | structuring a multi-screen app, routing (`MemoryRouter`), argument parsing, exit codes |
| `ink-fullscreen-layouts` | `alternateScreen`, full-height/responsive layouts, split panes |
| `ink-async-and-suspense` | `Suspense`, async data fetching, subprocess output, cleanup on unmount |
| `ink-testing` | `ink-testing-library`, asserting on frames, simulating stdin, `CI=false` |

### Ecosystem

| Skill | Use when the task involves… |
| --- | --- |
| `ink-ecosystem-overview` | choosing a third-party package, checking Ink 8/React 19.3 compatibility |
| `inkjs-ui-inputs` | `@inkjs/ui` `TextInput`, `EmailInput`, `PasswordInput`, `ConfirmInput`, `Select`, `MultiSelect` |
| `inkjs-ui-feedback` | `@inkjs/ui` `Spinner`, `ProgressBar`, `Badge`, `StatusMessage`, `Alert` |
| `inkjs-ui-lists` | `@inkjs/ui` `UnorderedList`, `OrderedList` |
| `inkjs-ui-theming` | `@inkjs/ui` `ThemeProvider`, `extendTheme`, per-component style overrides |
| `ink-tables` | rendering tabular data (`@alcalzone/ink-table` or a hand-rolled `<Box>` table) |
| `ink-charts` | sparklines/bar/line charts (`@pppp606/ink-chart`) or a custom chart |
| `ink-markdown-and-code` | rendering Markdown or syntax-highlighted code in the terminal (`marked-terminal`, `cli-highlight`) |
| `ink-decoration` | links, gradients, big/ASCII text, dividers, titled boxes, images |
| `ink-forms` | multi-field forms (`ink-form`), filterable/searchable selects |
| `ink-navigation` | tabs, step wizards, scrollable/virtualized lists |
| `ink-task-runners` | task-list UIs, spawning child processes |

## Compatibility

Every sub-skill's frontmatter carries `metadata.ink` pinning the Ink version its examples
were verified against (currently `8.0.0`, peer `react >=19.3.0` / `@types/react >=19.3.0`,
Node `>=22`). If the user's `package.json` pins an older Ink major, say so before applying
an example — flexbox defaults and several hook signatures changed across majors (see
`ink-layout` and `ink-input-handling` for the specifics that matter most). Ink 8 breaking
changes to watch for: `<Box>` `minWidth`/`maxWidth` are number-only, `render()` streams are
typed `NodeJS.WritableStream`/`NodeJS.ReadableStream`, and `useInput` drops unrecognized
control sequences.

Related skills: ink-getting-started, ink-ecosystem-overview
