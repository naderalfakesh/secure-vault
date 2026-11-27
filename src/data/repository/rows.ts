import { FIELD_KEYS } from '@/types';
import type { Document } from '@/types';

import type { SqlValue } from '../sql';
import type { DocumentOrder, DocumentRow } from './types';

export type DocumentChanges = Partial<Pick<Document, 'title' | 'category' | 'tags' | 'ocrText'>>;

export const EXPIRY_JOIN = `LEFT JOIN fields expiry ON expiry.document_id = d.id AND expiry.key = '${FIELD_KEYS.expires}' AND expiry.kind = 'date'`;

export const ORDER_BY: Record<DocumentOrder, string> = {
  newest: 'd.created_at DESC',
  oldest: 'd.created_at ASC',
  expiry: 'expiry.value IS NULL, expiry.value ASC, d.created_at DESC',
};

// ASCII unit separator lets tags contain commas.
const TAG_SEPARATOR = String.fromCharCode(31);

export const COLUMNS = `d.*, (SELECT group_concat(tag, char(31)) FROM (SELECT tag FROM tags WHERE document_id = d.id ORDER BY rowid)) AS tags`;

export function toDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    tags: row.tags ? row.tags.split(TAG_SEPARATOR) : [],
    ocrText: row.ocr_text ?? undefined,
    thumbnailKey: row.thumbnail_key,
    fileKey: row.file_key,
    fileType: row.file_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildDocumentUpdate(
  id: string,
  changes: DocumentChanges,
  updatedAt: string,
): { sql: string; params: SqlValue[] } {
  const columns: string[] = [];
  const values: SqlValue[] = [];
  if (changes.title !== undefined) {
    columns.push('title = ?');
    values.push(changes.title);
  }
  if (changes.category !== undefined) {
    columns.push('category = ?');
    values.push(changes.category);
  }
  if (changes.ocrText !== undefined) {
    columns.push('ocr_text = ?');
    values.push(changes.ocrText);
  }
  return {
    sql: `UPDATE documents SET ${[...columns, 'updated_at = ?'].join(', ')} WHERE id = ?`,
    params: [...values, updatedAt, id],
  };
}

export function applyDocumentChanges(
  existing: Document,
  changes: DocumentChanges,
  updatedAt: string,
): Document {
  const next: Document = { ...existing, updatedAt };
  if (changes.title !== undefined) next.title = changes.title;
  if (changes.category !== undefined) next.category = changes.category;
  if (changes.tags !== undefined) next.tags = changes.tags;
  if (changes.ocrText !== undefined) next.ocrText = changes.ocrText;
  return next;
}
