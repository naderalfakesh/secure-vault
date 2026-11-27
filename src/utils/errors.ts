import { isKeyLocked } from '@modules/expo-vault';

import { t } from '../i18n';
import { KEY_LOCKED_MESSAGE, resolveErrorMessage } from './errorMessages';

export { errorCode } from './AppError';
export { KEY_INVALIDATED_MESSAGE, KEY_LOCKED_MESSAGE } from './errorMessages';

const NOT_A_DATABASE = /\bfile is (encrypted or is )?not a database\b/i;

// Filters native diagnostics and file paths so raw platform strings never reach UI.
export function plainErrorMessage(error: unknown, fallback: string): string {
  if (isKeyLocked(error)) return KEY_LOCKED_MESSAGE;
  return resolveErrorMessage(error, {
    fallback,
    codes: ['KEY_INVALIDATED'],
    vetMessage: (message) => {
      if (NOT_A_DATABASE.test(message)) return t('errors.index.notOpened');
      return namesPath(message) || isNativeDiagnostic(message) ? undefined : message;
    },
  });
}

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

function namesPath(message: string): boolean {
  return (
    /\b(file|content):\/\//.test(message) || /(^|[\s'"(=:])\/[^\s/'"]+\/[^\s'"]+/.test(message)
  );
}
