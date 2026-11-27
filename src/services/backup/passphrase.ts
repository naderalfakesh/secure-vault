import { t } from '@/i18n';

export const MIN_PASSPHRASE_LENGTH = 8;

// Count Unicode code points rather than UTF-16 code units.
export function passphraseLength(text: string): number {
  return Array.from(text).length;
}

export function isLongEnough(passphrase: string): boolean {
  return passphraseLength(passphrase) >= MIN_PASSPHRASE_LENGTH;
}

export function isVaried(passphrase: string): boolean {
  return new Set(passphrase).size > 1;
}

export function matchesConfirmation(passphrase: string, confirmation: string): boolean {
  return confirmation.length > 0 && confirmation === passphrase;
}

export function passphraseProblem(passphrase: string, confirmation?: string): string | null {
  if (!isLongEnough(passphrase)) {
    return t('backup.passphrase.tooShort', { count: MIN_PASSPHRASE_LENGTH });
  }
  if (!isVaried(passphrase)) return t('backup.passphrase.oneCharacter');
  if (confirmation !== undefined && confirmation !== passphrase) {
    return t('backup.passphrase.mismatch');
  }
  return null;
}
