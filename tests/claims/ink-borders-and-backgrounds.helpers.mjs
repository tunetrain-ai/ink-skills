// Shared fixtures for the ink-borders-and-backgrounds claims.
import { pathToFileURL } from 'node:url';
import ansiStyles from 'ansi-styles';
import { h, ink, packageDir, resolveEntry } from '../lib/index.mjs';

const { Box, Text, renderToString } = ink;

// node:test hands its test files FORCE_COLOR=1, which Ink's own chalk takes literally (the suite's colour
// level 3 only reaches other copies of chalk): pin the level on the chalk instance Ink renders with.
const inkChalk = (await import(pathToFileURL(resolveEntry('chalk', packageDir('ink'))).href)).default;
inkChalk.level = 3;

/** The parameters of an SGR escape: `\x1b[38;2;0;255;0m` → '38;2;0;255;0'. */
const params = (sequence) => sequence.slice(2, -1);

/**
 * The SGR parameters the ANSI standard (ansi-styles, not Ink) gives a colour written the way the skill
 * writes it: a name (`green`), hex (`#00ff00`) or `rgb(0, 255, 0)`, as foreground or background.
 */
export function sgrOf(color, ground = 'fg') {
  const named = ground === 'fg' ? color : `bg${color[0].toUpperCase()}${color.slice(1)}`;
  if (ansiStyles[named]) return params(ansiStyles[named].open);
  const space = ground === 'fg' ? ansiStyles.color : ansiStyles.bgColor;
  if (color.startsWith('#')) return params(space.ansi16m(...ansiStyles.hexToRgb(color)));
  const rgb = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (rgb) return params(space.ansi16m(Number(rgb[1]), Number(rgb[2]), Number(rgb[3])));
  throw new Error(`unknown colour: ${color}`);
}

/**
 * Terminal output as rows of cells: `{ch, fg, bg, dim}`, where fg/bg are the SGR parameters in effect
 * ('32', '48;2;0;255;0') or null. Understands the SGR sequences Ink writes for colour and dim.
 */
export function paint(output) {
  const rows = [[]];
  let state = { fg: null, bg: null, dim: false };
  const apply = (codes) => {
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      if (code === 0) state = { fg: null, bg: null, dim: false };
      else if (code === 2) state = { ...state, dim: true };
      else if (code === 22) state = { ...state, dim: false };
      else if (code === 39) state = { ...state, fg: null };
      else if (code === 49) state = { ...state, bg: null };
      else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) state = { ...state, fg: String(code) };
      else if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) state = { ...state, bg: String(code) };
      else if (code === 38 || code === 48) {
        const length = codes[i + 1] === 2 ? 5 : 3;
        const value = codes.slice(i, i + length).join(';');
        state = code === 38 ? { ...state, fg: value } : { ...state, bg: value };
        i += length - 1;
      }
    }
  };
  for (let i = 0; i < output.length; i++) {
    const match = output.slice(i).match(/^\x1b\[([\d;]*)m/);
    if (match) {
      apply(match[1].split(';').filter(Boolean).map(Number));
      i += match[0].length - 1;
    } else if (output[i] === '\n') rows.push([]);
    else rows.at(-1).push({ ch: output[i], ...state });
  }
  return rows;
}

/** The row's text. */
export const textOf = (row) => row.map((cell) => cell.ch).join('');

/** A box (or any element) rendered to a string on a terminal `columns` wide. */
export const render = (element, columns = 40) => renderToString(element, { columns });

/** `<Box {...props}><Text>{text}</Text></Box>` rendered. */
export const box = (props, text = 'x', columns = 40) => render(h(Box, props, h(Text, null, text)), columns);

export { ansiStyles };
