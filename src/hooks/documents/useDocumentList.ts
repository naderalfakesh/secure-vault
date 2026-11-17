import { useCallback, useEffect, useState } from 'react';

import { t } from '@/i18n';
import { documentService } from '@/services/DocumentService';
import type { Document, DocumentCategory } from '@/types';
import { plainErrorMessage } from '@/utils/errors';

import { isEmptiedVault } from './helpers';

/**
 * The document list, optionally filtered by category. It loads on mount and
 * reloads silently after any write the service reports.
 */
export function useDocumentList() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | null>(null);
  // Bumped by the service after any write, so the list below reloads silently.
  const [version, setVersion] = useState(0);

  useEffect(() => documentService.subscribe(() => setVersion((v) => v + 1)), []);

  const refreshDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await documentService.initialize();

      let docs: Document[];
      if (selectedCategory) {
        docs = await documentService.getDocumentsByCategory(selectedCategory);
      } else {
        docs = await documentService.getAllDocuments();
      }

      setDocuments(docs);
    } catch (e: any) {
      if (isEmptiedVault(e)) {
        setDocuments([]);
        return;
      }
      // No stale rows under a failed index: their files may be gone.
      setDocuments([]);
      setError(plainErrorMessage(e, t('library.loadFailed.fallback')));
      console.error('Failed to load documents:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    let active = true;
    documentService
      .initialize()
      .then(() =>
        selectedCategory
          ? documentService.getDocumentsByCategory(selectedCategory)
          : documentService.getAllDocuments(),
      )
      .then((docs) => {
        if (active) {
          setDocuments(docs);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!active) return;
        if (isEmptiedVault(e)) {
          setDocuments([]);
          setError(null);
        } else {
          // No stale rows under a failed index: their files may be gone.
          setDocuments([]);
          setError(plainErrorMessage(e, t('library.loadFailed.fallback')));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedCategory, version]);

  const filterByCategory = useCallback((category: DocumentCategory | null) => {
    setLoading(true);
    setSelectedCategory(category);
  }, []);

  return {
    documents,
    setDocuments,
    loading,
    error,
    refreshDocuments,
    filterByCategory,
    selectedCategory,
  };
}
