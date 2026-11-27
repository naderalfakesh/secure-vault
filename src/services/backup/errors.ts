import { t } from '@/i18n';
import { AppError } from '@/utils/AppError';
import { KEY_INVALIDATED_MESSAGE, resolveErrorMessage } from '@/utils/errorMessages';
import { errorCode } from '@/utils/errors';

import type { RestoreRun } from './types';

const BACKUP_CODES = [
  'BACKUP_PASSPHRASE',
  'BACKUP_INVALID',
  'BACKUP_UNSUPPORTED',
  'BACKUP_PARTIAL',
  'BACKUP_RESOURCE',
  'BACKUP_NO_SPACE',
  'BACKUP_INDEX',
  'BACKUP_CANCELLED',
  'KEY_LOCKED',
  'KEY_INVALIDATED',
  'BACKUP_STAGING_INVALID',
  'BACKUP_RESTORE_STAGING_INVALID',
  'BACKUP_BUSY',
  'BACKUP_EXPORT_FAILED',
  'BACKUP_IMPORT_FAILED',
  'GET_ALL_KEYS_FAILED',
] as const;

const BACKUP_OVERRIDES = {
  KEY_LOCKED: t('backup.error.keyLocked'),
  KEY_INVALIDATED: t('backup.error.keyInvalidated', { message: KEY_INVALIDATED_MESSAGE }),
};

export function describeBackupError(error: unknown, fallback = t('backup.error.fallback')): string {
  return resolveErrorMessage(error, {
    fallback,
    codes: BACKUP_CODES,
    overrides: BACKUP_OVERRIDES,
  });
}

// Maps only known codes so raw platform messages (which may contain cache paths) never surface.
export function describeBackupErrorPlainly(error: unknown, fallback: string): string {
  const code = errorCode(error);
  return code !== undefined && BACKUP_CODES.some((known) => known === code)
    ? describeBackupError(error)
    : fallback;
}

export function busyError(): AppError {
  return new AppError('BACKUP_BUSY', 'Another backup operation is still running.');
}

export function stagingError(
  code: 'BACKUP_STAGING_INVALID' | 'BACKUP_RESTORE_STAGING_INVALID',
  cause: unknown,
): AppError {
  return new AppError(code, 'The backup staging folders could not be prepared.', { cause });
}

export function indexError(cause: unknown): AppError {
  const message =
    // i18n-ignore: an error cause; describeBackupError speaks BACKUP_INDEX from the table
    cause instanceof Error && cause.message ? cause.message : 'The index could not be opened.';
  return new AppError('BACKUP_INDEX', message, { cause });
}

export class PartialRestoreError extends AppError {
  readonly stoppedAt: RestoreRun['lastRestored'];

  constructor(
    message: string,
    stoppedAt: RestoreRun['lastRestored'],
    options?: { cause?: unknown },
  ) {
    super('BACKUP_PARTIAL', message, options);
    this.stoppedAt = stoppedAt;
  }
}

// After vault wipe, only BACKUP_INDEX keeps its code; all other errors become BACKUP_PARTIAL.
export function partialError(cause: unknown, stoppedAt: RestoreRun['lastRestored']): Error {
  if (errorCode(cause) === 'BACKUP_INDEX') return cause as Error;
  const message =
    cause instanceof Error && cause.message
      ? cause.message
      : // i18n-ignore: an error cause; describeBackupError speaks BACKUP_PARTIAL from the table
        'The restore stopped after the previous vault was removed.';
  return new PartialRestoreError(message, stoppedAt, { cause });
}
