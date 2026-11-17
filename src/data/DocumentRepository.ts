import type { Document, DocumentCategory } from '@/types';

import { toFtsQuery } from './repository/fts';
import { COLUMNS, EXPIRY_JOIN, ORDER_BY, toDocument } from './repository/rows';
import { OCR_COLUMN, parseSnippet, SNIPPET_TOKENS } from './repository/snippet';
import type {
  DocumentOrder,
  DocumentRow,
  ExtractedField,
  NewDocument,
  SearchHit,
} from './repository/types';
import type { SqlDatabase, SqlValue } from './sql';

export { toFtsQuery } from './repository/fts';
export { parseSnippet } from './repository/snippet';
export type {
  DocumentOrder,
  ExtractedField,
  NewDocument,
  SearchHit,
  SnippetPiece,
} from './repository/types';

/**
 * All index reads and writes for documents. File bytes never pass through
 * here; the vault module owns those under the keys stored in each row.
 */
export class DocumentRepository {
  constructor(private readonly db: SqlDatabase) {}

  async list(
    category?: DocumentCategory | null,
    order: DocumentOrder = 'newest',
  ): Promise<Document[]> {
    const where = category ? 'WHERE d.category = ?' : '';
    const rows = await this.db.all<DocumentRow>(
      `SELECT ${COLUMNS} FROM documents d ${EXPIRY_JOIN} ${where} ORDER BY ${ORDER_BY[order]}`,
      category ? [category] : [],
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

  /**
   * Full-text search with FTS5's own `snippet()` of the page text, so the
   * highlighted words are exactly the tokens the index matched (prefixes and
   * folded diacritics included). An empty query finds nothing.
   */
  async searchWithSnippets(query: string, order: DocumentOrder = 'newest'): Promise<SearchHit[]> {
    const fts = toFtsQuery(query);
    if (!fts) return [];
    const rows = await this.db.all<DocumentRow & { snippet: string | null }>(
      `SELECT ${COLUMNS},
         snippet(documents_fts, ${OCR_COLUMN}, char(2), char(3), '…', ${SNIPPET_TOKENS}) AS snippet
       FROM documents_fts
       JOIN documents d ON d.id = documents_fts.id
       ${EXPIRY_JOIN}
       WHERE documents_fts MATCH ?
       ORDER BY ${ORDER_BY[order]}`,
      [fts],
    );
    return rows.map((row) => ({
      document: toDocument(row),
      snippet: parseSnippet(row.snippet, row.ocr_text),
    }));
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

  /** Extra pages beyond the main file, in order. Page 0 is the document's own file key. */
  async setPages(id: string, fileKeys: string[]): Promise<void> {
    await this.db.transaction(async () => {
      await this.db.run('DELETE FROM pages WHERE document_id = ?', [id]);
      for (const [index, fileKey] of fileKeys.entries()) {
        await this.db.run('INSERT INTO pages (document_id, position, file_key) VALUES (?, ?, ?)', [
          id,
          index + 1,
          fileKey,
        ]);
      }
    });
  }

  async getPages(id: string): Promise<string[]> {
    const rows = await this.db.all<{ file_key: string }>(
      'SELECT file_key FROM pages WHERE document_id = ? ORDER BY position',
      [id],
    );
    return rows.map((row) => row.file_key);
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
