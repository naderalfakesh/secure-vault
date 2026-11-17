import { NO_FILTER } from '@/features/documents/library';
import { type Document, DocumentCategory } from '@/types';

import {
  expiringDocuments,
  noMatchesTitle,
  presentIds,
  railCutoff,
  selectionBarBottom,
  soleCollection,
  toggleCollection,
  toggleId,
  visibleDocuments,
} from '../helpers';

function doc(id: string, title: string, category = DocumentCategory.OTHER): Document {
  return {
    id,
    title,
    category,
    tags: [],
    thumbnailKey: 't',
    fileKey: 'f',
    fileType: 'image',
    fileSize: 1,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  };
}

const lease = doc('a', 'lease', DocumentCategory.LEGAL);
const passport = doc('b', 'Passport', DocumentCategory.ID);
const invoice = doc('c', 'Dentist invoice', DocumentCategory.RECEIPTS);
const all = [lease, passport, invoice];

describe('library screen helpers', () => {
  it('puts the rail cutoff ninety days out', () => {
    expect(railCutoff(Date.UTC(2026, 10, 18))).toBe('2027-02-16');
  });

  it('keeps documents expiring by the cutoff, soonest first', () => {
    const expiry = new Map([
      [lease.id, '2027-01-20'],
      [passport.id, '2026-12-01'],
      [invoice.id, '2030-01-01'],
    ]);
    expect(expiringDocuments(all, expiry, '2027-02-16')).toEqual([passport, lease]);
  });

  it('drops ids that left the vault', () => {
    expect(presentIds(['a', 'gone'], all)).toEqual(new Set(['a']));
  });

  it('shows only documents still in the vault, sorted by title on request', () => {
    const stale = doc('gone', 'Gone');
    expect(visibleDocuments([invoice, stale, lease], all, NO_FILTER, new Map(), 'title')).toEqual([
      invoice,
      lease,
    ]);
  });

  it('toggles an id', () => {
    expect(toggleId(new Set(['a']), 'a')).toEqual(new Set());
    expect(toggleId(new Set(['a']), 'b')).toEqual(new Set(['a', 'b']));
  });

  it('picks one collection from the chip row, and clears it on a second tap', () => {
    const chosen = soleCollection(NO_FILTER, DocumentCategory.ID);
    expect(chosen.collections).toEqual([DocumentCategory.ID]);
    expect(soleCollection(chosen, DocumentCategory.ID).collections).toEqual([]);
  });

  it('adds up collections in the sort sheet', () => {
    const one = toggleCollection(NO_FILTER, DocumentCategory.ID);
    const two = toggleCollection(one, DocumentCategory.LEGAL);
    expect(two.collections).toEqual([DocumentCategory.ID, DocumentCategory.LEGAL]);
    expect(toggleCollection(two, DocumentCategory.ID).collections).toEqual([
      DocumentCategory.LEGAL,
    ]);
  });

  it('names the search and the scope when nothing matches', () => {
    expect(noMatchesTitle('', null)).toBe('No documents');
    expect(noMatchesTitle('visa', null)).toContain('visa');
  });

  it('keeps the selection bar above the home indicator', () => {
    expect(selectionBarBottom(34)).toBeGreaterThan(selectionBarBottom(0));
  });
});
