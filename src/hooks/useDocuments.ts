import { useState, useEffect, useCallback, useRef } from 'react';
import { documentService } from '../services/DocumentService';
import { Document, DocumentCategory, PickedFile } from '../types';

// In-memory thumbnail cache for performance
const thumbnailCache = new Map<string, string>();
const CACHE_MAX_SIZE = 50;

interface UseDocumentsReturn {
  documents: Document[];
  loading: boolean;
  error: string | null;
  refreshDocuments: () => Promise<void>;
  addDocument: (file: PickedFile, metadata: Partial<Document>) => Promise<Document>;
  updateDocument: (id: string, updates: Partial<Document>) => Promise<Document | null>;
  deleteDocument: (id: string) => Promise<boolean>;
  getDocumentFile: (id: string) => Promise<string | null>;
  getDocumentThumbnail: (id: string) => Promise<string | null>;
  searchDocuments: (query: string) => Promise<Document[]>;
  filterByCategory: (category: DocumentCategory | null) => void;
  selectedCategory: DocumentCategory | null;
  clearThumbnailCache: () => void;
}

export function useDocuments(): UseDocumentsReturn {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | null>(null);
  const previousDocumentsRef = useRef<Document[]>([]);

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
      setError(e.message || 'Failed to load documents');
      console.error('Failed to load documents:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    refreshDocuments();
  }, [refreshDocuments]);

  const addDocument = useCallback(
    async (file: PickedFile, metadata: Partial<Document>): Promise<Document> => {
      const doc = await documentService.addDocument(file, metadata);
      await refreshDocuments();
      return doc;
    },
    [refreshDocuments]
  );

  const updateDocument = useCallback(
    async (id: string, updates: Partial<Document>): Promise<Document | null> => {
      // Optimistic update
      const previousDocs = [...documents];
      previousDocumentsRef.current = previousDocs;

      setDocuments((prev) =>
        prev.map((doc) => (doc.id === id ? { ...doc, ...updates } : doc))
      );

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
    [documents]
  );

  const deleteDocument = useCallback(
    async (id: string): Promise<boolean> => {
      // Optimistic delete
      const previousDocs = [...documents];
      previousDocumentsRef.current = previousDocs;

      setDocuments((prev) => prev.filter((doc) => doc.id !== id));

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
    [documents]
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

    if (thumbnail) {
      // Manage cache size
      if (thumbnailCache.size >= CACHE_MAX_SIZE) {
        const firstKey = thumbnailCache.keys().next().value;
        if (firstKey) {
          thumbnailCache.delete(firstKey);
        }
      }
      thumbnailCache.set(id, thumbnail);
    }

    return thumbnail;
  }, []);

  const clearThumbnailCache = useCallback(() => {
    thumbnailCache.clear();
  }, []);

  const searchDocuments = useCallback(async (query: string): Promise<Document[]> => {
    if (!query.trim()) {
      return documents;
    }
    return documentService.searchDocuments(query);
  }, [documents]);

  const filterByCategory = useCallback((category: DocumentCategory | null) => {
    setSelectedCategory(category);
  }, []);

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
