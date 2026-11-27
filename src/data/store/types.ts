import type { DocumentRepository } from '../DocumentRepository';
import type { SqlDatabase } from '../sql';

export type DocumentStore = { db: SqlDatabase; repository: DocumentRepository };

export type SqlAdapter = {
  open(name: string, key: string): Promise<SqlDatabase>;
  remove(name: string): Promise<void>;
};
