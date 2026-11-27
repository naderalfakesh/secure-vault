import { useEffect, useMemo, useState } from 'react';

import type { DocumentOrder, SnippetPiece } from '@/data/DocumentRepository';
import { documentService } from '@/services/DocumentService';
import type { Document } from '@/types';

import { SEARCH_DEBOUNCE_MS } from '../constants';
import type { SearchResults } from '../types';

export function useLibrarySearch(
  query: string,
  order: DocumentOrder,
  documents: readonly Document[],
) {
  const text = query.trim();
  const [found, setFound] = useState<SearchResults | null>(null);

  useEffect(() => {
    if (!text) return;
    let active = true;
    const timer = setTimeout(() => {
      documentService
        .searchWithSnippets(text, order)
        .then((hits) => {
          if (active) setFound({ query: text, order, hits });
        })
        .catch(() => {
          if (active) setFound({ query: text, order, hits: [] });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [text, order, documents]);

  const results = text && found?.query === text ? found : null;
  const snippets = useMemo(
    () =>
      new Map<string, SnippetPiece[] | null>(
        (results?.hits ?? []).map((hit) => [hit.document.id, hit.snippet]),
      ),
    [results],
  );

  return { searching: text.length > 0, text, results, snippets };
}
