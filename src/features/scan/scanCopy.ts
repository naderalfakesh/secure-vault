import { Platform } from 'react-native';

import { type KeysUnder, scopedText, type StringKey, t, tp } from '@/i18n';
import { FIELD_KEYS } from '@/types';
import { isolate } from '@/utils/bidi';

export type ScanCopyKey = KeysUnder<'scan'>;

export const scanText = scopedText('scan');

export function readingFooter(): string {
  return scanText(Platform.OS === 'ios' ? 'processing.footerVision' : 'processing.footerMlKit');
}

export function unsupportedFileMessage(name: string): string {
  return t('scan.import.unsupported', { name: isolate(name) });
}

export function protectedFileMessage(name: string): string {
  return t('scan.import.protected', { name: isolate(name) });
}

export function pageCount(count: number): string {
  return tp('format.pages', count);
}

export function pageLabel(index: number): string {
  return t('scan.page', { number: index + 1 });
}

export function pagePosition(index: number, count: number, moving: boolean): string {
  return t(moving ? 'scan.pagePositionMoving' : 'scan.pagePosition', {
    number: index + 1,
    count,
  });
}

export function movedTo(index: number, count: number): string {
  return t('scan.movedTo', { number: index + 1, count });
}

const fieldNames: Record<string, StringKey> = {
  expires: 'scan.field.expires',
  issued: 'scan.field.issued',
  number: 'scan.field.number',
};

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
