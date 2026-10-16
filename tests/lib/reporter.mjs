// node:test reporter that records which claims passed. coverage.mjs compares this with the
// claims that registered, so a claim that never ran (skipped, crashed file, filtered) cannot
// count as covered.
export default async function* reporter(source) {
  const passed = [];
  const failed = [];
  const skipped = [];
  for await (const event of source) {
    if (event.type !== 'test:pass' && event.type !== 'test:fail') continue;
    const { name, skip, todo } = event.data;
    const id = name.match(/^(\S+\/\S+#\d+)\s/)?.[1];
    if (!id) continue; // suites, files, self-tests
    if (event.type === 'test:fail') failed.push(id);
    else if (skip || todo) skipped.push(id);
    else passed.push(id);
  }
  yield `${JSON.stringify({ passed, failed, skipped })}\n`;
}
