import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXT, extPkg, extImport, externalHarness, runExternal, extPackageDir } from './external.mjs';
import { React, pkg } from './harness.mjs';

const declared = JSON.parse(readFileSync(join(EXT, 'package.json'), 'utf8')).dependencies;

test('every pin in tests/external/package.json is the installed version, exactly', () => {
  for (const [name, version] of Object.entries(declared)) {
    assert.equal(extPkg(name).version, version, `${name}: installed version differs from its pin`);
  }
});

test('the external project has its own ink 8 and its own React, distinct from the root pair', async () => {
  assert.match(extPkg('ink').version, /^8\./);
  const X = await externalHarness();
  assert.notEqual(X.React, React, 'external React must be a separate instance (components must be mounted by their own ink)');
  assert.equal(pkg('react').version, extPkg('react').version, 'both projects pin the same React version');
});

test('only ink-divider nests a second copy of ink (a hard dependency on ink 5)', () => {
  const nested = ['ink-divider', 'ink-chart', 'ink-markdown', 'ink-picture', 'ink-tab', 'ink-stepper', 'ink-scroll-view', 'ink-virtual-list']
    .filter((name) => {
      try {
        extPackageDir('ink', extPackageDir(name));
        return extPackageDir('ink', extPackageDir(name)).includes(`${name}/node_modules/ink`);
      } catch {
        return false;
      }
    });
  assert.deepEqual(nested, ['ink-divider']);
  assert.match(extPkg('ink', { from: 'ink-divider' }).version, /^5\./);
});

test('an ESM-only external package loads and renders through the external harness', async () => {
  const X = await externalHarness();
  const { Tabs, Tab } = await extImport('ink-tab');
  const app = X.mount(X.h(Tabs, { onChange() {} }, X.h(Tab, { name: 'a' }, 'One'), X.h(Tab, { name: 'b' }, 'Two')));
  await app.flush();
  assert.equal(app.screen(), '1. One | 2. Two');
});

test('runExternal reproduces a CommonJS package failing to load in a real process', async () => {
  const res = await runExternal({ code: `import('ink-table').then(() => console.log(JSON.stringify({ok:true})), (e) => console.log(JSON.stringify({ok:false, code:e.code})))` });
  assert.deepEqual(res.json, { ok: false, code: 'ERR_REQUIRE_ASYNC_MODULE' });
  const fine = await runExternal({ code: `import('ink-tab').then(() => console.log(JSON.stringify({ok:true})))` });
  assert.deepEqual(fine.json, { ok: true });
});
