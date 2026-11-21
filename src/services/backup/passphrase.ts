import { t } from '@/i18n';

export const MIN_PASSPHRASE_LENGTH = 8;

// The backup key is derived from the passphrase inside the vault module
// (ADR 0007) and never stored; JavaScript only decides which passphrases are
// acceptable. Every rule here counts code points, so an emoji or a
// supplementary-plane character is one character, as it looks to the person typing.

/** Characters as a person counts them: code points, not UTF-16 units. */
export function passphraseLength(text: string): number {
  return Array.from(text).length;
}

export function isLongEnough(passphrase: string): boolean {
  return passphraseLength(passphrase) >= MIN_PASSPHRASE_LENGTH;
}

/** More than one distinct character: a single repeated one is refused. */
export function isVaried(passphrase: string): boolean {
  return new Set(passphrase).size > 1;
}

export function matchesConfirmation(passphrase: string, confirmation: string): boolean {
  return confirmation.length > 0 && confirmation === passphrase;
}

/** A sentence explaining why a passphrase is not acceptable, or null when it is. */
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
