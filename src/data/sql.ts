/**
 * The smallest SQL surface the repository needs. expo-sqlite implements it in
 * the app; better-sqlite3 implements it in Jest so repository tests run
 * against a real SQLite with FTS5 instead of a mock.
 */
export type SqlValue = string | number | null | Uint8Array;

export interface SqlDatabase {
  /** Run one or more statements with no parameters, e.g. schema DDL. */
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  first<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  transaction<T>(work: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
