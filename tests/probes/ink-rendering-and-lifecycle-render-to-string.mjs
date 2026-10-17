// renderToString inside a process whose stdout has a (faked) terminal size: what does useWindowSize report there,
// and what does the columns option do? PROBE_COLUMNS lists the values to try; PROBE_HOOK and PROBE_OPTION name
// the hook and the option (the claims take both names from the skill text).
import React from 'react';
import * as ink from 'ink';

const { Text, renderToString } = ink;
const useWindowSize = ink[process.env.PROBE_HOOK ?? 'useWindowSize'];
const option = process.env.PROBE_OPTION ?? 'columns';

const h = React.createElement;
const Size = () => {
	const { columns, rows } = useWindowSize();
	return h(Text, null, `${columns}x${rows}`);
};
const results = {};
for (const columns of JSON.parse(process.env.PROBE_COLUMNS ?? '[40]')) {
	results[columns] = {
		size: renderToString(h(Size), { [option]: columns }),
		wrapped: renderToString(h(Text, null, 'x'.repeat(100)), { [option]: columns }),
	};
}
process.stdout.write(`${JSON.stringify(results)}\n`);
