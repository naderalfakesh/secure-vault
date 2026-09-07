import { DocumentRepository } from './DocumentRepository';
import { applyMigrations } from './schema';
import type { SqlDatabase } from './sql';
import { openTestDatabase } from './testing/betterSqlite';

export type DocumentStore = { db: SqlDatabase; repository: DocumentRepository };

let opening: Promise<DocumentStore> | null = null;

/** Jest double: an in-memory SQLite, no SQLCipher, no vault key, no legacy import. */
export function openDocumentStore(): Promise<DocumentStore> {
  if (!opening) {
    opening = (async () => {
      const db = openTestDatabase();
      await applyMigrations(db);
      return { db, repository: new DocumentRepository(db) };
    })();
  }
  return opening;
}

export async function closeDocumentStore(): Promise<void> {
  const current = opening;
  opening = null;
  if (current) await (await current).db.close();
}
