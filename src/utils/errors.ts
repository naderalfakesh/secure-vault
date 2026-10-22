import { isKeyLocked } from '../../modules/expo-vault/src/withKeyRecovery';
import { t } from '../i18n';

/** The index's own sentence for a device key that was not unlocked (see `src/data/database.ts`). */
export const KEY_LOCKED_MESSAGE = t('errors.keyLocked');

export const KEY_INVALIDATED_MESSAGE = t('errors.keyInvalidated');

/** SQLite's own text for an index it cannot read (SQLITE_NOTADB): a wrong key or a damaged file. */
const NOT_A_DATABASE = /\bfile is (encrypted or is )?not a database\b/i;

/**
 * A sentence for a failed vault call that a screen can show as is. A device
 * key prompt that was cancelled, or a Keystore window that lapsed, reaches
 * here as the platform's own text ("User not authenticated"); it never
 * reaches the user that way.
 */
export function plainErrorMessage(error: unknown, fallback: string): string {
  if (isKeyLocked(error)) return KEY_LOCKED_MESSAGE;
  const code =
    typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : null;
  if (code === 'KEY_INVALIDATED') return KEY_INVALIDATED_MESSAGE;
  if (error instanceof Error && NOT_A_DATABASE.test(error.message)) {
    return t('errors.index.notOpened');
  }
  if (!(error instanceof Error) || !error.message || namesPath(error.message)) return fallback;
  return error.message;
}

/**
 * A platform message that names a file (a URI, or an absolute path of two or
 * more folders) is a diagnostic, not a sentence, and can expose where the
 * vault keeps its plaintext copies; the screen's own fallback is shown instead.
 */
function namesPath(message: string): boolean {
  return (
    /\b(file|content):\/\//.test(message) || /(^|[\s'"(=:])\/[^\s/'"]+\/[^\s'"]+/.test(message)
  );
}
