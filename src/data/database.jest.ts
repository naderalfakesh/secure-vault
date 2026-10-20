import { DocumentRepository } from './DocumentRepository';
import { applyMigrations } from './schema';
import type { SqlDatabase } from './sql';
import { openTestDatabase } from './testing/betterSqlite';

export type DocumentStore = { db: SqlDatabase; repository: DocumentRepository };

let opening: Promise<DocumentStore> | null = null;
let emptied = false;

/** Like the real index, closed after "Delete everything" until setup allows it. */
export function allowDocumentStore(): void {
  emptied = false;
}

/** Jest double: an in-memory SQLite, no SQLCipher, no vault key, no legacy import. */
export function openDocumentStore(): Promise<DocumentStore> {
  if (emptied) {
    return Promise.reject(
      Object.assign(new Error('The vault was emptied.'), { code: 'VAULT_EMPTIED' }),
    );
  }
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

/** Test double for "Delete everything": the in-memory index simply closes. */
export async function deleteDocumentStore(removeEntries: () => Promise<void>): Promise<void> {
  await closeDocumentStore();
  await removeEntries();
  emptied = true;
}

/** Test doubles: the in-memory index has no file to copy or replace. */
export async function exportDatabaseFile(_destPath: string): Promise<void> {}

/** Like the real index, the replaced connection is dropped, not closed. */
export async function replaceDatabaseFile(_sourcePath: string): Promise<void> {
  opening = null;
}
