import Database from 'better-sqlite3';

import type { SqlDatabase, SqlValue } from '../sql';

/** In-memory SQLite (with FTS5) for Jest; mirrors the expo-sqlite adapter. */
export function openTestDatabase(): SqlDatabase {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  return {
    async exec(sql) {
      db.exec(sql);
    },
    async run(sql, params: SqlValue[] = []) {
      const info = db.prepare(sql).run(...params);
      return { changes: Number(info.changes) };
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return db.prepare(sql).all(...params) as T[];
    },
    async first<T>(sql: string, params: SqlValue[] = []) {
      return (db.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async transaction<T>(work: () => Promise<T>) {
      db.exec('BEGIN');
      try {
        const result = await work();
        db.exec('COMMIT');
        return result;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    async close() {
      db.close();
    },
  };
}
