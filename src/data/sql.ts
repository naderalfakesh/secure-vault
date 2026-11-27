export type SqlValue = string | number | null | Uint8Array;

export interface SqlDatabase {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  first<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  transaction<T>(work: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
