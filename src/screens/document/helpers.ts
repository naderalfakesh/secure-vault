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

/** The recognised expiry date, if the scanner found one. */
export function expiryField(fields: readonly ExtractedField[]): ExtractedField | undefined {
  return fields.find((field) => field.key === FIELD_KEYS.expires && field.kind === 'date');
}

/** "Page 2 of 3" for the top bar, or nothing while there are no pages. */
export function pageLine(page: number, count: number): string {
  return count > 0 ? t('viewer.pageLine', { number: page + 1, count }) : '';
}

/**
 * The sentence a failed load shows. A key that was not unlocked is not
 * damage; say what happened instead. Anything else keeps the screen's own text.
 */
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

/** What the system share sheet is told about the copy. */
export function shareFileType(fileType: Document['fileType']) {
  return {
    mimeType: fileType === 'pdf' ? 'application/pdf' : 'image/jpeg',
    UTI: fileType === 'pdf' ? 'com.adobe.pdf' : 'public.jpeg',
  };
}

export function fileIcon(fileType: Document['fileType']): 'pdf' | 'image' {
  return fileType === 'pdf' ? 'pdf' : 'image';
}

/** The share sheet's file line: pages, kind and size. */
export function shareFileMeta(document: Document, pageCount: number): string {
  return joinParts([
    tp('format.pages', Math.max(pageCount, 1)),
    t(document.fileType === 'pdf' ? 'viewer.fileType.pdf' : 'viewer.fileType.image'),
    // A size of 0 is unknown (scans saved before sizes were measured): left out.
    document.fileSize > 0 && formatFileSize(document.fileSize),
  ]);
}

/** The details sheet's last line: added, pages, size, encrypted. */
export function detailsFooter(document: Document, pageCount: number): string {
  return joinParts([
    // Isolated: a month in another script would pull the page count into the date.
    t('viewer.added', { date: isolate(formatDate(document.createdAt)) }),
    pageCount > 0 ? tp('format.pages', pageCount) : null,
    // A size of 0 is unknown (scans saved before sizes were measured): left out.
    document.fileSize > 0 && formatFileSize(document.fileSize),
    t('viewer.encrypted'),
  ]);
}
