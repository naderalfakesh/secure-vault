import { MONTH_NAMES } from './constants';

export type FoundDate = {
  date: string;
  context: string;
};

function expandYear(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.length === 4) return value;
  const n = Number(value);
  return String(n < 70 ? 2000 + n : 1900 + n);
}

function monthFromName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const month =
    MONTH_NAMES[name.slice(0, 4).toLowerCase()] ?? MONTH_NAMES[name.slice(0, 3).toLowerCase()];
  return month ? String(month) : undefined;
}

function iso(year?: string, month?: string, day?: string): string | null {
  if (!year || !month || !day) return null;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null;
  return date.toISOString().slice(0, 10);
}

const DATE_PATTERNS: readonly { regex: RegExp; toIso: (m: RegExpMatchArray) => string | null }[] = [
  { regex: /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g, toIso: (m) => iso(m[1], m[2], m[3]) },
  // Day-first (DD/MM/YYYY) matches common passport/ID layouts.
  { regex: /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/g, toIso: (m) => iso(m[3], m[2], m[1]) },
  {
    regex: /\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{2,4})\b/g,
    toIso: (m) => iso(expandYear(m[3]), monthFromName(m[2]), m[1]),
  },
  {
    regex: /\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/g,
    toIso: (m) => iso(m[3], monthFromName(m[1]), m[2]),
  },
];

export function findDates(text: string): FoundDate[] {
  const found: { index: number; date: string; context: string }[] = [];
  for (const { regex, toIso } of DATE_PATTERNS) {
    for (const match of text.matchAll(regex)) {
      const date = toIso(match);
      const index = match.index ?? 0;
      if (date && !found.some((f) => Math.abs(f.index - index) < 3)) {
        found.push({ index, date, context: text.slice(Math.max(0, index - 40), index) });
      }
    }
  }
  return found.sort((a, b) => a.index - b.index).map(({ date, context }) => ({ date, context }));
}
