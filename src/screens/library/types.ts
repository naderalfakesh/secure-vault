import type { DocumentOrder, SearchHit } from '@/data/DocumentRepository';

/** The sheet over the Library, if any. */
export type LibrarySheet = 'sort' | 'move' | null;

/** The index's answer to one query in one order. */
export type SearchResults = {
  query: string;
  order: DocumentOrder;
  hits: SearchHit[];
};
