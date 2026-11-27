import { type DocumentCategory, type ExtractedField, FIELD_KEYS } from '@/types';

import {
  CATEGORY_KEYWORDS,
  EXPIRY_KEYWORDS,
  ISSUE_KEYWORDS,
  MINOR_WORDS,
  NUMBER_KEYWORDS,
} from './constants';
import { findDates, type FoundDate } from './dates';
import type { DocumentIntelligence, DocumentSuggestion } from './types';

export { findDates } from './dates';

export function suggestCategory(text: string): DocumentCategory | undefined {
  let best: { category: DocumentCategory; hits: number } | undefined;
  for (const [category, regex] of CATEGORY_KEYWORDS) {
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
  if (words === words.toUpperCase()) return titleCase(words);
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function titleCase(words: string): string {
  return words
    .toLowerCase()
    .split(' ')
    .map((word, index) =>
      index > 0 && MINOR_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}

export function extractFields(text: string): ExtractedField[] {
  return fieldsFrom(text, findDates(text));
}

function fieldsFrom(text: string, dates: readonly FoundDate[]): ExtractedField[] {
  const fields: ExtractedField[] = [];
  const expiry = dates.find((d) => EXPIRY_KEYWORDS.test(d.context));
  const issue = dates.find((d) => ISSUE_KEYWORDS.test(d.context) && d.date !== expiry?.date);
  if (expiry) fields.push({ key: FIELD_KEYS.expires, value: expiry.date, kind: 'date' });
  else {
    const today = new Date().toISOString().slice(0, 10);
    const future = dates
      .filter((d) => d.date > today)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (future) fields.push({ key: FIELD_KEYS.expires, value: future.date, kind: 'date' });
  }
  if (issue) fields.push({ key: FIELD_KEYS.issued, value: issue.date, kind: 'date' });
  const number = text.match(NUMBER_KEYWORDS)?.[1];
  if (number) fields.push({ key: FIELD_KEYS.number, value: number.toUpperCase(), kind: 'text' });
  return fields;
}

// Include category as a tag because full-text search does not index category.
function suggestTags(
  category: DocumentCategory | undefined,
  fields: readonly ExtractedField[],
  dates: readonly FoundDate[],
): string[] {
  const tags = new Set<string>();
  if (category) tags.add(category);
  const date =
    fields.find((field) => field.key === FIELD_KEYS.expires)?.value ??
    fields.find((field) => field.key === FIELD_KEYS.issued)?.value ??
    dates[0]?.date;
  const year = date?.slice(0, 4);
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
    const dates = findDates(text);
    const fields = fieldsFrom(text, dates);
    return {
      title: suggestTitle(text),
      category,
      tags: suggestTags(category, fields, dates),
      fields,
      engine: 'heuristic',
    };
  },
};
