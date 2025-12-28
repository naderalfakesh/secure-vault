import { useState, useEffect, useCallback } from 'react';
import { documentService } from '../services/DocumentService';
import { Document, DocumentCategory, PickedFile } from '../types';

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
}

export function useDocuments(): UseDocumentsReturn {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | null>(null);

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
      const doc = await documentService.updateDocument(id, updates);
      if (doc) {
        await refreshDocuments();
      }
      return doc;
    },
    [refreshDocuments]
  );

  const deleteDocument = useCallback(
    async (id: string): Promise<boolean> => {
      const success = await documentService.deleteDocument(id);
      if (success) {
        await refreshDocuments();
      }
      return success;
    },
    [refreshDocuments]
  );

  const getDocumentFile = useCallback(async (id: string): Promise<string | null> => {
    return documentService.getDocumentFile(id);
  }, []);

  const getDocumentThumbnail = useCallback(async (id: string): Promise<string | null> => {
    return documentService.getDocumentThumbnail(id);
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
  };
}

export default useDocuments;
