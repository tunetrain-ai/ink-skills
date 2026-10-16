// Splits a skill markdown file into the UNITS the coverage gate accounts for, and
// finds claim quotes inside the file.
//
// Everything lives in one coordinate space: N = normalize(whole file). A quote is
// located in N; a unit is a [start, end) range in N; a quote "covers" a unit when
// their ranges overlap. Hard-wrapped markdown therefore matches regardless of
// where the line breaks fall, and a quote may span several sentences.

import { marked } from 'marked';

/** Collapse whitespace and un-escape table pipes so quotes survive hard-wrapping. */
export function normalize(text) {
  return text.replace(/\\\|/g, '|').replace(/\s+/g, ' ').trim();
}

/** Every start index of `needle` in `haystack` (non-overlapping scan from each hit). */
export function findAll(haystack, needle) {
  const hits = [];
  if (!needle) return hits;
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) hits.push(at);
  return hits;
}

// ---------------------------------------------------------------------------
// fact tokens
// ---------------------------------------------------------------------------

/**
 * The checkable details inside a piece of text: backticked spans, **bold** terms,
 * numbers/versions/ranges and double-quoted strings. Returned as the literal text
 * a test must be able to point at (backticks and asterisks stripped).
 */
export function factTokens(text) {
  const tokens = new Set();
  for (const m of text.matchAll(/`+([^`]+)`+/g)) tokens.add(m[1].trim());
  for (const m of text.matchAll(/\*\*([^*]+)\*\*/g)) tokens.add(m[1].trim());
  for (const m of text.matchAll(/["“]([^"”]{1,60})["”]/g)) tokens.add(m[1].trim());
  // numbers outside inline code: 80, 100, 8.0.0, 80×24, 0–100, 50%
  const outsideCode = text.replace(/`+[^`]*`+/g, ' ');
  for (const m of outsideCode.matchAll(/(?<![\w.])\d+(?:[.,]\d+)*(?:\s?[×x–-]\s?\d+(?:\.\d+)*)?%?(?![\w])/g)) tokens.add(m[0].trim());
  tokens.delete('');
  return [...tokens];
}

// ---------------------------------------------------------------------------
// sentence splitting
// ---------------------------------------------------------------------------

const MASKS = [
  // inline code is masked inside the backticks only, so a sentence that STARTS with a
  // code span still looks like a sentence start to the cut rule below
  [/`+[^`]*`+/g, (m) => '`' + 'x'.repeat(Math.max(0, m.length - 2)) + '`'],
  /\]\([^)]*\)/g, // link targets
  /https?:\/\/\S+/g, // bare URLs
  /\b(?:e\.g|i\.e|etc|vs|cf|approx)\./gi, // abbreviations
  /\d+(?:\.\d+)+/g, // versions and decimals
  /\b[\w-]+\.(?:m?js|cjs|json|md|tsx?|jsx|sh|yml)\b/g, // file names
];

/** [start, end) ranges of the sentences in an already-normalized text. */
export function sentenceRanges(text) {
  let masked = text;
  for (const mask of MASKS) {
    const [re, fn] = Array.isArray(mask) ? mask : [mask, (m) => 'x'.repeat(m.length)];
    masked = masked.replace(re, fn);
  }
  const cut = /[.!?…][*_)"'”\]]*(?=\s+[A-Z0-9`*_\[("<“@])/g;
  const ranges = [];
  let start = 0;
  for (const m of masked.matchAll(cut)) {
    const end = m.index + m[0].length;
    ranges.push([start, end]);
    start = end;
    while (text[start] === ' ') start++;
  }
  if (start < text.length) ranges.push([start, text.length]);
  return ranges.filter(([a, b]) => text.slice(a, b).trim().length > 0);
}

// ---------------------------------------------------------------------------
// comment extraction from code fences
// ---------------------------------------------------------------------------

/** Comment texts inside a code body (// ..., # ... for sh, /* ... *\/ and * lines). */
export function fenceComments(lang, code) {
  const out = [];
  for (const line of code.split('\n')) {
    if (/^\s*(\/\*|\*)/.test(line)) {
      out.push(line.replace(/^\s*(\/\*+|\*+\/?)\s?/, '').replace(/\*\/\s*$/, '').trim());
      continue;
    }
    if (lang === 'sh' || lang === 'bash') {
      const m = line.match(/(?:^|\s)#\s?(.*)$/);
      if (m) out.push(m[1].trim());
      continue;
    }
    // scan for // outside of quotes
    let quote = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quote) {
        if (c === '\\') i++;
        else if (c === quote) quote = null;
      } else if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '/' && line[i + 1] === '/' && (i === 0 || /\s|[;,)}]/.test(line[i - 1]))) {
        out.push(line.slice(i + 2).trim());
        break;
      } else if (c === '/' && line[i + 1] === '*') {
        const end = line.indexOf('*/', i + 2);
        out.push(line.slice(i + 2, end === -1 ? undefined : end).trim());
        break;
      }
    }
  }
  return out.filter(Boolean);
}

// ---------------------------------------------------------------------------
// unit extraction
// ---------------------------------------------------------------------------

/**
 * Most headings are navigational labels ("`Spinner`", "`useInput(handler, options?)`").
 * A heading is a claim only when it reads like a statement.
 */
const CLAIMISH_HEADING = /\b(is|are|requires?|must|not|never|always|default|only|don't|doesn't|no longer|instead|needs?|cannot|can't|without)\b/i;

/**
 * @typedef {object} Unit
 * @property {string} id         stable per file: "<kind>:<n>"
 * @property {'frontmatter'|'metadata'|'heading'|'sentence'|'row'|'fence'|'comment'|'generated'|'structural'} kind
 * @property {string} text       normalized text of the unit
 * @property {number} start      [start, end) in N
 * @property {number} end
 * @property {number} line       1-based line in the file (best effort)
 * @property {string[]} tokens   fact tokens
 * @property {number} [fence]    index of the fence (kind fence/comment)
 * @property {string} [lang]     fence language
 */

/**
 * @param {string} rawFile full file contents
 * @returns {{ N: string, units: Unit[], fences: {lang:string, info:string, code:string, unit: Unit}[] }}
 */
export function extractUnits(rawFile) {
  const file = rawFile.replace(/\r\n/g, '\n');
  const N = normalize(file);
  const lineStarts = [0];
  for (let i = 0; i < file.length; i++) if (file[i] === '\n') lineStarts.push(i + 1);
  const lineAt = (offset) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };

  /** @type {Unit[]} */
  const units = [];
  const fences = [];
  let cursor = 0; // monotonically advancing search position in N
  const counters = {};
  const nextId = (kind) => `${kind}:${counters[kind] = (counters[kind] ?? -1) + 1}`;

  /** Locate `rawText` (any whitespace form) in N from the cursor; returns [start,end] or null. */
  function locate(rawText, from = cursor) {
    const needle = normalize(rawText);
    if (!needle) return null;
    let at = N.indexOf(needle, from);
    if (at === -1) at = N.indexOf(needle); // fall back to a global search
    if (at === -1) return null;
    return [at, at + needle.length];
  }

  function push(kind, rawText, line, extra = {}) {
    const loc = locate(rawText);
    if (!loc) return null;
    const [start, end] = loc;
    const text = N.slice(start, end);
    const unit = { id: nextId(kind), kind, text, start, end, line, tokens: extra.exemptTokens || kind === 'fence' ? [] : factTokens(text), ...extra };
    units.push(unit);
    cursor = Math.max(cursor, start);
    return unit;
  }

  function pushSentences(rawText, line, kind = 'sentence') {
    const loc = locate(rawText);
    if (!loc) return;
    const [base, end] = loc;
    const text = N.slice(base, end);
    for (const [a, b] of sentenceRanges(text)) {
      const sentence = text.slice(a, b);
      if (/^Related skills?:/i.test(sentence)) {
        units.push({ id: nextId('structural'), kind: 'structural', text: sentence, start: base + a, end: base + b, line, tokens: [] });
        continue;
      }
      units.push({ id: nextId(kind), kind, text: sentence, start: base + a, end: base + b, line, tokens: factTokens(sentence) });
    }
    cursor = Math.max(cursor, base);
  }

  // --- frontmatter ---------------------------------------------------------
  const fm = file.match(/^---\n([\s\S]*?)\n---\n?/);
  let bodyOffset = 0;
  if (fm) {
    bodyOffset = fm[0].length;
    const fmLines = fm[1].split('\n');
    let inMetadata = false;
    fmLines.forEach((rawLine, i) => {
      const line = i + 2;
      if (/^description:/.test(rawLine)) {
        let value = rawLine.replace(/^description:\s*/, '');
        if (/^"/.test(value)) value = value.replace(/^"/, '').replace(/"$/, '');
        pushSentences(value, line, 'frontmatter');
        inMetadata = false;
      } else if (/^metadata:/.test(rawLine)) {
        inMetadata = true;
      }
      // metadata.ink is enforced against the installed Ink by scripts/validate.mjs.
    });
  }

  // --- body ----------------------------------------------------------------
  const body = file.slice(bodyOffset);
  const tokens = marked.lexer(body, { gfm: true });
  let tokenOffset = bodyOffset;

  function walk(toks, baseOffset) {
    const offsets = [];
    let running = baseOffset;
    for (const t of toks) {
      offsets.push(running);
      running += t.raw.length;
    }
    for (let ti = 0; ti < toks.length; ti++) {
      const tok = toks[ti];
      const off = offsets[ti];
      const line = lineAt(off);
      switch (tok.type) {
        case 'heading': {
          if (CLAIMISH_HEADING.test(tok.text) && factTokens(tok.text).length) push('heading', tok.text, line);
          break;
        }
        case 'paragraph':
        case 'text':
          pushSentences(tok.text ?? tok.raw, line);
          break;
        case 'blockquote':
          walk(tok.tokens ?? [], off);
          break;
        case 'list':
          for (const item of tok.items) walk(item.tokens ?? [], off + Math.max(0, tok.raw.indexOf(item.raw)));
          break;
        case 'table': {
          const lines = tok.raw.replace(/\n+$/, '').split('\n');
          lines.slice(2).forEach((row, i) => {
            if (row.trim()) push('row', row, line + 2 + i);
          });
          break;
        }
        case 'code': {
          const info = (tok.lang ?? '').trim();
          const lang = info.split(/\s+/)[0];
          const index = fences.length;
          const code = tok.text;
          const unit = push('fence', code || '(empty)', line, { fence: index, lang, info });
          if (unit) {
            fences.push({ lang, info, code, unit });
            for (const comment of fenceComments(lang, code)) {
              const loc = locate(comment, unit.start);
              if (loc && loc[0] >= unit.start && loc[1] <= unit.end) {
                units.push({
                  id: nextId('comment'),
                  kind: 'comment',
                  text: N.slice(loc[0], loc[1]),
                  start: loc[0],
                  end: loc[1],
                  line,
                  tokens: factTokens(comment),
                  fence: index,
                  lang,
                });
              }
            }
            cursor = Math.max(cursor, unit.end);
          }
          break;
        }
        case 'html': {
          if (/<!--\s*ECOSYSTEM_MATRIX:START/.test(tok.raw)) {
            // The matrix is generated from data/ecosystem.json: one unit for the whole block.
            push('generated', tok.raw, line, { exemptTokens: true });
            let j = ti;
            while (j < toks.length - 1 && !/ECOSYSTEM_MATRIX:END/.test(toks[j].raw)) j++;
            ti = j; // resume after the END marker
          }
          break;
        }
        default:
          break; // space, hr, def …
      }
    }
  }

  walk(tokens, tokenOffset);
  return { N, units, fences };
}
