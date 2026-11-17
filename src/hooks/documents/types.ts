import type { Document, DocumentCategory, PickedFile } from '@/types';

export interface UseDocumentsReturn {
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
