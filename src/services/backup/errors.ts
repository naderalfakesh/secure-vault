import { t } from '@/i18n';
import { errorCode, KEY_INVALIDATED_MESSAGE } from '@/utils/errors';

import type { RestoreRun } from './types';

/** Plain-language message for a failed export or restore. */
export function describeBackupError(error: unknown, fallback = t('backup.error.fallback')): string {
  switch (errorCode(error)) {
    case 'BACKUP_PASSPHRASE':
      return t('backup.error.passphrase');
    case 'BACKUP_INVALID':
      return t('backup.error.invalid');
    case 'BACKUP_UNSUPPORTED':
      return t('backup.error.unsupported');
    case 'BACKUP_PARTIAL':
      return t('backup.error.partial');
    case 'BACKUP_RESOURCE':
      return t('backup.error.resource');
    case 'BACKUP_NO_SPACE':
      return t('backup.error.noSpace');
    case 'BACKUP_INDEX':
      return t('backup.error.index');
    case 'BACKUP_CANCELLED':
      return t('backup.error.cancelled');
    // Only ever seen before the wipe: the service names one after it BACKUP_PARTIAL.
    case 'KEY_LOCKED':
      return t('backup.error.keyLocked');
    case 'KEY_INVALIDATED':
      return t('backup.error.keyInvalidated', { message: KEY_INVALIDATED_MESSAGE });
    case 'BACKUP_STAGING_INVALID':
      return t('backup.error.staging');
    case 'BACKUP_RESTORE_STAGING_INVALID':
      return t('backup.error.restoreStaging');
    case 'BACKUP_BUSY':
      return t('backup.error.busy');
    case 'BACKUP_EXPORT_FAILED':
      return t('backup.error.exportFailed');
    case 'BACKUP_IMPORT_FAILED':
      return t('backup.error.importFailed');
    case 'GET_ALL_KEYS_FAILED':
      return t('backup.error.keysFailed');
    default:
      return error instanceof Error && error.message ? error.message : fallback;
  }
}

const knownBackupErrors = new Set([
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
]);

/**
 * Like `describeBackupError`, but never the platform's own message, which can
 * name cache paths. For outcomes reported after the screen that started them
 * is gone.
 */
export function describeBackupErrorPlainly(error: unknown, fallback: string): string {
  const code = errorCode(error);
  return code !== undefined && knownBackupErrors.has(code) ? describeBackupError(error) : fallback;
}

/** Another export, restore, or erase holds the slot. */
export function busyError(): Error {
  return Object.assign(new Error('Another backup operation is still running.'), {
    code: 'BACKUP_BUSY',
  });
}

/** The staging folders could not be prepared, so nothing was written or replaced. */
export function stagingError(code: string, cause: unknown): Error {
  return Object.assign(new Error('The backup staging folders could not be prepared.'), {
    code,
    cause,
  });
}

/**
 * A failure after the native import has replaced the vault: the documents
 * are back, the index is not. It gets its own code so the sentence never
 * claims that nothing changed.
 */
export function indexError(cause: unknown): Error {
  const message =
    // i18n-ignore: an error cause; describeBackupError speaks BACKUP_INDEX from the table
    cause instanceof Error && cause.message ? cause.message : 'The index could not be opened.';
  return Object.assign(new Error(message), { code: 'BACKUP_INDEX', cause });
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
  return Object.assign(new Error(message), { code: 'BACKUP_PARTIAL', cause, stoppedAt });
}
