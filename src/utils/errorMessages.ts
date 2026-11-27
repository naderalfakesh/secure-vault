import { t } from '@/i18n';

import { errorCode } from './AppError';

export const KEY_LOCKED_MESSAGE = t('errors.keyLocked');

export const KEY_INVALIDATED_MESSAGE = t('errors.keyInvalidated');

export type ErrorMessages = Readonly<Partial<Record<string, string>>>;

export const ERROR_MESSAGES: ErrorMessages = {
  KEY_LOCKED: KEY_LOCKED_MESSAGE,
  KEY_INVALIDATED: KEY_INVALIDATED_MESSAGE,
  BIOMETRIC_AUTH_FAILED: t('session.biometricFailed'),
  BIOMETRIC_NOT_AVAILABLE: t('session.biometricUnavailable'),
  NO_AUTH_ENROLLED: t('session.noAuthEnrolled'),
  KEY_RETRIEVAL_FAILED: t('session.keyRetrievalFailed'),
  PIN_UNREADABLE: t('session.pinUnreadable'),
  BACKUP_PASSPHRASE: t('backup.error.passphrase'),
  BACKUP_INVALID: t('backup.error.invalid'),
  BACKUP_UNSUPPORTED: t('backup.error.unsupported'),
  BACKUP_PARTIAL: t('backup.error.partial'),
  BACKUP_RESOURCE: t('backup.error.resource'),
  BACKUP_NO_SPACE: t('backup.error.noSpace'),
  BACKUP_INDEX: t('backup.error.index'),
  BACKUP_CANCELLED: t('backup.error.cancelled'),
  BACKUP_STAGING_INVALID: t('backup.error.staging'),
  BACKUP_RESTORE_STAGING_INVALID: t('backup.error.restoreStaging'),
  BACKUP_BUSY: t('backup.error.busy'),
  BACKUP_EXPORT_FAILED: t('backup.error.exportFailed'),
  BACKUP_IMPORT_FAILED: t('backup.error.importFailed'),
  GET_ALL_KEYS_FAILED: t('backup.error.keysFailed'),
};

export interface ErrorMessageOptions {
  fallback: string;
  overrides?: ErrorMessages;
  codes?: readonly string[];
  vetMessage?: (message: string) => string | undefined;
}

function sentenceFor(code: string, options: ErrorMessageOptions): string | undefined {
  const override = options.overrides?.[code];
  if (typeof override === 'string') return override;
  if (options.codes && !options.codes.includes(code)) return undefined;
  const sentence = ERROR_MESSAGES[code];
  return typeof sentence === 'string' ? sentence : undefined;
}

export function resolveErrorMessage(error: unknown, options: ErrorMessageOptions): string {
  const code = errorCode(error);
  const sentence = code === undefined ? undefined : sentenceFor(code, options);
  if (sentence !== undefined) return sentence;
  if (error instanceof Error && error.message) {
    return (
      (options.vetMessage ? options.vetMessage(error.message) : error.message) ?? options.fallback
    );
  }
  return options.fallback;
}
