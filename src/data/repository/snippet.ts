import type { SnippetPiece } from './types';

// Control chars wrap FTS5 snippet matches; OCR_COLUMN=3 matches documents_fts column order.
const MATCH_START = String.fromCharCode(2);
const MATCH_END = String.fromCharCode(3);
export const OCR_COLUMN = 3;
export const SNIPPET_TOKENS = 12;

const ELLIPSIS = '…';

// Detects when FTS5 snippet() split a token mid-word (e.g. at hyphens) by checking source neighbors.
export function cutWords(raw: string, source: string | null | undefined) {
  const body = raw.replaceAll(MATCH_START, '').replaceAll(MATCH_END, '');
  const leading = body.startsWith(ELLIPSIS);
  const trailing = body.endsWith(ELLIPSIS) && body.length > 1;
  const inner = body.slice(leading ? 1 : 0, trailing ? -1 : undefined);
  const at = source && inner ? source.indexOf(inner) : -1;
  if (!source || at < 0) return { start: false, end: false };
  const after = source[at + inner.length];
  return {
    start: leading && at > 0 && !/\s/.test(source[at - 1] ?? ''),
    end: trailing && after !== undefined && !/\s/.test(after),
  };
}

export function parseSnippet(raw: string | null, source?: string | null): SnippetPiece[] | null {
  if (!raw || !raw.includes(MATCH_START)) return null;
  const pieces: SnippetPiece[] = [];
  const clean = (text: string) => text.replace(/\s+/g, ' ');
  for (const [index, chunk] of raw.split(MATCH_START).entries()) {
    if (index === 0) {
      if (chunk) pieces.push({ text: clean(chunk).trimStart() });
      continue;
    }
    const end = chunk.indexOf(MATCH_END);
    const matched = end < 0 ? chunk : chunk.slice(0, end);
    const rest = end < 0 ? '' : chunk.slice(end + MATCH_END.length);
    if (matched) pieces.push({ text: clean(matched), match: true });
    if (rest) pieces.push({ text: clean(rest).replaceAll(MATCH_END, '') });
  }
  const last = pieces[pieces.length - 1];
  if (last && !last.match) last.text = last.text.trimEnd();
  const cut = cutWords(raw, source);
  const first = pieces[0];
  if (cut.start && first && !first.match && first.text.startsWith(ELLIPSIS)) {
    const rest = first.text.slice(1);
    const space = rest.search(/\s/);
    if (space >= 0) first.text = ELLIPSIS + rest.slice(space + 1);
  }
  if (cut.end && last && !last.match && last.text.endsWith(ELLIPSIS)) {
    const rest = last.text.slice(0, -1);
    const space = rest.search(/\s\S*$/);
    if (space >= 0) last.text = rest.slice(0, space) + ELLIPSIS;
  }
  return pieces.some((piece) => piece.match) ? pieces : null;
}
