import { isKeyLocked } from '@modules/expo-vault';

import { t } from '../i18n';

/** The index's own sentence for a device key that was not unlocked (see `src/data/store/errors.ts`). */
export const KEY_LOCKED_MESSAGE = t('errors.keyLocked');

export const KEY_INVALIDATED_MESSAGE = t('errors.keyInvalidated');

/**
 * The `code` a native module, the index or a service put on a thrown error,
 * or undefined when it carries none. The one place that reads it.
 */
export function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? code : undefined;
}

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
  if (errorCode(error) === 'KEY_INVALIDATED') return KEY_INVALIDATED_MESSAGE;
  if (error instanceof Error && NOT_A_DATABASE.test(error.message)) {
    return t('errors.index.notOpened');
  }
  if (!(error instanceof Error) || !error.message) return fallback;
  if (namesPath(error.message) || isNativeDiagnostic(error.message)) return fallback;
  return error.message;
}

/**
 * The bridge's own wording for a rejected native call ("Call to function
 * 'ExpoVault.putFile' has been rejected. → Caused by: java.lang…") and the
 * platform exception names inside it are diagnostics, never sentences.
 */
const NATIVE_DIAGNOSTIC = [
  /\bCall to function\b/,
  /\bhas been rejected\b/,
  /Caused by:/,
  /\b(java|javax|kotlin|android|androidx)\.[a-z]+\./,
  /\b[A-Z]\w*(Exception|Error)\b/,
  /\bNS\w+ErrorDomain\b/,
  /\bError Domain=/,
];

function isNativeDiagnostic(message: string): boolean {
  return NATIVE_DIAGNOSTIC.some((pattern) => pattern.test(message));
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
