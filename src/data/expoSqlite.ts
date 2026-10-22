import {
  defaultDatabaseDirectory,
  deleteDatabaseAsync,
  openDatabaseAsync,
  type SQLiteDatabase,
} from 'expo-sqlite';

import { t } from '../i18n';
import type { SqlDatabase, SqlValue } from './sql';

function closedError(): Error {
  return Object.assign(new Error('The document index was closed.'), { code: 'INDEX_CLOSED' });
}

/**
 * Close waits for every call in flight, so no statement of ours is open when
 * SQLite closes, and turns new calls away (except inside a running
 * transaction): expo-sqlite runs calls in parallel, and one that reached the
 * native side after the close would use a freed connection.
 */
class ExpoSqlDatabase implements SqlDatabase {
  private readonly pending = new Set<Promise<unknown>>();
  private transactions = 0;
  private state: 'open' | 'closing' | 'closed' = 'open';
  private closing: Promise<void> | null = null;

  constructor(private readonly db: SQLiteDatabase) {}

  private track<T>(work: () => Promise<T>): Promise<T> {
    if (this.state === 'closed' || (this.state === 'closing' && this.transactions === 0)) {
      return Promise.reject(closedError());
    }
    const task = work();
    this.pending.add(task);
    void task.catch(() => {}).then(() => this.pending.delete(task));
    return task;
  }

  exec(sql: string) {
    return this.track(() => this.db.execAsync(sql));
  }

  run(sql: string, params: SqlValue[] = []) {
    return this.track(async () => {
      const result = await this.db.runAsync(sql, params);
      return { changes: result.changes };
    });
  }

  all<T>(sql: string, params: SqlValue[] = []) {
    return this.track(() => this.db.getAllAsync<T>(sql, params));
  }

  first<T>(sql: string, params: SqlValue[] = []) {
    return this.track(() => this.db.getFirstAsync<T>(sql, params));
  }

  transaction<T>(work: () => Promise<T>) {
    return this.track(async () => {
      this.transactions += 1;
      try {
        // withTransactionAsync lets the task keep using this connection; the
        // exclusive variant hands out a separate transaction object instead.
        let result: T | undefined;
        await this.db.withTransactionAsync(async () => {
          result = await work();
        });
        return result as T;
      } finally {
        this.transactions -= 1;
      }
    });
  }

  /**
   * Memoized, so a failed close is never sent again and the store reports the
   * same failure until the app restarts. expo-sqlite 58 keeps a connection that
   * failed to close cached, so a retry could work, but a stuck erase is safer
   * than one that runs against a connection still in use.
   */
  close() {
    this.closing ??= (async () => {
      this.state = 'closing';
      while (this.pending.size > 0) await Promise.allSettled([...this.pending]);
      this.state = 'closed';
      await this.db.closeAsync();
    })();
    return this.closing;
  }
}

/**
 * Opens the SQLCipher database. The key is 32 random bytes as hex, generated
 * once and kept encrypted by the vault module; `PRAGMA key` must be the first
 * statement on the connection. Rejects with SQLCIPHER_UNAVAILABLE, and closes
 * the connection, when the build's SQLite is not SQLCipher.
 */
export async function openEncryptedDatabase(name: string, hexKey: string): Promise<SqlDatabase> {
  if (!/^[0-9a-f]{64}$/i.test(hexKey)) {
    throw new Error('Database key must be 32 bytes as hex.');
  }
  // expo-sqlite 58 finalizes only the statements it prepared before closing,
  // so FTS5's own statements are no longer freed twice (expo/expo#50121).
  const db = await openDatabaseAsync(name);
  try {
    await db.execAsync(`PRAGMA key = "x'${hexKey}'";`);
    // Plain SQLite ignores PRAGMA key and would write the index unencrypted;
    // only SQLCipher answers cipher_version. Checked before anything is written.
    const cipher = await db.getFirstAsync<{ cipher_version?: unknown }>('PRAGMA cipher_version');
    if (typeof cipher?.cipher_version !== 'string' || cipher.cipher_version === '') {
      throw Object.assign(new Error(t('errors.index.noCipher')), {
        code: 'SQLCIPHER_UNAVAILABLE',
      });
    }
    await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    // Any query fails with "file is not a database" when the key is wrong.
    await db.getFirstAsync('SELECT count(*) FROM sqlite_master');
  } catch (error) {
    await db.closeAsync().catch(() => {});
    throw error;
  }
  return new ExpoSqlDatabase(db);
}

export async function deleteEncryptedDatabase(name: string): Promise<void> {
  try {
    await deleteDatabaseAsync(name);
  } catch {
    // Nothing to delete on a device that never opened the index.
  }
}

/** Where expo-sqlite keeps the database file, as a plain path. */
export function databaseFilePath(name: string): string {
  const directory = String(defaultDatabaseDirectory)
    .replace(/^file:\/\//, '')
    .replace(/\/$/, '');
  return `${directory}/${name}`;
}
