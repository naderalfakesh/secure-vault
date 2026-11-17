import { TAB_BAR_BOTTOM, TAB_BAR_HEIGHT } from '@/components/ui';
import {
  applyFilter,
  EXPIRING_WINDOW_DAYS,
  type ExpiryDates,
  type LibraryFilter,
  type SortOrder,
  sortByTitle,
} from '@/features/documents/library';
import { t } from '@/i18n';
import type { Document, DocumentCategory } from '@/types';
import { isolate } from '@/utils/bidi';

import { DAY_MS, LIST_BOTTOM_GAP } from './constants';

/** The last expiry day (ISO date) that goes on the Expiring soon rail. */
export function railCutoff(now: number = Date.now()): string {
  return new Date(now + EXPIRING_WINDOW_DAYS * DAY_MS).toISOString().slice(0, 10);
}

/** Documents expiring by `cutoff`, soonest first. */
export function expiringDocuments(
  documents: readonly Document[],
  expiry: ExpiryDates,
  cutoff: string,
): Document[] {
  return documents
    .filter((document) => (expiry.get(document.id) ?? '9999') <= cutoff)
    .sort((a, b) => (expiry.get(a.id) ?? '').localeCompare(expiry.get(b.id) ?? ''));
}

/** The ids in `ids` that still belong to a document in the vault. */
export function presentIds(ids: Iterable<string>, documents: readonly Document[]): Set<string> {
  const present = new Set(documents.map((document) => document.id));
  return new Set([...ids].filter((id) => present.has(id)));
}

/**
 * The list the Library shows: `base` without documents that have since left
 * the vault, filtered, and sorted by title when the index cannot sort.
 */
export function visibleDocuments(
  base: readonly Document[],
  documents: readonly Document[],
  filter: LibraryFilter,
  expiry: ExpiryDates,
  sort: SortOrder,
): Document[] {
  const present = new Set(documents.map((document) => document.id));
  const filtered = applyFilter(
    base.filter((document) => present.has(document.id)),
    filter,
    expiry,
  );
  return sort === 'title' ? sortByTitle(filtered) : filtered;
}

/** Adds `id` to the set, or takes it out. */
export function toggleId(ids: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(ids);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** The chip row: one collection at a time; tapping the chosen one clears it. */
export function soleCollection(filter: LibraryFilter, category: DocumentCategory): LibraryFilter {
  const chosen = filter.collections.length === 1 && filter.collections[0] === category;
  return { ...filter, collections: chosen ? [] : [category] };
}

/** The sort sheet: collections add up. */
export function toggleCollection(filter: LibraryFilter, category: DocumentCategory): LibraryFilter {
  const on = filter.collections.includes(category);
  return {
    ...filter,
    collections: on
      ? filter.collections.filter((value) => value !== category)
      : [...filter.collections, category],
  };
}

/** The empty list's title: what was searched for, and where. */
export function noMatchesTitle(query: string, scope: string | null): string {
  if (query) {
    return t(scope ? 'library.noMatchesIn' : 'library.noMatches', {
      query: isolate(query),
      scope: scope ?? '',
    });
  }
  return scope ? t('library.noDocumentsIn', { scope }) : t('library.noDocuments');
}

/** Space under the list so its last row clears the floating tab bar. */
export function listBottomSpace(insetBottom: number): number {
  return TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + insetBottom + LIST_BOTTOM_GAP;
}

/** The selection bar sits where the tab bar was. */
export function selectionBarBottom(insetBottom: number): number {
  return insetBottom > 0 ? Math.max(TAB_BAR_BOTTOM, insetBottom - 8) : TAB_BAR_BOTTOM / 2;
}
