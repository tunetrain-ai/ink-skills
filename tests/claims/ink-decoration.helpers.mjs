// Shared fixtures for the ink-decoration claims.
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { externalHarness, extImport, runIsolated } from '../lib/index.mjs';

// ink-link decides whether the terminal supports hyperlinks once, at import: each environment
// needs its own process. Results are cached because several claims read the same one.
const linkRuns = new Map();
export function linkProbe(env = {}) {
  const key = JSON.stringify(env);
  if (!linkRuns.has(key)) {
    linkRuns.set(
      key,
      runIsolated({ probe: 'ink-link', env: { FORCE_COLOR: '0', ...env }, tty: { isTTY: true, columns: 80 } }).then((run) => {
        if (!run.json) throw new Error(`ink-link probe failed:\n${run.stdout}\n${run.stderr}`);
        return run.json;
      }),
    );
  }
  return linkRuns.get(key);
}

// ---------------------------------------------------------------------------
// ink-picture (installed in tests/external)
// ---------------------------------------------------------------------------

const tmpDirs = [];
process.on('exit', () => tmpDirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/**
 * A PNG on disk and in memory, `width`×`height` pixels: one solid colour, or `stripes` (colours
 * left to right, each taking an equal share of the width) when an image has to look different
 * after being cropped, stretched or letterboxed.
 */
export async function png({ width = 8, height = 8, color = 0xff0000ff, stripes, name = 'logo.png' } = {}) {
  const { Jimp } = await extImport('jimp');
  const image = new Jimp({ width, height, color });
  if (stripes) {
    for (let x = 0; x < width; x++) {
      const stripe = stripes[Math.min(stripes.length - 1, Math.floor((x / width) * stripes.length))];
      for (let y = 0; y < height; y++) image.setPixelColor(stripe, x, y);
    }
  }
  const dir = mkdtempSync(join(tmpdir(), 'ink-skills-pic-'));
  tmpDirs.push(dir);
  const file = join(dir, name);
  const buffer = await image.getBuffer('image/png');
  writeFileSync(file, buffer);
  return { dir, file, buffer };
}

/** Serve `body` on 127.0.0.1 (never the real network); resolves `{url, close}`. */
export function serve(body, type = 'image/png') {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': type });
      res.end(body);
    });
    server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}/logo.png`, close: () => new Promise((done) => server.close(done)) }));
  });
}

/** Mount `<InkPictureProvider terminalInfo=…><Image …/></…>` on the external Ink and wait for the image. */
export async function picture({ props, info = {}, columns = 30, rows = 12, wrap } = {}) {
  const { h, mount, ink } = await externalHarness();
  const { default: Image, InkPictureProvider } = await extImport('ink-picture');
  const terminalInfo = { supportsUnicode: true, supportsColor: true, ...info };
  const image = h(Image, props);
  const app = mount(h(InkPictureProvider, { terminalInfo }, wrap ? wrap(image, h, ink) : image), { columns, rows });
  const settle = async () => {
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 25));
      await app.flush();
      if (!/Loading/.test(app.screen())) break;
    }
    return app;
  };
  return { app, settle, ink, h, Image, InkPictureProvider };
}
