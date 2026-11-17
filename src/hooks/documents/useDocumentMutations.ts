import { type Dispatch, type SetStateAction, useCallback, useRef } from 'react';

import { documentService } from '@/services/DocumentService';
import type { Document, PickedFile } from '@/types';

import { withoutDocument, withUpdate } from './helpers';
import { thumbnailCache } from './thumbnailCache';

/** Adds, and optimistically updates or deletes, documents in `documents`, rolling back on failure. */
export function useDocumentMutations(
  documents: Document[],
  setDocuments: Dispatch<SetStateAction<Document[]>>,
  refreshDocuments: () => Promise<void>,
) {
  const previousDocumentsRef = useRef<Document[]>([]);

  const addDocument = useCallback(
    async (file: PickedFile, metadata: Partial<Document>): Promise<Document> => {
      const doc = await documentService.addDocument(file, metadata);
      await refreshDocuments();
      return doc;
    },
    [refreshDocuments],
  );

  const updateDocument = useCallback(
    async (id: string, updates: Partial<Document>): Promise<Document | null> => {
      // Optimistic update
      const previousDocs = [...documents];
      previousDocumentsRef.current = previousDocs;

      setDocuments((prev) => withUpdate(prev, id, updates));

      try {
        const doc = await documentService.updateDocument(id, updates);
        if (!doc) {
          // Rollback on failure
          setDocuments(previousDocs);
        }
        return doc;
      } catch (e) {
        // Rollback on error
        setDocuments(previousDocs);
        throw e;
      }
    },
    [documents, setDocuments],
  );

  const deleteDocument = useCallback(
    async (id: string): Promise<boolean> => {
      // Optimistic delete
      const previousDocs = [...documents];
      previousDocumentsRef.current = previousDocs;

      setDocuments((prev) => withoutDocument(prev, id));

      // Clear thumbnail from cache
      thumbnailCache.delete(id);

      try {
        const success = await documentService.deleteDocument(id);
        if (!success) {
          // Rollback on failure
          setDocuments(previousDocs);
        }
        return success;
      } catch (e) {
        // Rollback on error
        setDocuments(previousDocs);
        throw e;
      }
    },
    [documents, setDocuments],
  );

  return { addDocument, updateDocument, deleteDocument };
}
