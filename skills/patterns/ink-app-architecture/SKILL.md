---
name: ink-app-architecture
description: Structure a real Ink CLI beyond a single component — multi-screen navigation with React Router's MemoryRouter, parsing command-line arguments and flags, and setting the process exit code correctly. Use when starting a nontrivial Ink app or asking how to add screens/routes/flags to one.
metadata:
  ink: "7.1.1"
  category: patterns
---

# App architecture

## Multi-screen navigation

Ink has no router of its own — screens are just conditional rendering, same
as any React app. For anything beyond a couple of `if`/state-driven screens,
[React Router](https://reactrouter.com)'s `MemoryRouter` is the standard
choice: unlike `BrowserRouter`, it keeps the navigation stack in memory
instead of relying on a browser history API, which is exactly what a
terminal needs.

```tsx no-check
import React from 'react';
import {MemoryRouter, Routes, Route, useNavigate} from 'react-router';
import {render, useInput, Text} from 'ink';

function Home() {
	const navigate = useNavigate();
	useInput((input, key) => {
		if (key.return) navigate('/about');
	});
	return <Text>Home. Press Enter to go to About.</Text>;
}

function About() {
	const navigate = useNavigate();
	useInput((input, key) => {
		if (key.return) navigate('/');
	});
	return <Text>About. Press Enter to go back Home.</Text>;
}

function App() {
	return (
		<MemoryRouter>
			<Routes>
				<Route path="/" element={<Home />} />
				<Route path="/about" element={<About />} />
			</Routes>
		</MemoryRouter>
	);
}

render(<App />);
```

Three things that don't carry over from web routing:

- **No `<Link>`** — it renders an `<a>` tag, which means nothing in a
  terminal. Navigate with `useNavigate()` everywhere.
- `MemoryRouter` starts at `"/"` by default; pass `initialEntries` to start
  elsewhere (e.g. resuming at a route based on a CLI flag).
- Routes aren't URLs — they're just an abstraction for conditional
  rendering, a state machine of screens with the ergonomics of routing.

Don't reach for a router at all for a linear wizard (step 1 → step 2 → done)
— plain `useState` tracking a `step` value is simpler and there's no
navigation stack to manage. Reach for `MemoryRouter` when screens can be
revisited, deep-linked via `initialEntries`, or nested.

## Parsing arguments and flags

Ink renders UI; it has no opinion on argument parsing. The common pairing is
[`meow`](https://github.com/sindresorhus/meow) — lightweight, built for
exactly this, and what `create-ink-app`-scaffolded projects use by default —
or Node's built-in `util.parseArgs` for a dependency-free CLI. Parse args
*before* calling `render()`, then pass the results in as props:

```tsx no-check
const cli = meow(`
	Usage
	  $ my-cli <input>

	Options
	  --name  Your name
`, {
	importMeta: import.meta,
	flags: {name: {type: 'string'}},
});

render(<App name={cli.flags.name} input={cli.input} />);
```

## Exit codes

Ink's `exit()` (from `useApp()`) controls when `waitUntilExit()` settles and
whether it resolves or rejects — it does **not** by itself set the process's
exit code. For a CLI that needs a specific exit code on failure, set
`process.exitCode` before exiting (preferred over `process.exit(code)`,
which terminates immediately and can cut off pending stdout writes):

```tsx no-check
import {useApp} from 'ink';

const {exit} = useApp();

const onFatalError = (error: Error) => {
	process.exitCode = 1;
	exit(error); // rejects waitUntilExit() with `error`
};
```

At the call site:

```tsx no-check
const {waitUntilExit} = render(<App />);

try {
	await waitUntilExit();
} catch (error) {
	console.error(error);
	process.exitCode = 1;
}
```

Related skills: ink-getting-started, ink-rendering-and-lifecycle, ink-fullscreen-layouts
