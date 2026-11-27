import type { Document, DocumentCategory, ExtractedField, FileType } from '@/types';

export type { ExtractedField };

export type DocumentRow = {
  id: string;
  title: string;
  category: DocumentCategory;
  file_type: FileType;
  file_key: string;
  thumbnail_key: string;
  file_size: number;
  ocr_text: string | null;
  created_at: string;
  updated_at: string;
  tags: string | null;
};

export type NewDocument = Omit<Document, 'updatedAt'> & { updatedAt?: string };

// Title A-Z is sorted in JS because SQLite collations only fold ASCII.
export type DocumentOrder = 'newest' | 'oldest' | 'expiry';

export type SnippetPiece = { text: string; match?: boolean };

export type SearchHit = { document: Document; snippet: SnippetPiece[] | null };
