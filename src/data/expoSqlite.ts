import {
  defaultDatabaseDirectory,
  deleteDatabaseAsync,
  openDatabaseAsync,
  type SQLiteDatabase,
} from 'expo-sqlite';

import { t } from '@/i18n';
import { AppError } from '@/utils/AppError';

import type { SqlDatabase, SqlValue } from './sql';

function closedError(): AppError {
  return new AppError('INDEX_CLOSED', 'The document index was closed.');
}

// Drains in-flight queries on close so expo-sqlite never hits a freed native connection.
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
        // withTransactionAsync keeps using this connection; exclusive mode hands out a separate handle.
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

  // Memoized so a failed close is never retried against a connection still in use.
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

export async function openEncryptedDatabase(name: string, hexKey: string): Promise<SqlDatabase> {
  if (!/^[0-9a-f]{64}$/i.test(hexKey)) {
    throw new Error('Database key must be 32 bytes as hex.');
  }
  const db = await openDatabaseAsync(name);
  try {
    await db.execAsync(`PRAGMA key = "x'${hexKey}'";`);
    // Plain SQLite ignores PRAGMA key; verify SQLCipher via cipher_version before writing anything.
    const cipher = await db.getFirstAsync<{ cipher_version?: unknown }>('PRAGMA cipher_version');
    if (typeof cipher?.cipher_version !== 'string' || cipher.cipher_version === '') {
      throw new AppError('SQLCIPHER_UNAVAILABLE', t('errors.index.noCipher'));
    }
    await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    // Force a page read so a wrong key fails immediately.
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
    // Nothing to delete when the index was never opened.
  }
}

export function databaseFilePath(name: string): string {
  const directory = String(defaultDatabaseDirectory)
    .replace(/^file:\/\//, '')
    .replace(/\/$/, '');
  return `${directory}/${name}`;
}
