import { type Document, DocumentCategory } from '@/types';

import { isEmptiedVault, rememberThumbnail, withoutDocument, withUpdate } from '../helpers';

function doc(id: string, title: string): Document {
  return {
    id,
    title,
    category: DocumentCategory.OTHER,
    tags: [],
    thumbnailKey: `thumb_${id}`,
    fileKey: `file_${id}`,
    fileType: 'image',
    fileSize: 1,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

describe('isEmptiedVault', () => {
  it('recognises only the VAULT_EMPTIED code', () => {
    expect(isEmptiedVault({ code: 'VAULT_EMPTIED' })).toBe(true);
    expect(isEmptiedVault(new Error('VAULT_EMPTIED'))).toBe(false);
    expect(isEmptiedVault(null)).toBe(false);
  });
});

describe('optimistic list changes', () => {
  const list = [doc('a', 'A'), doc('b', 'B')];

  it('applies an update to one document only', () => {
    const next = withUpdate(list, 'b', { title: 'Passport' });
    expect(next.map((d) => d.title)).toEqual(['A', 'Passport']);
    expect(next[0]).toBe(list[0]);
    expect(list[1]?.title).toBe('B');
  });

  it('drops a deleted document', () => {
    expect(withoutDocument(list, 'a').map((d) => d.id)).toEqual(['b']);
    expect(withoutDocument(list, 'x')).toEqual(list);
  });
});

describe('rememberThumbnail', () => {
  it('drops the oldest entry once the cache is full', () => {
    const cache = new Map([
      ['a', 'uri-a'],
      ['b', 'uri-b'],
    ]);
    rememberThumbnail(cache, 'c', 'uri-c', 2);
    expect([...cache.keys()]).toEqual(['b', 'c']);
    rememberThumbnail(cache, 'd', 'uri-d', 5);
    expect([...cache.keys()]).toEqual(['b', 'c', 'd']);
  });
});
