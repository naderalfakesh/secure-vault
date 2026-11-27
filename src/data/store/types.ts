import type { DocumentRepository } from '../DocumentRepository';
import type { SqlDatabase } from '../sql';

export type DocumentStore = { db: SqlDatabase; repository: DocumentRepository };

/** The one part that needs a device: opening and deleting the encrypted SQLite file. */
export type SqlAdapter = {
  open(name: string, key: string): Promise<SqlDatabase>;
  remove(name: string): Promise<void>;
};
