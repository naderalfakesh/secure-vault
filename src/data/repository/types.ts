import type { Document, DocumentCategory, ExtractedField, FileType } from '@/types';

export type { ExtractedField };

/** A `documents` row as SQLite returns it, with the tags folded into one column. */
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

/**
 * Orders the index can sort by. Title A–Z is sorted by the caller: SQLite's
 * collations only fold ASCII, and titles are in any script.
 */
export type DocumentOrder = 'newest' | 'oldest' | 'expiry';

/** A piece of a search snippet; `match` pieces are the words the query found. */
export type SnippetPiece = { text: string; match?: boolean };

/** A search result with a window of its page text around the match, if the text matched. */
export type SearchHit = { document: Document; snippet: SnippetPiece[] | null };
