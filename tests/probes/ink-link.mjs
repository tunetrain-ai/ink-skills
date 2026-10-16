// Renders <Link> variants once, in whatever hyperlink-support environment the parent set up.
import React from 'react';
import { renderToString, Text } from 'ink';
import Link from 'ink-link';

const h = React.createElement;
const body = (...children) => children;
const render = (props, ...children) => renderToString(h(Link, { url: 'https://example.com', ...props }, ...children), { columns: 80 });
const label = ['My ', h(Text, { color: 'cyan' }, 'Website')];

console.log(JSON.stringify({
  styled: render({}, ...label),
  plain: render({}, 'My Website'),
  noFallback: render({ fallback: false }, 'My Website'),
  customFallback: render({ fallback: (text, url) => `[${text}](${url})` }, 'My Website'),
}));
