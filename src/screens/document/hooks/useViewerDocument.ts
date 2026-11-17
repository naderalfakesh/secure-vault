import { useEffect, useState } from 'react';

import type { ExtractedField } from '@/data/DocumentRepository';
import { documentService } from '@/services/DocumentService';
import type { Document } from '@/types';

import { unreadableDetail } from '../helpers';
import type { LoadFailure } from '../types';

/** Loads the document, its decrypted pages and its recognised fields. */
export function useViewerDocument(id: string | undefined) {
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<LoadFailure | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [fields, setFields] = useState<ExtractedField[]>([]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    documentService
      .initialize()
      .then(() => documentService.getDocument(id))
      .then(async (doc) => {
        if (!doc) {
          if (active) setFailure({ kind: 'missing' });
          return;
        }
        const [pageUris, extracted] = await Promise.all([
          documentService.getDocumentPages(id),
          documentService.getFields(id),
        ]);
        if (active) {
          setDocument(doc);
          setPages(pageUris);
          setFields(extracted);
        }
      })
      .catch((e: unknown) => {
        if (!active) return;
        setFailure({ kind: 'unreadable', detail: unreadableDetail(e) });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  return { document, setDocument, loading, failure, pages, fields };
}
