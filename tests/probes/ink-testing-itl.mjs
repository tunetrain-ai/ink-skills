// Renders through ink-testing-library in whatever environment the parent set up (CI, FORCE_COLOR,
// the host terminal) and prints what it saw as one JSON line.
import React from 'react';
import { Text, renderToString, useWindowSize } from 'ink';
import { render } from 'ink-testing-library';

const h = React.createElement;

// three frames, as a component that updates twice would produce them
const updated = render(h(Text, null, 'frame 1'));
updated.rerender(h(Text, null, 'frame 2'));
updated.rerender(h(Text, null, 'frame 3'));

const green = render(h(Text, { color: 'green' }, 'ok'));

let size;
const Size = () => {
  size = useWindowSize();
  return h(Text, null, `${size.columns}x${size.rows}`);
};
const sized = render(h(Size));

// a layout that reads the rows from the host terminal, and one that is given them
const Rows = ({ rows }) => {
  const window = useWindowSize();
  return h(Text, null, `rows=${rows ?? window.rows}`);
};

console.log(
  JSON.stringify({
    hello: render(h(Text, null, 'Hello World')).lastFrame(),
    frames: updated.frames,
    greenFrame: green.lastFrame(),
    greenFrames: green.frames,
    greenRendered: renderToString(h(Text, { color: 'green' }, 'ok')),
    size,
    sizedFrame: sized.lastFrame(),
    stdout: { columns: sized.stdout.columns, hasRows: 'rows' in sized.stdout, rows: sized.stdout.rows ?? null, isTTY: sized.stdout.isTTY ?? null },
    hostRows: process.stdout.rows ?? null,
    rowsFrame: render(h(Rows)).lastFrame(),
    pinnedFrame: render(h(Rows, { rows: 10 })).lastFrame(),
  }),
);
process.exit(0);
