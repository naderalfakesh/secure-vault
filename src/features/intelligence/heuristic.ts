import type { ExtractedField } from '@/data/DocumentRepository';
import { DocumentCategory } from '@/types';

import { type DocumentIntelligence, type DocumentSuggestion, EXPIRY_FIELD } from './types';

/**
 * The always-available engine. Regular expressions and keyword lists are not
 * clever, but they run everywhere, in a few milliseconds, with no model
 * download, and they make the app complete on devices without on-device AI.
 */

const categoryKeywords: [DocumentCategory, RegExp][] = [
  [
    DocumentCategory.ID,
    /\b(passport|passeport|identity|id card|driver'?s? licen[cs]e|national id|residence permit|visa)\b/i,
  ],
  [
    DocumentCategory.MEDICAL,
    /\b(prescription|patient|diagnosis|clinic|hospital|vaccin|medical|pharmacy|dosage)\b/i,
  ],
  [
    DocumentCategory.INSURANCE,
    /\b(insurance|insurer|policy (?:no|number)|coverage|premium|claim)\b/i,
  ],
  [
    DocumentCategory.FINANCE,
    /\b(invoice|statement|iban|account (?:no|number)|balance|tax|salary|payslip|bank)\b/i,
  ],
  [
    DocumentCategory.LEGAL,
    /\b(agreement|contract|lease|tenant|landlord|notary|court|hereby|terms and conditions)\b/i,
  ],
  [
    DocumentCategory.RECEIPTS,
    /\b(receipt|total|subtotal|vat|cash|change due|thank you for (?:your purchase|shopping))\b/i,
  ],
];

const expiryKeywords =
  /\b(expir\w*|valid (?:until|through|thru|to)|date of expiry|exp\.?|best before|renew(?:al)? by)\b/i;
const issueKeywords = /\b(issued?|date of issue|issue date)\b/i;
const numberKeywords =
  /\b(?:passport|document|policy|licen[cs]e|id|account|invoice|member(?:ship)?)\s*(?:no\.?|number|#|№)\s*[:.]?\s*([A-Z0-9][A-Z0-9-]{4,})/i;

const monthNames: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const datePatterns: { regex: RegExp; toIso: (m: RegExpMatchArray) => string | null }[] = [
  // 2026-09-07 or 2026/09/07
  { regex: /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g, toIso: (m) => iso(m[1], m[2], m[3]) },
  // 07/09/2026, 07.09.2026, 07-09-2026 (day first, the common passport layout)
  { regex: /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/g, toIso: (m) => iso(m[3], m[2], m[1]) },
  // 07 Sep 2026, 7 September 2026, 07 SEP 26
  {
    regex: /\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{2,4})\b/g,
    toIso: (m) => iso(expandYear(m[3]), monthFromName(m[2]), m[1]),
  },
  // Sep 7, 2026 / September 07 2026
  {
    regex: /\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/g,
    toIso: (m) => iso(m[3], monthFromName(m[1]), m[2]),
  },
];

function expandYear(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.length === 4) return value;
  const n = Number(value);
  return String(n < 70 ? 2000 + n : 1900 + n);
}

function monthFromName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const month =
    monthNames[name.slice(0, 4).toLowerCase()] ?? monthNames[name.slice(0, 3).toLowerCase()];
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

/** Every date in the text with the text that preceded it, in order of appearance. */
export function findDates(text: string): { date: string; context: string }[] {
  const found: { index: number; date: string; context: string }[] = [];
  for (const { regex, toIso } of datePatterns) {
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

export function suggestCategory(text: string): DocumentCategory | undefined {
  let best: { category: DocumentCategory; hits: number } | undefined;
  for (const [category, regex] of categoryKeywords) {
    const hits = text.match(new RegExp(regex.source, 'gi'))?.length ?? 0;
    if (hits > 0 && (!best || hits > best.hits)) best = { category, hits };
  }
  return best?.category;
}

export function suggestTitle(text: string): string | undefined {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 3 && line.length <= 60 && /[A-Za-z]/.test(line));
  const candidate = lines.find((line) => /[A-Za-z]{3,}/.test(line) && !/^\d/.test(line));
  if (!candidate) return undefined;
  const words = candidate.split(/\s+/).slice(0, 6).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function extractFields(text: string): ExtractedField[] {
  const fields: ExtractedField[] = [];
  const dates = findDates(text);
  const expiry = dates.find((d) => expiryKeywords.test(d.context));
  const issue = dates.find((d) => issueKeywords.test(d.context) && d.date !== expiry?.date);
  if (expiry) fields.push({ key: EXPIRY_FIELD, value: expiry.date, kind: 'date' });
  else {
    // Without a keyword, the latest future date is the best guess for an expiry.
    const today = new Date().toISOString().slice(0, 10);
    const future = dates
      .filter((d) => d.date > today)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (future) fields.push({ key: EXPIRY_FIELD, value: future.date, kind: 'date' });
  }
  if (issue) fields.push({ key: 'issued', value: issue.date, kind: 'date' });
  const number = text.match(numberKeywords)?.[1];
  if (number) fields.push({ key: 'number', value: number.toUpperCase(), kind: 'text' });
  return fields;
}

export function suggestTags(text: string, category?: DocumentCategory): string[] {
  const tags = new Set<string>();
  if (category) tags.add(category);
  const year = findDates(text)[0]?.date.slice(0, 4);
  if (year) tags.add(year);
  return [...tags].slice(0, 3);
}

export const heuristicIntelligence: DocumentIntelligence = {
  engine: 'heuristic',
  async isAvailable() {
    return true;
  },
  async suggest(ocrText: string): Promise<DocumentSuggestion> {
    const text = ocrText.trim();
    if (!text) return { tags: [], fields: [], engine: 'heuristic' };
    const category = suggestCategory(text);
    return {
      title: suggestTitle(text),
      category,
      tags: suggestTags(text, category),
      fields: extractFields(text),
      engine: 'heuristic',
    };
  },
};
