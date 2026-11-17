import { DocumentCategory } from '@/types';

import { toFtsQuery } from '../fts';
import { toDocument } from '../rows';
import { cutWords, parseSnippet } from '../snippet';

const START = String.fromCharCode(2);
const END = String.fromCharCode(3);

describe('parseSnippet', () => {
  it('gives null for no snippet or one without a match', () => {
    expect(parseSnippet(null)).toBeNull();
    expect(parseSnippet('')).toBeNull();
    expect(parseSnippet('…plain text only…')).toBeNull();
  });

  it('splits plain and matched pieces and folds whitespace', () => {
    expect(parseSnippet(`…the  ${START}passport${END} number\n12…`)).toEqual([
      { text: '…the ' },
      { text: 'passport', match: true },
      { text: ' number 12…' },
    ]);
  });

  it('drops a word cut at either end of the window when the source shows it', () => {
    const source = 'An ELECTRON-IC device with a passport chip inside the cover';
    const raw = `…IC device with a ${START}passport${END} chip inside the cov…`;
    expect(parseSnippet(raw, source)).toEqual([
      { text: '…device with a ' },
      { text: 'passport', match: true },
      { text: ' chip inside the…' },
    ]);
  });
});

describe('cutWords', () => {
  it('reports no cut without the source text', () => {
    expect(cutWords('…word…', null)).toEqual({ start: false, end: false });
  });

  it('reports a cut only where the source continues the word', () => {
    expect(cutWords('…on of…', 'action of')).toEqual({ start: true, end: false });
    expect(cutWords('…on of…', 'on offer')).toEqual({ start: false, end: true });
  });
});

describe('toDocument', () => {
  it('maps a row, splitting tags on the unit separator', () => {
    const row = {
      id: 'a',
      title: 'Passport',
      category: DocumentCategory.OTHER,
      file_type: 'image' as const,
      file_key: 'file_a',
      thumbnail_key: 'thumb_a',
      file_size: 10,
      ocr_text: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-02',
      tags: `travel${String.fromCharCode(31)}id, card`,
    };
    expect(toDocument(row)).toEqual({
      id: 'a',
      title: 'Passport',
      category: DocumentCategory.OTHER,
      tags: ['travel', 'id, card'],
      ocrText: undefined,
      thumbnailKey: 'thumb_a',
      fileKey: 'file_a',
      fileType: 'image',
      fileSize: 10,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-02',
    });
    expect(toDocument({ ...row, tags: null }).tags).toEqual([]);
  });
});

describe('toFtsQuery', () => {
  it('quotes each word as a prefix term and strips FTS syntax', () => {
    expect(toFtsQuery(' pass  "20*" ')).toBe('"pass"* AND "20"*');
    expect(toFtsQuery('   ')).toBe('');
  });
});
