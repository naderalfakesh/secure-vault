import { t } from '@/i18n';

import { errorCode } from './AppError';

/** The index's own sentence for a device key that was not unlocked (see `src/data/store/errors.ts`). */
export const KEY_LOCKED_MESSAGE = t('errors.keyLocked');

export const KEY_INVALIDATED_MESSAGE = t('errors.keyInvalidated');

export type ErrorMessages = Readonly<Partial<Record<string, string>>>;

/**
 * The default sentence for each error code, from the app and from the native
 * modules. A screen that words a code differently says so with `overrides`
 * (see `resolveErrorMessage`); it never keeps a second table.
 */
export const ERROR_MESSAGES: ErrorMessages = {
  KEY_LOCKED: KEY_LOCKED_MESSAGE,
  // Android only: setup keeps an invalidated key while the vault still holds entries.
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
  /** Shown when neither a sentence for the code nor a vetted message applies. */
  fallback: string;
  /** Sentences that win over the table, for a code this place words differently. */
  overrides?: ErrorMessages;
  /**
   * The codes this place speaks from the table. Without it every code in the
   * table counts; with it, a code outside it falls through to the message.
   */
  codes?: readonly string[];
  /**
   * Decides what the error's own message becomes: the sentence to show, or
   * undefined to refuse it and show the fallback. Without it the message is
   * shown as is.
   */
  vetMessage?: (message: string) => string | undefined;
}

function sentenceFor(code: string, options: ErrorMessageOptions): string | undefined {
  const override = options.overrides?.[code];
  if (typeof override === 'string') return override;
  if (options.codes && !options.codes.includes(code)) return undefined;
  const sentence = ERROR_MESSAGES[code];
  return typeof sentence === 'string' ? sentence : undefined;
}

/**
 * The one place an unknown error becomes a sentence: the code's sentence
 * (overrides first, then the table), else the error's own message when
 * `vetMessage` lets it through, else the fallback.
 */
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
