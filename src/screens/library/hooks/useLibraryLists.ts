import { useMemo } from 'react';

import type { SearchHit } from '@/data/DocumentRepository';
import {
  countByCollection,
  type ExpiryDates,
  type LibraryFilter,
  recentDocuments,
  type SortOrder,
} from '@/features/documents/library';
import type { Document } from '@/types';

import { expiringDocuments, visibleDocuments } from '../helpers';

type Sources = {
  documents: readonly Document[];
  expiry: ExpiryDates;
  railCutoff: string;
  hits: readonly SearchHit[] | null;
  ordered: readonly Document[] | null;
  filter: LibraryFilter;
  sort: SortOrder;
};

export function useLibraryLists({
  documents,
  expiry,
  railCutoff,
  hits,
  ordered,
  filter,
  sort,
}: Sources) {
  const counts = useMemo(() => countByCollection(documents), [documents]);
  const recent = useMemo(() => recentDocuments(documents), [documents]);
  const expiring = useMemo(
    () => expiringDocuments(documents, expiry, railCutoff),
    [documents, expiry, railCutoff],
  );
  const shown = useMemo(() => {
    const base = hits ? hits.map((hit) => hit.document) : (ordered ?? documents);
    return visibleDocuments(base, documents, filter, expiry, sort);
  }, [hits, ordered, documents, filter, expiry, sort]);

  return { counts, recent, expiring, shown };
}
