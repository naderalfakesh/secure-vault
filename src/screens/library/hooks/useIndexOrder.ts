import { useEffect, useState } from 'react';

import type { DocumentOrder } from '@/data/DocumentRepository';
import { documentService } from '@/services/DocumentService';
import type { Document } from '@/types';

export function useIndexOrder(order: DocumentOrder, documents: readonly Document[]) {
  const [ordered, setOrdered] = useState<{ order: DocumentOrder; documents: Document[] } | null>(
    null,
  );

  useEffect(() => {
    if (order === 'newest') return;
    let active = true;
    documentService
      .listDocuments(order)
      .then((list) => {
        if (active) setOrdered({ order, documents: list });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [order, documents]);

  return order !== 'newest' && ordered?.order === order ? ordered.documents : null;
}
