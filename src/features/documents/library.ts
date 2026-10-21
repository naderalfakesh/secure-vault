import type { DocumentOrder } from '@/data/DocumentRepository';
import { t, tp } from '@/i18n';
import type { Document, DocumentCategory } from '@/types';
import { formatRelativeDate, joinParts } from '@/utils/format';

import { allCategories, categoryLabel } from './categories';

/** Recent: the five most recently updated documents (handover §11.13). */
export const RECENT_LIMIT = 5;
/** The Expiring soon rail looks this far ahead. */
export const EXPIRING_WINDOW_DAYS = 90;

export type SortOrder = 'newest' | 'oldest' | 'title' | 'expiry';

/** A sort's name in the Sort and filter sheet. */
export function sortLabel(order: SortOrder): string {
  return t(`library.sort.${order}`);
}

/** The short label on the sort button above the results. */
export function sortButtonLabel(order: SortOrder): string {
  return t(`library.sortButton.${order}`);
}

export type LibraryFilter = {
  /** Empty means every collection. */
  collections: readonly DocumentCategory[];
  onlyWithExpiry: boolean;
};

export const NO_FILTER: LibraryFilter = { collections: [], onlyWithExpiry: false };

export function isFiltering(filter: LibraryFilter): boolean {
  return filter.collections.length > 0 || filter.onlyWithExpiry;
}

/** Expiry dates by document id, `YYYY-MM-DD`. */
export type ExpiryDates = ReadonlyMap<string, string>;

export function applyFilter(
  documents: readonly Document[],
  filter: LibraryFilter,
  expiry: ExpiryDates,
): Document[] {
  return documents.filter(
    (document) =>
      (filter.collections.length === 0 || filter.collections.includes(document.category)) &&
      (!filter.onlyWithExpiry || expiry.has(document.id)),
  );
}

/**
 * Title A–Z in the reader's language. The other orders come from the index
 * (`DocumentOrder`); SQLite cannot compare titles outside ASCII.
 */
export function sortByTitle(documents: readonly Document[]): Document[] {
  return [...documents].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
  );
}

/** The index order behind a sort; Title A–Z reads the newest-first list and re-sorts it. */
export function indexOrder(order: SortOrder): DocumentOrder {
  return order === 'title' ? 'newest' : order;
}

export function recentDocuments(documents: readonly Document[]): Document[] {
  return [...documents]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, RECENT_LIMIT);
}

export function countByCollection(
  documents: readonly Document[],
): Record<DocumentCategory, number> {
  const counts = {} as Record<DocumentCategory, number>;
  for (const category of allCategories) counts[category] = 0;
  for (const document of documents) counts[document.category] += 1;
  return counts;
}

/** "Legal · PDF · Yesterday". Page counts are not in the list query yet. */
export function documentMeta(document: Document, now: Date = new Date()): string {
  return joinParts([
    categoryLabel(document.category),
    document.fileType === 'pdf' ? t('library.meta.pdf') : null,
    formatRelativeDate(document.updatedAt, now),
  ]);
}

/** "3 results in Legal", "12 documents", "1 result in Legal and Finance". */
export function resultLine(count: number, searching: boolean, filter: LibraryFilter): string {
  const noun = searching ? tp('library.results', count) : tp('format.documents', count);
  const scope = collectionScope(filter.collections);
  return scope ? t('library.resultsIn', { count: noun, scope }) : noun;
}

export function collectionScope(collections: readonly DocumentCategory[]): string | null {
  if (collections.length === 0) return null;
  const names = collections.map(categoryLabel);
  if (names.length === 1) return names[0];
  return t('library.scope.list', {
    names: names.slice(0, -1).join(t('library.scope.join')),
    last: names[names.length - 1],
  });
}
