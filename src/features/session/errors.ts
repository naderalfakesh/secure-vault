import { t } from '@/i18n';
import { resolveErrorMessage } from '@/utils/errorMessages';
import { isKeyLocked } from '@modules/expo-vault';

const SESSION_CODES = [
  'BIOMETRIC_AUTH_FAILED',
  'BIOMETRIC_NOT_AVAILABLE',
  'NO_AUTH_ENROLLED',
  'KEY_RETRIEVAL_FAILED',
  'PIN_UNREADABLE',
  'KEY_INVALIDATED',
] as const;

export const KEY_NOT_UNLOCKED = t('session.keyNotUnlocked.unlock');

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
  if (isKeyLocked(e)) return keyNotUnlocked[context];
  return resolveErrorMessage(e, {
    fallback,
    codes: SESSION_CODES,
    overrides:
      context === 'unlock' ? undefined : { BIOMETRIC_AUTH_FAILED: keyNotUnlocked[context] },
  });
}
