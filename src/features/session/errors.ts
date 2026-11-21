import { t } from '@/i18n';
import { KEY_INVALIDATED_MESSAGE } from '@/utils/errors';
import { isKeyLocked } from '@modules/expo-vault';

/** Native error codes that deserve a plain sentence instead of the OS text. */
const friendlyMessages: Record<string, string> = {
  BIOMETRIC_AUTH_FAILED: t('session.biometricFailed'),
  BIOMETRIC_NOT_AVAILABLE: t('session.biometricUnavailable'),
  NO_AUTH_ENROLLED: t('session.noAuthEnrolled'),
  KEY_RETRIEVAL_FAILED: t('session.keyRetrievalFailed'),
  PIN_UNREADABLE: t('session.pinUnreadable'),
  // Android only: setup keeps an invalidated key while the vault still holds entries.
  KEY_INVALIDATED: KEY_INVALIDATED_MESSAGE,
};

export const KEY_NOT_UNLOCKED = t('session.keyNotUnlocked.unlock');

/** What a cancelled or lapsed key prompt means where it happened; setup has no PIN yet. */
export const keyNotUnlocked = {
  unlock: KEY_NOT_UNLOCKED,
  setup: t('session.keyNotUnlocked.setup'),
  resetPin: t('session.keyNotUnlocked.resetPin'),
  changePin: t('session.keyNotUnlocked.changePin'),
} as const;

type KeyPromptContext = keyof typeof keyNotUnlocked;

/** The native error code a rejection carries, if any. */
export function errorCode(e: unknown): unknown {
  return typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined;
}

export function describeError(
  e: unknown,
  fallback: string,
  context: KeyPromptContext = 'unlock',
): string {
  // A cancelled or lapsed Android key prompt carries the Keystore's own text.
  if (isKeyLocked(e)) return keyNotUnlocked[context];
  const code = errorCode(e);
  // A refused Face ID or passcode is the same outcome as a lapsed key prompt.
  // Only the lock screen has a PIN to fall back to, so only it says "enter your PIN".
  if (code === 'BIOMETRIC_AUTH_FAILED' && context !== 'unlock') return keyNotUnlocked[context];
  if (typeof code === 'string' && friendlyMessages[code]) return friendlyMessages[code];
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
