import type { SqlDatabase } from './sql';

/**
 * Schema versions are applied in order and recorded in `user_version`, so a
 * future change is one more entry, never an edit of a shipped one.
 */
const migrations: string[] = [
  // v1: documents, pages, tags, extracted fields, and a contentless FTS index.
  `
  CREATE TABLE documents (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_key TEXT NOT NULL,
    thumbnail_key TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    ocr_text TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX documents_category ON documents(category);
  CREATE INDEX documents_updated ON documents(updated_at DESC);

  CREATE TABLE pages (
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    file_key TEXT NOT NULL,
    thumbnail_key TEXT,
    PRIMARY KEY (document_id, position)
  );

  CREATE TABLE tags (
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    PRIMARY KEY (document_id, tag)
  );
  CREATE INDEX tags_tag ON tags(tag);

  CREATE TABLE fields (
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'text',
    PRIMARY KEY (document_id, key)
  );
  CREATE INDEX fields_key ON fields(key);

  CREATE VIRTUAL TABLE documents_fts USING fts5(
    id UNINDEXED,
    title,
    tags,
    ocr_text,
    tokenize = 'unicode61 remove_diacritics 2'
  );
  `,
];

export async function applyMigrations(db: SqlDatabase): Promise<number> {
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  for (let index = version; index < migrations.length; index += 1) {
    const sql = migrations[index];
    if (!sql) break;
    await db.transaction(async () => {
      await db.exec(sql);
      await db.exec(`PRAGMA user_version = ${index + 1}`);
    });
    version = index + 1;
  }
  return version;
}

export const SCHEMA_VERSION = migrations.length;
