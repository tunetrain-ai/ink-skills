# The `key` object (`useInput`)

Passed as the second argument to the `useInput` handler: `(input, key) => {}`.
All properties are `boolean`, default `false`, unless noted.

## Arrows and navigation

| Property | Meaning |
| --- | --- |
| `leftArrow` / `rightArrow` / `upArrow` / `downArrow` | Arrow keys. |
| `pageUp` / `pageDown` | Page Up / Page Down. |
| `home` / `end` | Home / End. |
| `return` | Return (Enter). |
| `escape` | Escape. |
| `tab` | Tab. |
| `backspace` | Backspace. |
| `delete` | Delete. |

## Modifiers

| Property | Meaning |
| --- | --- |
| `ctrl` | Ctrl. |
| `shift` | Shift. |
| `meta` | [Meta key](https://en.wikipedia.org/wiki/Meta_key). |
| `super` | Cmd (macOS) / Win (Windows). **Requires the kitty keyboard protocol.** |
| `hyper` | Hyper key. **Requires the kitty keyboard protocol.** |
| `capsLock` | Caps Lock is active. **Requires the kitty keyboard protocol.** |
| `numLock` | Num Lock is active. **Requires the kitty keyboard protocol.** |

## Kitty-protocol-only

| Property | Type | Notes |
| --- | --- | --- |
| `eventType` | `'press' \| 'repeat' \| 'release'` | `undefined` without the protocol enabled — press/repeat/release are not distinguished at all otherwise. |

## Behavior changes once the kitty keyboard protocol is enabled

- **Non-printable keys produce empty `input`.** Navigation/editing keys keep
  their `key.*` boolean properties (`upArrow`, `delete`, …), but other
  functional keys — F1–F35, modifier-only presses, media keys, Caps Lock,
  Print Screen — are not individually exposed through `key` at all.
- **Ctrl+letter still works as expected.** The terminal sends the unshifted
  letter with `key.ctrl = true` — `Ctrl+C` is `input === 'c'`,
  `key.ctrl === true`, same as without the protocol.
- **`input` vs. actual typed text can diverge.** Without
  `reportAssociatedText`, `input` falls back to the primary unshifted key —
  composed/shifted text is not exposed. Enable `reportAssociatedText` (which
  implies `reportAllKeysAsEscapeCodes`) to get real composed text in `input`.
- **Previously-ambiguous keys become distinguishable**: `Ctrl+I` vs. `Tab`
  (`\x09` without the protocol — identical), `Shift+Enter` vs. `Enter`,
  `Escape` vs. `Ctrl+[`.

## Protocol flags (`kittyKeyboard.flags`)

Passed to `render(<App/>, {kittyKeyboard: {flags: [...]}})`. Default:
`['disambiguateEscapeCodes']`.

| Flag | Effect |
| --- | --- |
| `disambiguateEscapeCodes` | Disambiguate keys that otherwise share an escape sequence. |
| `reportEventTypes` | Populate `key.eventType` (press/repeat/release). |
| `reportAlternateKeys` | Terminal reports alternate key encodings; Ink accepts but doesn't expose them — without associated text, `useInput` falls back to the primary key. |
| `reportAllKeysAsEscapeCodes` | Report every key as an escape code, not just special ones. |
| `reportAssociatedText` | Report the actual composed/shifted text with key events. Automatically enables `reportAllKeysAsEscapeCodes`. |
