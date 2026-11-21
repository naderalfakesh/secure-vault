import { t } from '@/i18n';
import { AppError, type AppErrorCode } from '@/utils/AppError';
import { errorCode } from '@/utils/errors';
import { isKeyLocked } from '@modules/expo-vault';

/** A database key failure, with a sentence a screen can show as is. */
export function keyError(code: AppErrorCode, message: string, cause?: unknown): AppError {
  return new AppError(code, message, { cause });
}

/** Any failure to read a stored key; the key itself is never replaced. */
export function unreadableKey(cause: unknown): AppError {
  if (isKeyLocked(cause)) {
    return keyError('KEY_LOCKED', t('errors.keyLocked'), cause);
  }
  if (errorCode(cause) === 'KEY_INVALIDATED') {
    return keyError('KEY_INVALIDATED', t('errors.index.keyInvalidated'), cause);
  }
  return keyError('DATABASE_KEY_UNREADABLE', t('errors.index.keyUnreadable'), cause);
}

/** A listing of the vault's entries or of the SQLite folder failed; nothing was read or written. */
export function listingError(cause: unknown): AppError {
  return keyError('DATABASE_FILES_UNREADABLE', t('errors.index.filesUnreadable'), cause);
}

export function nameError(cause: unknown): AppError {
  if (isKeyLocked(cause) || errorCode(cause) === 'KEY_INVALIDATED') return unreadableKey(cause);
  return keyError('DATABASE_NAME_UNREADABLE', t('errors.index.nameUnreadable'), cause);
}

export function erasingError(): AppError {
  return keyError('INDEX_ERASING', t('errors.index.erasing'));
}

export function emptiedError(): AppError {
  return keyError('VAULT_EMPTIED', t('errors.index.emptied'));
}
