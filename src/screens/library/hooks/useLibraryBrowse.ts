import { useCallback, useState } from 'react';

import {
  isFiltering,
  type LibraryFilter,
  NO_FILTER,
  type SortOrder,
} from '@/features/documents/library';
import type { DocumentCategory } from '@/types';

import type { LibrarySheet } from '../types';

/** What the person is looking at: the query, filter, sort and open sheet. */
export function useLibraryBrowse() {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  // "See all" or a collection tile opens the list without a query.
  const [browsing, setBrowsing] = useState(false);
  const [filter, setFilter] = useState<LibraryFilter>(NO_FILTER);
  const [sort, setSort] = useState<SortOrder>('newest');
  const [sheet, setSheet] = useState<LibrarySheet>(null);

  const leaveList = useCallback(() => {
    setQuery('');
    setBrowsing(false);
    setFilter(NO_FILTER);
    setFocused(false);
  }, []);

  const browse = useCallback((collections: DocumentCategory[] = []) => {
    setBrowsing(true);
    setFilter({ collections, onlyWithExpiry: false });
  }, []);

  const closeSheet = useCallback(() => setSheet(null), []);
  const openSortSheet = useCallback(() => setSheet('sort'), []);
  const openMoveSheet = useCallback(() => setSheet('move'), []);

  /** Search, a collection or "See all" replace the home sections with a list. */
  const listing = focused || query.trim().length > 0 || browsing || isFiltering(filter);

  return {
    query,
    setQuery,
    focused,
    setFocused,
    filter,
    setFilter,
    sort,
    setSort,
    sheet,
    closeSheet,
    openSortSheet,
    openMoveSheet,
    listing,
    leaveList,
    browse,
  };
}
