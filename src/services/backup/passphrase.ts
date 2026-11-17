import { t } from '@/i18n';

import { MIN_PASSPHRASE_LENGTH } from './constants';

// The backup key is derived from the passphrase inside the vault module
// (ADR 0007) and never stored; JavaScript only decides which passphrases are
// acceptable.

/** A sentence explaining why a passphrase is not acceptable, or null when it is. */
export function passphraseProblem(passphrase: string, confirmation?: string): string | null {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return t('backup.passphrase.tooShort', { count: MIN_PASSPHRASE_LENGTH });
  }
  if (/^(.)\1+$/.test(passphrase)) return t('backup.passphrase.oneCharacter');
  if (confirmation !== undefined && confirmation !== passphrase) {
    return t('backup.passphrase.mismatch');
  }
  return null;
}
