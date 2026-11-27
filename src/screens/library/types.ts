import type { DocumentOrder, SearchHit } from '@/data/DocumentRepository';

export type LibrarySheet = 'sort' | 'move' | null;

export type SearchResults = {
  query: string;
  order: DocumentOrder;
  hits: SearchHit[];
};
