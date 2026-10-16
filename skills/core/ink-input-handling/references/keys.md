# The `key` object (`useInput`)

Passed as the second argument to the `useInput` handler: `(input, key) => {}`.
All properties are `boolean` and default to `false`, except `eventType`, which is
`undefined` unless the sequence is kitty-style (see the table below). The
kitty-only modifiers (`super`, `hyper`, `capsLock`, `numLock`) are `false` unless
such a sequence sets them.

Unrecognized control sequences (mouse reports, focus in/out, cursor-position
reports) are dropped before `useInput` and never reach the handler.

## Arrows and navigation

| Property | Meaning |
| --- | --- |
| `leftArrow` / `rightArrow` / `upArrow` / `downArrow` | Arrow keys. |
| `pageUp` / `pageDown` | Page Up / Page Down. |
| `home` / `end` | Home / End. |
| `return` | Return (Enter), including keypad Enter. |
| `escape` | Escape. |
| `tab` | Tab. |
| `backspace` | Backspace. |
| `delete` | Delete. |

## Modifiers

| Property | Meaning |
| --- | --- |
| `ctrl` | Ctrl. |
| `shift` | Shift. |
| `meta` | Alt/Meta: set for an Escape-prefixed key (`ESC a`) and for the Alt (bit `2`) and Meta (bit `32`) modifiers of a kitty-style sequence. |
| `super` | The Super modifier (bit `8`), set by kitty-style sequences only: `ESC [ 97 ; 9 u` is `a` with `super`. |
| `hyper` | The Hyper modifier (bit `16`), set by kitty-style sequences only: `ESC [ 97 ; 17 u`. |
| `capsLock` | The Caps Lock bit (`64`), set by kitty-style sequences only: `ESC [ 97 ; 65 u`. |
| `numLock` | The Num Lock bit (`128`), set by kitty-style sequences only: `ESC [ 97 ; 129 u`. |

## Event type

| Property | Type | Notes |
| --- | --- | --- |
| `eventType` | `'press' \| 'repeat' \| 'release'` | Read from the event-type field of kitty-style sequences (`ESC [ 97 ; 1 : 3 u` is a release); a kitty-style sequence without that field is a press, as are `ESC [ 3 ~` (Delete) and `ESC [ 1 ; 5 A` (Ctrl+Up). `undefined` for ordinary text and for the plain arrow, Home, End, Return, Tab, Escape and Backspace sequences. |

## Behavior changes with kitty-style key reports

- **Non-printable keys produce empty `input`.** Arrow, Page Up/Down, Home/End,
  Delete, Backspace, Tab and Escape keep their `key.*` boolean properties
  (`upArrow`, `delete`, …), but other functional keys — Insert, F1–F35,
  modifier-only presses, media keys, Caps Lock, Print Screen — are not
  individually exposed through `key` at all.
- **Ctrl+letter still works as expected.** The sequence carries the unshifted
  letter and the Ctrl modifier (`ESC [ 99 ; 5 u`), so `Ctrl+C` is
  `input === 'c'`, `key.ctrl === true`, the same as the plain `\x03` byte, as long
  as `exitOnCtrlC` is `false` (by default Ink exits before the handler runs).
- **`input` vs. actual typed text can diverge.** Without `reportAssociatedText`,
  `input` falls back to the unshifted key: `ESC [ 97 ; 2 u` (Shift+A) gives
  `input === 'a'` with `key.shift`. With `reportAssociatedText` (which
  automatically enables `reportAllKeysAsEscapeCodes`) the sequence carries the
  real text: `ESC [ 97 ; 2 ; 65 u` gives `input === 'A'`.
- **Previously-ambiguous keys become distinguishable**: `Ctrl+I`
  (`ESC [ 105 ; 5 u`) vs. `Tab` (`ESC [ 9 u`), `Shift+Enter` (`ESC [ 13 ; 2 u`)
  vs. `Enter` (`ESC [ 13 u`), `Escape` (`ESC [ 27 u`) vs. `Ctrl+[`
  (`ESC [ 91 ; 5 u`). The plain bytes `\x09`, `\r` and `\x1b` can only be read as
  Tab, Enter and Escape.

## Protocol flags (`kittyKeyboard.flags`)

Passed to `render(<App/>, {kittyKeyboard: {flags: [...]}})`. Default:
`['disambiguateEscapeCodes']`.

| Flag | Effect |
| --- | --- |
| `disambiguateEscapeCodes` | Sets bit `1`: asks the terminal to disambiguate keys that otherwise share an escape sequence. |
| `reportEventTypes` | Sets bit `2`: asks for press/repeat/release, which Ink exposes as `key.eventType`. |
| `reportAlternateKeys` | Sets bit `4`: asks for alternate key encodings; Ink accepts but doesn't expose them — without associated text, `useInput` falls back to the primary key. |
| `reportAllKeysAsEscapeCodes` | Sets bit `8`: asks for every key as an escape code, not just special ones. |
| `reportAssociatedText` | Sets bit `16`: asks for the actual composed/shifted text with key events, and sets bit `8` as well. |
