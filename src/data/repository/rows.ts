import { FIELD_KEYS } from '@/types';
import type { Document } from '@/types';

import type { DocumentOrder, DocumentRow } from './types';

// The expiry date, when the document has one, for sorting.
export const EXPIRY_JOIN = `LEFT JOIN fields expiry ON expiry.document_id = d.id AND expiry.key = '${FIELD_KEYS.expires}' AND expiry.kind = 'date'`;

export const ORDER_BY: Record<DocumentOrder, string> = {
  newest: 'd.created_at DESC',
  oldest: 'd.created_at ASC',
  // Undated documents go last, newest first among themselves.
  expiry: 'expiry.value IS NULL, expiry.value ASC, d.created_at DESC',
};

// Tags are joined with the ASCII unit separator so a tag can contain commas.
const TAG_SEPARATOR = String.fromCharCode(31);

// Tags come back in insertion order, which is the order the user typed them.
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
