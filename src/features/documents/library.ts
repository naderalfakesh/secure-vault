import type { DocumentOrder } from '@/data/DocumentRepository';
import { t, tp } from '@/i18n';
import type { Document, DocumentCategory } from '@/types';
import { formatRelativeDate, joinParts } from '@/utils/format';

import { allCategories, categoryLabel } from './categories';

const RECENT_LIMIT = 5;
export const EXPIRING_WINDOW_DAYS = 90;

export type SortOrder = 'newest' | 'oldest' | 'title' | 'expiry';

export function sortLabel(order: SortOrder): string {
  return t(`library.sort.${order}`);
}

export function sortButtonLabel(order: SortOrder): string {
  return t(`library.sortButton.${order}`);
}

export type LibraryFilter = {
  collections: readonly DocumentCategory[];
  onlyWithExpiry: boolean;
};

export const NO_FILTER: LibraryFilter = { collections: [], onlyWithExpiry: false };

export function isFiltering(filter: LibraryFilter): boolean {
  return filter.collections.length > 0 || filter.onlyWithExpiry;
}

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

// SQLite cannot collate non-ASCII titles; re-sort in JS with localeCompare.
export function sortByTitle(documents: readonly Document[]): Document[] {
  return [...documents].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
  );
}

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

export function documentMeta(document: Document, now: Date = new Date()): string {
  return joinParts([
    categoryLabel(document.category),
    document.fileType === 'pdf' ? t('library.meta.pdf') : null,
    formatRelativeDate(document.updatedAt, now),
  ]);
}

export function resultLine(count: number, searching: boolean, filter: LibraryFilter): string {
  const noun = searching ? tp('library.results', count) : tp('format.documents', count);
  const scope = collectionScope(filter.collections);
  return scope ? t('library.resultsIn', { count: noun, scope }) : noun;
}

export function collectionScope(collections: readonly DocumentCategory[]): string | null {
  if (collections.length === 0) return null;
  const names = collections.map(categoryLabel);
  const last = names.at(-1);
  if (last === undefined) return null;
  if (names.length === 1) return last;
  return t('library.scope.list', {
    names: names.slice(0, -1).join(t('library.scope.join')),
    last,
  });
}
