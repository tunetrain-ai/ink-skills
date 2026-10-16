// openForm(): renders the form itself and returns a promise of the submitted value. A one-field
// form on a fake TTY; the parent types the keys (Down to the field, Down to the submit button,
// Enter) after the line READY. Prints one JSON line: whether the call returned a promise
// at once, and what it resolved with.
import { writeSync } from 'node:fs';
import { openForm } from 'ink-form';

const result = openForm({
  form: { title: 'Prompt', sections: [{ title: 'Only section', fields: [{ type: 'string', name: 'answer', label: 'Answer', initialValue: 'yes' }] }] },
});
const isPromise = result instanceof Promise;
writeSync(1, 'READY\n');
const value = await result;
writeSync(1, `\n${JSON.stringify({ isPromise, value })}\n`);
process.exit(0);
