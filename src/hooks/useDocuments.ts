import { useCallback } from 'react';

import { documentService } from '@/services/DocumentService';
import type { Document } from '@/types';

import { THUMBNAIL_CACHE_MAX_SIZE } from './documents/constants';
import { rememberThumbnail } from './documents/helpers';
import { thumbnailCache } from './documents/thumbnailCache';
import type { UseDocumentsReturn } from './documents/types';
import { useDocumentList } from './documents/useDocumentList';
import { useDocumentMutations } from './documents/useDocumentMutations';

export function useDocuments(): UseDocumentsReturn {
  const {
    documents,
    setDocuments,
    loading,
    error,
    refreshDocuments,
    filterByCategory,
    selectedCategory,
  } = useDocumentList();
  const { addDocument, updateDocument, deleteDocument } = useDocumentMutations(
    documents,
    setDocuments,
    refreshDocuments,
  );

  const getDocumentFile = useCallback(async (id: string): Promise<string | null> => {
    return documentService.getDocumentFile(id);
  }, []);

  const getDocumentThumbnail = useCallback(async (id: string): Promise<string | null> => {
    // Check cache first
    if (thumbnailCache.has(id)) {
      return thumbnailCache.get(id) || null;
    }

    const thumbnail = await documentService.getDocumentThumbnail(id);

    if (thumbnail) rememberThumbnail(thumbnailCache, id, thumbnail, THUMBNAIL_CACHE_MAX_SIZE);

    return thumbnail;
  }, []);

  const clearThumbnailCache = useCallback(() => {
    thumbnailCache.clear();
  }, []);

  const searchDocuments = useCallback(
    async (query: string): Promise<Document[]> => {
      if (!query.trim()) {
        return documents;
      }
      return documentService.searchDocuments(query);
    },
    [documents],
  );

  return {
    documents,
    loading,
    error,
    refreshDocuments,
    addDocument,
    updateDocument,
    deleteDocument,
    getDocumentFile,
    getDocumentThumbnail,
    searchDocuments,
    filterByCategory,
    selectedCategory,
    clearThumbnailCache,
  };
}

export default useDocuments;
