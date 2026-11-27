export const APP_ERROR_CODES = [
  'BACKUP_BUSY',
  'BACKUP_CANCELLED',
  'BACKUP_INDEX',
  'BACKUP_PARTIAL',
  'BACKUP_RESTORE_STAGING_INVALID',
  'BACKUP_STAGING_INVALID',
  'DATABASE_FILES_UNREADABLE',
  'DATABASE_KEY_MISSING',
  'DATABASE_KEY_UNREADABLE',
  'DATABASE_NAME_UNREADABLE',
  'DELETE_INCOMPLETE',
  'ERASE_INCOMPLETE',
  'IMPORT_COPY_TIMEOUT',
  'INDEX_CLOSED',
  'INDEX_ERASING',
  'KEY_INVALIDATED',
  'KEY_LOCKED',
  'PIN_UNREADABLE',
  'SQLCIPHER_UNAVAILABLE',
  'VAULT_EMPTIED',
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AppError';
    this.code = code;
  }
}

export function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? code : undefined;
}
