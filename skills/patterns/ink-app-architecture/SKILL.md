---
name: ink-app-architecture
description: Structure a real Ink CLI beyond a single component — multi-screen navigation with React Router's MemoryRouter, parsing command-line arguments and flags, and setting the process exit code correctly. Use when starting a nontrivial Ink app or asking how to add screens/routes/flags to one.
metadata:
  ink: "8.0.0"
  category: patterns
---

# App architecture

## Multi-screen navigation

Ink has no router of its own — screens are just conditional rendering, same
as any React app. For anything beyond a couple of `if`/state-driven screens, use
[React Router](https://reactrouter.com)'s `MemoryRouter`: it keeps the
navigation stack in memory, while `BrowserRouter` needs a browser and throws
`document is not defined` in Node.

```tsx
import React from 'react';
import {MemoryRouter, Routes, Route, useNavigate} from 'react-router';
import {render, useInput, Text} from 'ink';

function Home() {
	const navigate = useNavigate();
	useInput((_input, key) => {
		if (key.return) navigate('/about');
	});
	return <Text>Home. Press Enter to go to About.</Text>;
}

function About() {
	const navigate = useNavigate();
	useInput((_input, key) => {
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

- **No `<Link>`** — it renders an `<a>` element that Ink does not draw: text
  inside it throws, and a `<Text>` inside it produces no output. Navigate with
  `useNavigate()` everywhere.
- `MemoryRouter` starts at `"/"` by default; pass `initialEntries` to start
  elsewhere (e.g. resuming at a route based on a CLI flag).
- Routes aren't URLs: `<Routes>` renders only the element of the route that
  matches the in-memory location, and the screen you leave is unmounted.

A linear wizard (step 1 → step 2 → done) doesn't need a router: a `useState`
holding a `step` value shows one screen at a time. `MemoryRouter` adds a history
stack (`navigate(-1)` goes back), deep links via `initialEntries`, and nested
routes (a parent route renders its children through `<Outlet />`).

## Parsing arguments and flags

Ink renders UI; it has no opinion on argument parsing. `create-ink-app`
scaffolds its projects with [`meow`](https://github.com/sindresorhus/meow), a
CLI app helper, for arguments and flags; Node's built-in `util.parseArgs` does
the same job without a dependency. Parse args *before* calling `render()`, then
pass the results in as props:

```tsx
import React from 'react';
import meow from 'meow';
import {render} from 'ink';
import App from './app.js';

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
`process.exitCode` before exiting. Unlike `process.exit(code)`, which
terminates immediately, it lets the process finish what is still scheduled:

```tsx
import React from 'react';
import {Text, useApp, useInput} from 'ink';

// Hooks must run inside a component or another hook.
const useFatalError = () => {
	const {exit} = useApp();

	return (error: Error) => {
		process.exitCode = 1;
		exit(error); // rejects waitUntilExit() with `error`
	};
};

export const App = () => {
	const onFatalError = useFatalError();

	useInput((input) => {
		if (input === 'x') {
			onFatalError(new Error('Something went wrong'));
		}
	});

	return <Text>Press x to fail</Text>;
};
```

At the call site:

```tsx
import React from 'react';
import {render, Text} from 'ink';

// `App` stands in for your root component.
const App = () => <Text>Hello</Text>;

const {waitUntilExit} = render(<App />);

try {
	await waitUntilExit();
} catch (error) {
	console.error(error);
	process.exitCode = 1;
}
```

Related skills: ink-getting-started, ink-rendering-and-lifecycle, ink-fullscreen-layouts
