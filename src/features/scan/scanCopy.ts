import { Platform } from 'react-native';

import { type KeysUnder, scopedText, type StringKey, t, tp } from '@/i18n';
import { FIELD_KEYS } from '@/types';
import { isolate } from '@/utils/bidi';

/**
 * The Scan and import strings. They live in the
 * string table under `scan.`; this module keeps the short keys the scan
 * screens use.
 */
export type ScanCopyKey = KeysUnder<'scan'>;

export const scanText = scopedText('scan');

/**
 * Who reads the text, under the processing steps: Apple Vision on iOS,
 * Google ML Kit and its metrics on Android (ADR 0011).
 */
export function readingFooter(): string {
  return scanText(Platform.OS === 'ios' ? 'processing.footerVision' : 'processing.footerMlKit');
}

/** "budget-final.numbers can’t be added. Choose a PDF…", with the name isolated. */
export function unsupportedFileMessage(name: string): string {
  return t('scan.import.unsupported', { name: isolate(name) });
}

/** "statement.pdf is password-protected. Remove the password…", with the name isolated. */
export function protectedFileMessage(name: string): string {
  return t('scan.import.protected', { name: isolate(name) });
}

/** Review header: "3 pages". */
export function pageCount(count: number): string {
  return tp('format.pages', count);
}

export function pageLabel(index: number): string {
  return t('scan.page', { number: index + 1 });
}

/** What a screen reader says for a page in the review grid. */
export function pagePosition(index: number, count: number, moving: boolean): string {
  return t(moving ? 'scan.pagePositionMoving' : 'scan.pagePosition', {
    number: index + 1,
    count,
  });
}

/** Spoken after a page moves: "Moved to page 2 of 3". */
export function movedTo(index: number, count: number): string {
  return t('scan.movedTo', { number: index + 1, count });
}

const fieldNames: Record<string, StringKey> = {
  expires: 'scan.field.expires',
  issued: 'scan.field.issued',
  number: 'scan.field.number',
};

/** A found value as a chip: "Expires 3 Jan 2027", "No. •••• 4821" (numbers are masked). */
export function foundFieldLabel(
  field: { key: string; value: string; kind: string },
  formatDate: (iso: string) => string,
): string {
  const nameKey = fieldNames[field.key];
  const name = nameKey ? t(nameKey) : field.key;
  if (field.kind === 'date') return t('scan.field.value', { name, value: formatDate(field.value) });
  if (field.key === FIELD_KEYS.number) {
    return t('scan.field.maskedNumber', { name, last4: field.value.slice(-4) });
  }
  return t('scan.field.value', { name, value: field.value });
}
