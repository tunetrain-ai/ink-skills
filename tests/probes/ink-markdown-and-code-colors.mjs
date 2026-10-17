// Renders a Markdown string with marked + marked-terminal and a snippet with cli-highlight once,
// in whatever colour environment the parent set up (chalk reads it at import).
import { Marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { highlight } from 'cli-highlight';

const markdown = 'This is **markdown** with `code`.';
const markdownOut = new Marked(markedTerminal()).parse(markdown, { async: false });
const codeOut = highlight("const hello = 'world';", { language: 'javascript' });

console.log(JSON.stringify({ markdown: markdownOut, code: codeOut }));
