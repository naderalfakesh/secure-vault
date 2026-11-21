import { t } from '@/i18n';
import { errorCode } from '@/utils/errors';
import { isKeyLocked } from '@modules/expo-vault';

/** A database key failure, with a sentence a screen can show as is. */
export function keyError(code: string, message: string, cause?: unknown): Error {
  return Object.assign(new Error(message), { code, cause });
}

/** Any failure to read a stored key; the key itself is never replaced. */
export function unreadableKey(cause: unknown): Error {
  if (isKeyLocked(cause)) {
    return keyError('KEY_LOCKED', t('errors.keyLocked'), cause);
  }
  if (errorCode(cause) === 'KEY_INVALIDATED') {
    return keyError('KEY_INVALIDATED', t('errors.index.keyInvalidated'), cause);
  }
  return keyError('DATABASE_KEY_UNREADABLE', t('errors.index.keyUnreadable'), cause);
}

/** A listing of the vault's entries or of the SQLite folder failed; nothing was read or written. */
export function listingError(cause: unknown): Error {
  return keyError('DATABASE_FILES_UNREADABLE', t('errors.index.filesUnreadable'), cause);
}

export function nameError(cause: unknown): Error {
  if (isKeyLocked(cause) || errorCode(cause) === 'KEY_INVALIDATED') return unreadableKey(cause);
  return keyError('DATABASE_NAME_UNREADABLE', t('errors.index.nameUnreadable'), cause);
}

export function erasingError(): Error {
  return keyError('INDEX_ERASING', t('errors.index.erasing'));
}

export function emptiedError(): Error {
  return keyError('VAULT_EMPTIED', t('errors.index.emptied'));
}
