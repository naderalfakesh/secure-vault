import { deleteDatabaseAsync, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import type { SqlDatabase, SqlValue } from './sql';

class ExpoSqlDatabase implements SqlDatabase {
  constructor(private readonly db: SQLiteDatabase) {}

  exec(sql: string) {
    return this.db.execAsync(sql);
  }

  async run(sql: string, params: SqlValue[] = []) {
    const result = await this.db.runAsync(sql, params);
    return { changes: result.changes };
  }

  all<T>(sql: string, params: SqlValue[] = []) {
    return this.db.getAllAsync<T>(sql, params);
  }

  first<T>(sql: string, params: SqlValue[] = []) {
    return this.db.getFirstAsync<T>(sql, params);
  }

  async transaction<T>(work: () => Promise<T>) {
    // withTransactionAsync lets the task keep using this connection; the
    // exclusive variant hands out a separate transaction object instead.
    let result: T | undefined;
    await this.db.withTransactionAsync(async () => {
      result = await work();
    });
    return result as T;
  }

  close() {
    return this.db.closeAsync();
  }
}

/**
 * Opens the SQLCipher database. The key is 32 random bytes as hex, generated
 * once and kept encrypted by the vault module; `PRAGMA key` must be the first
 * statement on the connection.
 */
export async function openEncryptedDatabase(name: string, hexKey: string): Promise<SqlDatabase> {
  if (!/^[0-9a-f]{64}$/i.test(hexKey)) {
    throw new Error('Database key must be 32 bytes as hex.');
  }
  const db = await openDatabaseAsync(name);
  await db.execAsync(`PRAGMA key = "x'${hexKey}'";`);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  // Any query fails with "file is not a database" when the key is wrong.
  await db.getFirstAsync('SELECT count(*) FROM sqlite_master');
  return new ExpoSqlDatabase(db);
}

export async function deleteEncryptedDatabase(name: string): Promise<void> {
  try {
    await deleteDatabaseAsync(name);
  } catch {
    // Nothing to delete on a device that never opened the index.
  }
}
