import type { ExtractedField } from '@/data/DocumentRepository';
import { t, tp } from '@/i18n';
import { type Document, DocumentCategory } from '@/types';
import { KEY_INVALIDATED_MESSAGE, KEY_LOCKED_MESSAGE } from '@/utils/errors';

import {
  detailsFooter,
  draftFromDocument,
  expiryField,
  fieldTitle,
  fileIcon,
  maskNumber,
  pageLine,
  parseTags,
  shareFileMeta,
  shareFileType,
  unreadableDetail,
} from '../helpers';

function doc(overrides: Partial<Document> = {}): Document {
  return {
    id: 'd1',
    title: 'Passport',
    category: DocumentCategory.ID,
    tags: ['travel', 'family'],
    thumbnailKey: 't',
    fileKey: 'f',
    fileType: 'image',
    fileSize: 2048,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('fieldTitle', () => {
  it('names the fields the scanner knows and shows other keys as they are', () => {
    expect(fieldTitle('expires')).toBe(t('viewer.field.expires'));
    expect(fieldTitle('number')).toBe(t('viewer.field.number'));
    expect(fieldTitle('mrz')).toBe('mrz');
  });
});

describe('maskNumber', () => {
  it('keeps only the last four characters', () => {
    expect(maskNumber('X1234567')).toBe(t('viewer.maskedNumber', { last4: '4567' }));
    expect(maskNumber('X1234567')).not.toContain('123');
  });
});

describe('expiryField', () => {
  it('finds the expiry date and ignores a text field with the same key', () => {
    const date: ExtractedField = { key: 'expires', kind: 'date', value: '2030-01-01' };
    const text: ExtractedField = { ...date, kind: 'text' };
    expect(expiryField([text, date])).toBe(date);
    expect(expiryField([text])).toBeUndefined();
  });
});

describe('pageLine', () => {
  it('counts from one, and is empty without pages', () => {
    expect(pageLine(1, 3)).toBe(t('viewer.pageLine', { number: 2, count: 3 }));
    expect(pageLine(0, 0)).toBe('');
  });
});

describe('unreadableDetail', () => {
  it('explains a key that was not unlocked', () => {
    expect(unreadableDetail({ code: 'KEY_LOCKED' })).toBe(KEY_LOCKED_MESSAGE);
    expect(unreadableDetail({ code: 'KEY_INVALIDATED' })).toBe(KEY_INVALIDATED_MESSAGE);
  });

  it('leaves any other failure to the screen’s own text', () => {
    expect(unreadableDetail(new Error('file is not a database'))).toBeUndefined();
    expect(unreadableDetail(null)).toBeUndefined();
  });
});

describe('draftFromDocument and parseTags', () => {
  it('round-trips the tags through the comma-separated field', () => {
    const draft = draftFromDocument(doc());
    expect(draft).toEqual({
      title: 'Passport',
      category: DocumentCategory.ID,
      tags: 'travel, family',
    });
    expect(parseTags(draft.tags)).toEqual(['travel', 'family']);
  });

  it('drops empty tags and trims the rest', () => {
    expect(parseTags(' a ,, b ,')).toEqual(['a', 'b']);
    expect(parseTags('')).toEqual([]);
  });
});

describe('shareFileType and fileIcon', () => {
  it('describes a PDF and an image', () => {
    expect(shareFileType('pdf')).toEqual({ mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    expect(shareFileType('image')).toEqual({ mimeType: 'image/jpeg', UTI: 'public.jpeg' });
    expect(fileIcon('pdf')).toBe('pdf');
    expect(fileIcon('image')).toBe('image');
  });
});

describe('shareFileMeta', () => {
  it('counts at least one page and leaves out an unknown size', () => {
    const meta = shareFileMeta(doc({ fileSize: 0 }), 0);
    expect(meta).toBe(
      `${tp('format.pages', 1)}${t('format.separator')}${t('viewer.fileType.image')}`,
    );
  });
});

describe('detailsFooter', () => {
  it('ends with the encryption note and leaves out pages it does not have', () => {
    const footer = detailsFooter(doc({ fileSize: 0 }), 0);
    expect(footer.endsWith(t('viewer.encrypted'))).toBe(true);
    expect(footer).not.toContain(tp('format.pages', 0));
    expect(footer.split(t('format.separator'))).toHaveLength(2);
  });
});
