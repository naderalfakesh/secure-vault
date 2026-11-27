import { formatTags } from '@/features/documents/tags';
import { t, tp } from '@/i18n';
import { type Document, type ExtractedField, FIELD_KEYS } from '@/types';
import { isolate } from '@/utils/bidi';
import { errorCode, plainErrorMessage } from '@/utils/errors';
import { formatDate, formatFileSize, joinParts } from '@/utils/format';
import { isKeyLocked } from '@modules/expo-vault';

import { FIELD_TITLES } from './constants';
import type { Draft } from './types';

export function fieldTitle(key: string): string {
  return FIELD_TITLES[key] ? t(FIELD_TITLES[key]) : key;
}

export function maskNumber(value: string): string {
  return t('viewer.maskedNumber', { last4: value.slice(-4) });
}

export function expiryField(fields: readonly ExtractedField[]): ExtractedField | undefined {
  return fields.find((field) => field.key === FIELD_KEYS.expires && field.kind === 'date');
}

export function pageLine(page: number, count: number): string {
  return count > 0 ? t('viewer.pageLine', { number: page + 1, count }) : '';
}

export function unreadableDetail(error: unknown): string | undefined {
  return isKeyLocked(error) || errorCode(error) === 'KEY_INVALIDATED'
    ? plainErrorMessage(error, t('viewer.unreadable.body'))
    : undefined;
}

export function draftFromDocument(document: Document): Draft {
  return {
    title: document.title,
    category: document.category,
    tags: formatTags(document.tags),
  };
}

export function shareFileType(fileType: Document['fileType']) {
  return {
    mimeType: fileType === 'pdf' ? 'application/pdf' : 'image/jpeg',
    UTI: fileType === 'pdf' ? 'com.adobe.pdf' : 'public.jpeg',
  };
}

export function fileIcon(fileType: Document['fileType']): 'pdf' | 'image' {
  return fileType === 'pdf' ? 'pdf' : 'image';
}

export function shareFileMeta(document: Document, pageCount: number): string {
  return joinParts([
    tp('format.pages', Math.max(pageCount, 1)),
    t(document.fileType === 'pdf' ? 'viewer.fileType.pdf' : 'viewer.fileType.image'),
    // Legacy scans saved before size tracking have fileSize === 0; omit them.
    document.fileSize > 0 && formatFileSize(document.fileSize),
  ]);
}

export function detailsFooter(document: Document, pageCount: number): string {
  return joinParts([
    // Bidi-isolate date so an RTL month name doesn't pull adjacent numbers into the date.
    t('viewer.added', { date: isolate(formatDate(document.createdAt)) }),
    pageCount > 0 ? tp('format.pages', pageCount) : null,
    document.fileSize > 0 && formatFileSize(document.fileSize),
    t('viewer.encrypted'),
  ]);
}
