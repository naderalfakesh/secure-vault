import { DocumentCategory } from '@/types';

import { findDates } from './dates';

const categories = new Set<string>(Object.values(DocumentCategory));

function isCategory(value: string): value is DocumentCategory {
  return categories.has(value);
}

function compact(value: string): string {
  return value.toUpperCase().replace(/[\s\-/.]/g, '');
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed || undefined;
}

/** The JSON object in the answer, even when a model wraps it in prose or a code fence. */
function parseObject(answer: string): Record<string, unknown> {
  const start = answer.indexOf('{');
  const end = answer.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The model did not answer with JSON.');
  const parsed: unknown = JSON.parse(answer.slice(start, end + 1));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('The model did not answer with an object.');
  }
  return parsed as Record<string, unknown>;
}

/** The parts of a model answer that the text supports. Throws on an answer that is not JSON. */
export function checkModelAnswer(answer: string, text: string) {
  const raw = parseObject(answer);
  const datesInText = new Set(findDates(text).map((found) => found.date));
  const textKey = compact(text);

  const title = asString(raw.title);
  const category = asString(raw.category)?.toLowerCase();
  const date = (value: unknown) => {
    const candidate = asString(value);
    return candidate && /^\d{4}-\d{2}-\d{2}$/.test(candidate) && datesInText.has(candidate)
      ? candidate
      : undefined;
  };
  const number = asString(raw.number);
  const numberKey = number ? compact(number) : '';
  const tags = Array.isArray(raw.tags)
    ? [
        ...new Set(
          raw.tags
            .map((tag) => asString(tag)?.toLowerCase())
            .filter(
              (tag): tag is string => !!tag && /^[\p{L}\p{N}][\p{L}\p{N} -]{0,19}$/u.test(tag),
            ),
        ),
      ].slice(0, 3)
    : [];

  return {
    title: title && title.length <= 60 && !/[{}"]/.test(title) ? title : undefined,
    category: category && isCategory(category) ? category : undefined,
    expires: date(raw.expires),
    issued: date(raw.issued),
    number:
      number !== undefined &&
      numberKey.length >= 4 &&
      numberKey.length <= 30 &&
      /\d/.test(numberKey) &&
      textKey.includes(numberKey)
        ? number.toUpperCase()
        : undefined,
    tags,
  };
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The on-device model took too long.')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
