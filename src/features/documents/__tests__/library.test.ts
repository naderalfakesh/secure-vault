import { type Document, DocumentCategory } from '@/types';

import {
  applyFilter,
  documentMeta,
  findSnippet,
  recentDocuments,
  resultLine,
  sortDocuments,
} from '../library';

let counter = 0;
function doc(overrides: Partial<Document>): Document {
  counter += 1;
  return {
    id: `doc-${counter}`,
    title: `Document ${counter}`,
    category: DocumentCategory.OTHER,
    tags: [],
    thumbnailKey: 't',
    fileKey: 'f',
    fileType: 'image',
    fileSize: 1,
    createdAt: `2026-10-0${counter}T10:00:00.000Z`,
    updatedAt: `2026-10-0${counter}T10:00:00.000Z`,
    ...overrides,
  };
}

describe('library logic', () => {
  const lease = doc({ title: 'lease', category: DocumentCategory.LEGAL });
  const passport = doc({ title: 'Passport', category: DocumentCategory.ID });
  const invoice = doc({ title: 'Dentist invoice', category: DocumentCategory.RECEIPTS });
  const all = [lease, passport, invoice];
  const expiry = new Map([[passport.id, '2027-01-03']]);

  it('filters by collections and by having an expiry date', () => {
    expect(
      applyFilter(all, { collections: [DocumentCategory.LEGAL], onlyWithExpiry: false }, expiry),
    ).toEqual([lease]);
    expect(applyFilter(all, { collections: [], onlyWithExpiry: true }, expiry)).toEqual([passport]);
  });

  it('sorts every way the sheet offers', () => {
    expect(sortDocuments(all, 'newest', expiry).map((d) => d.id)).toEqual([
      invoice.id,
      passport.id,
      lease.id,
    ]);
    expect(sortDocuments(all, 'oldest', expiry)[0]).toBe(lease);
    expect(sortDocuments(all, 'title', expiry).map((d) => d.title)).toEqual([
      'Dentist invoice',
      'lease',
      'Passport',
    ]);
    expect(sortDocuments(all, 'expiry', expiry)[0]).toBe(passport);
  });

  it('keeps the five most recently updated as Recent', () => {
    const many = Array.from({ length: 7 }, (_, index) =>
      doc({ updatedAt: `2026-09-1${index}T00:00:00.000Z` }),
    );
    const recent = recentDocuments(many);
    expect(recent).toHaveLength(5);
    expect(recent[0]).toBe(many[6]);
  });

  it('marks the first match in the page text', () => {
    const parts = findSnippet('The lease term begins on 1 March 2026 and runs a year.', 'Lease');
    expect(parts?.find((part) => part.match)?.text).toBe('lease');
    expect(parts?.map((part) => part.text).join('')).toContain('The lease term begins');
    expect(findSnippet('Nothing here', 'visa')).toBeUndefined();
    expect(findSnippet(undefined, 'visa')).toBeUndefined();
  });

  it('words the count line and the row meta', () => {
    expect(
      resultLine(3, true, { collections: [DocumentCategory.LEGAL], onlyWithExpiry: false }),
    ).toBe('3 results in Legal');
    expect(resultLine(1, false, { collections: [], onlyWithExpiry: false })).toBe('1 document');
    expect(
      documentMeta(
        { ...lease, fileType: 'pdf', updatedAt: '2026-10-20T09:00:00.000Z' },
        new Date('2026-10-21T12:00:00.000Z'),
      ),
    ).toBe('Legal · PDF · Yesterday');
  });
});
