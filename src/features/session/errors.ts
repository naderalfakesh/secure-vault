import { t } from '@/i18n';
import { resolveErrorMessage } from '@/utils/errorMessages';
import { isKeyLocked } from '@modules/expo-vault';

/** Codes that deserve a plain sentence (from the shared table) instead of the OS text. */
const SESSION_CODES = [
  'BIOMETRIC_AUTH_FAILED',
  'BIOMETRIC_NOT_AVAILABLE',
  'NO_AUTH_ENROLLED',
  'KEY_RETRIEVAL_FAILED',
  'PIN_UNREADABLE',
  'KEY_INVALIDATED',
] as const;

export const KEY_NOT_UNLOCKED = t('session.keyNotUnlocked.unlock');

/** What a cancelled or lapsed key prompt means where it happened; setup has no PIN yet. */
export const keyNotUnlocked = {
  unlock: KEY_NOT_UNLOCKED,
  setup: t('session.keyNotUnlocked.setup'),
  resetPin: t('session.keyNotUnlocked.resetPin'),
  changePin: t('session.keyNotUnlocked.changePin'),
} as const;

type KeyPromptContext = keyof typeof keyNotUnlocked;

export function describeError(
  e: unknown,
  fallback: string,
  context: KeyPromptContext = 'unlock',
): string {
  // A cancelled or lapsed Android key prompt carries the Keystore's own text.
  if (isKeyLocked(e)) return keyNotUnlocked[context];
  // A refused Face ID or passcode is the same outcome as a lapsed key prompt.
  // Only the lock screen has a PIN to fall back to, so only it says "enter your PIN".
  return resolveErrorMessage(e, {
    fallback,
    codes: SESSION_CODES,
    overrides:
      context === 'unlock' ? undefined : { BIOMETRIC_AUTH_FAILED: keyNotUnlocked[context] },
  });
}
