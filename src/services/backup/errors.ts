import { t } from '@/i18n';
import { AppError } from '@/utils/AppError';
import { KEY_INVALIDATED_MESSAGE, resolveErrorMessage } from '@/utils/errorMessages';
import { errorCode } from '@/utils/errors';

import type { RestoreRun } from './types';

/** The codes an export or restore can end with, each with its sentence in the shared table. */
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

/** Wording that differs from the shared table: these two are read after a backup began. */
const BACKUP_OVERRIDES = {
  // Only ever seen before the wipe: the service names one after it BACKUP_PARTIAL.
  KEY_LOCKED: t('backup.error.keyLocked'),
  KEY_INVALIDATED: t('backup.error.keyInvalidated', { message: KEY_INVALIDATED_MESSAGE }),
};

/** Plain-language message for a failed export or restore. */
export function describeBackupError(error: unknown, fallback = t('backup.error.fallback')): string {
  return resolveErrorMessage(error, {
    fallback,
    codes: BACKUP_CODES,
    overrides: BACKUP_OVERRIDES,
  });
}

/**
 * Like `describeBackupError`, but never the platform's own message, which can
 * name cache paths. For outcomes reported after the screen that started them
 * is gone.
 */
export function describeBackupErrorPlainly(error: unknown, fallback: string): string {
  const code = errorCode(error);
  return code !== undefined && BACKUP_CODES.some((known) => known === code)
    ? describeBackupError(error)
    : fallback;
}

/** Another export, restore, or erase holds the slot. */
export function busyError(): AppError {
  return new AppError('BACKUP_BUSY', 'Another backup operation is still running.');
}

/** The staging folders could not be prepared, so nothing was written or replaced. */
export function stagingError(
  code: 'BACKUP_STAGING_INVALID' | 'BACKUP_RESTORE_STAGING_INVALID',
  cause: unknown,
): AppError {
  return new AppError(code, 'The backup staging folders could not be prepared.', { cause });
}

/**
 * A failure after the native import has replaced the vault: the documents
 * are back, the index is not. It gets its own code so the sentence never
 * claims that nothing changed.
 */
export function indexError(cause: unknown): AppError {
  const message =
    // i18n-ignore: an error cause; describeBackupError speaks BACKUP_INDEX from the table
    cause instanceof Error && cause.message ? cause.message : 'The index could not be opened.';
  return new AppError('BACKUP_INDEX', message, { cause });
}

/** A restore that stopped after the previous vault was removed, and the entry it stopped at. */
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

/**
 * A failure after the first Restoring event. The previous vault may be gone
 * whatever the native code says (a key failure keeps its own code across the
 * wipe so the key recovery wrapper can retry, and a retry's own refusals say
 * nothing about the first attempt's wipe), so only BACKUP_INDEX keeps its
 * code; everything else is a partial restore.
 */
export function partialError(cause: unknown, stoppedAt: RestoreRun['lastRestored']): Error {
  if (errorCode(cause) === 'BACKUP_INDEX') return cause as Error;
  const message =
    cause instanceof Error && cause.message
      ? cause.message
      : // i18n-ignore: an error cause; describeBackupError speaks BACKUP_PARTIAL from the table
        'The restore stopped after the previous vault was removed.';
  return new PartialRestoreError(message, stoppedAt, { cause });
}
