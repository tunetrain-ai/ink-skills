// The glyphs ink-task-list draws, in whatever TERM the parent set up (the choice is made once, when
// the package is imported). One line of output per state, plus an expanded task. argv[2] and argv[3]
// are the labels of the success and pending lines.
import React from 'react';
import { renderToString } from 'ink';
import { Task, TaskList } from 'ink-task-list';

const h = React.createElement;
const [successLabel = 'x', pendingLabel = 'x'] = process.argv.slice(2);
const spinner = { interval: 1000, frames: ['*'] };
const draw = (props) => renderToString(h(TaskList, null, h(Task, { label: 'x', ...props })), { columns: 40 }).split('\n')[0];

console.log(
  JSON.stringify({
    pending: draw({ state: 'pending', label: pendingLabel }),
    loading: draw({ state: 'loading', spinner }),
    success: draw({ state: 'success', label: successLabel }),
    warning: draw({ state: 'warning' }),
    error: draw({ state: 'error' }),
    expanded: draw({ isExpanded: true }),
    output: renderToString(h(TaskList, null, h(Task, { label: 'x', output: 'detail' })), { columns: 40 }).split('\n')[1],
  }),
);
