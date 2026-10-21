import type { SnippetPart } from '@/components/ui';
import type { Document, DocumentCategory } from '@/types';
import { formatRelativeDate } from '@/utils/format';

import { allCategories, categoryLabel } from './categories';

/** Recent: the five most recently updated documents (handover §11.13). */
export const RECENT_LIMIT = 5;
/** The Expiring soon rail looks this far ahead. */
export const EXPIRING_WINDOW_DAYS = 90;

export type SortOrder = 'newest' | 'oldest' | 'title' | 'expiry';

export const SORT_LABELS: Record<SortOrder, string> = {
  newest: 'Newest added',
  oldest: 'Oldest added',
  title: 'Title A–Z',
  expiry: 'Expiry date, soonest',
};

/** The short label on the sort button above the results. */
export const SORT_BUTTON_LABELS: Record<SortOrder, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  title: 'Title A–Z',
  expiry: 'Expiring first',
};

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

export function sortDocuments(
  documents: readonly Document[],
  order: SortOrder,
  expiry: ExpiryDates,
): Document[] {
  const sorted = [...documents];
  switch (order) {
    case 'oldest':
      return sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case 'title':
      return sorted.sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
      );
    case 'expiry':
      // Documents without a date go last, newest first among themselves.
      return sorted.sort((a, b) => {
        const left = expiry.get(a.id);
        const right = expiry.get(b.id);
        if (left && right) return left.localeCompare(right);
        if (left) return -1;
        if (right) return 1;
        return b.createdAt.localeCompare(a.createdAt);
      });
    default:
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
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
  return [
    categoryLabel(document.category),
    document.fileType === 'pdf' ? 'PDF' : null,
    formatRelativeDate(document.updatedAt, now),
  ]
    .filter(Boolean)
    .join(' · ');
}

const SNIPPET_CONTEXT = 32;

/**
 * The first place the query's first word shows in the text read from the
 * pages, with some context either side and the match marked. Titles and tags
 * are already on the row, so only the page text gets a snippet.
 */
export function findSnippet(text: string | undefined, query: string): SnippetPart[] | undefined {
  const word = query.trim().split(/\s+/)[0];
  if (!text || !word) return undefined;
  const at = text.toLocaleLowerCase().indexOf(word.toLocaleLowerCase());
  if (at < 0) return undefined;
  const start = Math.max(0, at - SNIPPET_CONTEXT);
  const end = Math.min(text.length, at + word.length + SNIPPET_CONTEXT);
  const clean = (part: string) => part.replace(/\s+/g, ' ');
  return [
    { text: `${start > 0 ? '…' : ''}${clean(text.slice(start, at)).trimStart()}` },
    { text: text.slice(at, at + word.length), match: true },
    {
      text: `${clean(text.slice(at + word.length, end)).trimEnd()}${end < text.length ? '…' : ''}`,
    },
  ];
}

/** "3 results in Legal", "12 documents", "1 result in Legal and Finance". */
export function resultLine(count: number, searching: boolean, filter: LibraryFilter): string {
  const noun = searching
    ? `${count} ${count === 1 ? 'result' : 'results'}`
    : `${count} ${count === 1 ? 'document' : 'documents'}`;
  const scope = collectionScope(filter.collections);
  return scope ? `${noun} in ${scope}` : noun;
}

export function collectionScope(collections: readonly DocumentCategory[]): string | null {
  if (collections.length === 0) return null;
  const names = collections.map(categoryLabel);
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
