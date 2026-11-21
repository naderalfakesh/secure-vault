import { DocumentDatabase } from './DocumentDatabase';
import { deleteEncryptedDatabase, openEncryptedDatabase } from './expoSqlite';

export type { DocumentStore } from './DocumentDatabase';
export { hasIndexFiles } from './store/files';

export const documentDatabase = new DocumentDatabase({
  open: openEncryptedDatabase,
  remove: deleteEncryptedDatabase,
});
