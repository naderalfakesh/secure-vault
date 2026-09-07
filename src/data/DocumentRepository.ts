import type { Document, DocumentCategory, FileType } from '@/types';

import type { SqlDatabase, SqlValue } from './sql';

type DocumentRow = {
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

export type ExtractedField = { key: string; value: string; kind: 'text' | 'date' | 'number' };

export type NewDocument = Omit<Document, 'updatedAt'> & { updatedAt?: string };

// Tags are joined with the ASCII unit separator so a tag can contain commas.
const TAG_SEPARATOR = String.fromCharCode(31);

// Tags come back in insertion order, which is the order the user typed them.
const COLUMNS = `d.*, (SELECT group_concat(tag, char(31)) FROM (SELECT tag FROM tags WHERE document_id = d.id ORDER BY rowid)) AS tags`;

function toDocument(row: DocumentRow): Document {
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

/**
 * Turns free text into an FTS5 query: each word becomes a quoted prefix term
 * joined with AND, so "pass 20" matches "Passport 2030" and user input can
 * never change the query's structure.
 */
export function toFtsQuery(input: string): string {
  return input
    .split(/\s+/)
    .map((term) => term.replace(/["*]/g, '').trim())
    .filter(Boolean)
    .map((term) => `"${term}"*`)
    .join(' AND ');
}

/**
 * All index reads and writes for documents. File bytes never pass through
 * here; the vault module owns those under the keys stored in each row.
 */
export class DocumentRepository {
  constructor(private readonly db: SqlDatabase) {}

  async list(category?: DocumentCategory | null): Promise<Document[]> {
    const rows = category
      ? await this.db.all<DocumentRow>(
          `SELECT ${COLUMNS} FROM documents d WHERE d.category = ? ORDER BY d.created_at DESC`,
          [category],
        )
      : await this.db.all<DocumentRow>(
          `SELECT ${COLUMNS} FROM documents d ORDER BY d.created_at DESC`,
        );
    return rows.map(toDocument);
  }

  async recent(limit: number): Promise<Document[]> {
    const rows = await this.db.all<DocumentRow>(
      `SELECT ${COLUMNS} FROM documents d ORDER BY d.updated_at DESC LIMIT ?`,
      [limit],
    );
    return rows.map(toDocument);
  }

  async get(id: string): Promise<Document | null> {
    const row = await this.db.first<DocumentRow>(
      `SELECT ${COLUMNS} FROM documents d WHERE d.id = ?`,
      [id],
    );
    return row ? toDocument(row) : null;
  }

  async count(): Promise<number> {
    const row = await this.db.first<{ n: number }>('SELECT count(*) AS n FROM documents');
    return row?.n ?? 0;
  }

  async countByCategory(): Promise<Partial<Record<DocumentCategory, number>>> {
    const rows = await this.db.all<{ category: DocumentCategory; n: number }>(
      'SELECT category, count(*) AS n FROM documents GROUP BY category',
    );
    const counts: Partial<Record<DocumentCategory, number>> = {};
    for (const row of rows) counts[row.category] = row.n;
    return counts;
  }

  async search(query: string): Promise<Document[]> {
    const fts = toFtsQuery(query);
    if (!fts) return this.list();
    const rows = await this.db.all<DocumentRow>(
      `SELECT ${COLUMNS} FROM documents d
       WHERE d.id IN (SELECT id FROM documents_fts WHERE documents_fts MATCH ?)
       ORDER BY d.updated_at DESC`,
      [fts],
    );
    return rows.map(toDocument);
  }

  async insert(doc: NewDocument): Promise<Document> {
    const updatedAt = doc.updatedAt ?? doc.createdAt;
    await this.db.transaction(async () => {
      await this.db.run(
        `INSERT INTO documents (id, title, category, file_type, file_key, thumbnail_key, file_size, ocr_text, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          doc.id,
          doc.title,
          doc.category,
          doc.fileType,
          doc.fileKey,
          doc.thumbnailKey,
          doc.fileSize,
          doc.ocrText ?? null,
          doc.createdAt,
          updatedAt,
        ],
      );
      await this.writeTags(doc.id, doc.tags);
      await this.reindex(doc.id);
    });
    return { ...doc, updatedAt };
  }

  async update(
    id: string,
    changes: Partial<Pick<Document, 'title' | 'category' | 'tags' | 'ocrText'>>,
  ): Promise<Document | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    const next: Document = { ...existing, ...changes, updatedAt: new Date().toISOString() };
    await this.db.transaction(async () => {
      await this.db.run(
        'UPDATE documents SET title = ?, category = ?, ocr_text = ?, updated_at = ? WHERE id = ?',
        [next.title, next.category, next.ocrText ?? null, next.updatedAt, id],
      );
      if (changes.tags) await this.writeTags(id, changes.tags);
      await this.reindex(id);
    });
    return next;
  }

  async remove(id: string): Promise<boolean> {
    return this.db.transaction(async () => {
      await this.db.run('DELETE FROM documents_fts WHERE id = ?', [id]);
      const result = await this.db.run('DELETE FROM documents WHERE id = ?', [id]);
      return result.changes > 0;
    });
  }

  async setFields(id: string, fields: ExtractedField[]): Promise<void> {
    await this.db.transaction(async () => {
      await this.db.run('DELETE FROM fields WHERE document_id = ?', [id]);
      for (const field of fields) {
        await this.db.run(
          'INSERT INTO fields (document_id, key, value, kind) VALUES (?, ?, ?, ?)',
          [id, field.key, field.value, field.kind],
        );
      }
    });
  }

  async getFields(id: string): Promise<ExtractedField[]> {
    return this.db.all<ExtractedField>(
      'SELECT key, value, kind FROM fields WHERE document_id = ? ORDER BY key',
      [id],
    );
  }

  /** Documents whose date field `key` falls on or before `before`, soonest first. */
  async expiring(key: string, before: string): Promise<{ document: Document; date: string }[]> {
    const rows = await this.db.all<DocumentRow & { date: string }>(
      `SELECT ${COLUMNS}, f.value AS date FROM documents d
       JOIN fields f ON f.document_id = d.id AND f.key = ? AND f.kind = 'date' AND f.value <= ?
       ORDER BY f.value ASC`,
      [key, before],
    );
    return rows.map((row) => ({ document: toDocument(row), date: row.date }));
  }

  private async writeTags(id: string, tags: string[]) {
    await this.db.run('DELETE FROM tags WHERE document_id = ?', [id]);
    const unique = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
    for (const tag of unique) {
      await this.db.run('INSERT INTO tags (document_id, tag) VALUES (?, ?)', [id, tag]);
    }
  }

  private async reindex(id: string) {
    const doc = await this.get(id);
    await this.db.run('DELETE FROM documents_fts WHERE id = ?', [id]);
    if (!doc) return;
    const params: SqlValue[] = [doc.id, doc.title, doc.tags.join(' '), doc.ocrText ?? ''];
    await this.db.run(
      'INSERT INTO documents_fts (id, title, tags, ocr_text) VALUES (?, ?, ?, ?)',
      params,
    );
  }
}
