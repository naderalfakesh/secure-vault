import { type StringKey, t, tp } from '@/i18n';
import type { scan } from '@/i18n/en/scan';
import { isolate } from '@/utils/bidi';

/**
 * The J1 Scan and import strings (handover §6 J1, §7.8). They live in the
 * string table under `scan.`; this module keeps the short keys the scan
 * screens use.
 */
export type ScanCopyKey = {
  [K in keyof typeof scan]: K extends `scan.${infer Key}` ? Key : never;
}[keyof typeof scan];

export function scanText(key: ScanCopyKey): string {
  return t(`scan.${key}` as StringKey);
}

/** "budget-final.numbers can’t be added. Choose a PDF…", with the name isolated. */
export function unsupportedFileMessage(name: string): string {
  return t('scan.import.unsupported', { name: isolate(name) });
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
  const name = fieldNames[field.key] ? t(fieldNames[field.key]) : field.key;
  if (field.kind === 'date') return t('scan.field.value', { name, value: formatDate(field.value) });
  if (field.key === 'number') {
    return t('scan.field.maskedNumber', { name, last4: field.value.slice(-4) });
  }
  return t('scan.field.value', { name, value: field.value });
}
