import { isLongEnough, isVaried, passphraseLength } from '@/services/backup/passphrase';

// Advisory meter only (0 empty .. 4 Strong); enforcement lives in services/backup/passphrase.
export type PassphraseStrength = 0 | 1 | 2 | 3 | 4;

export function estimatePassphraseStrength(passphrase: string): PassphraseStrength {
  if (passphraseLength(passphrase) === 0) return 0;
  if (!isLongEnough(passphrase) || !isVaried(passphrase)) return 1;

  const characters = Array.from(passphrase.normalize('NFC'));
  const unique = new Set(characters).size;

  let pool = 0;
  if (characters.some((c) => /[a-z]/.test(c))) pool += 26;
  if (characters.some((c) => /[A-Z]/.test(c))) pool += 26;
  if (characters.some((c) => /\p{Nd}/u.test(c))) pool += 10;
  if (characters.some((c) => /[\s\p{P}\p{S}]/u.test(c))) pool += 33;
  if (characters.some((c) => /\p{L}/u.test(c) && !/[A-Za-z]/.test(c))) pool += 60;
  pool = Math.max(pool, 10);

  const effectiveLength = Math.min(characters.length, unique * 2);
  const bits = effectiveLength * Math.log2(pool);
  if (bits < 40) return 1;
  if (bits < 60) return 2;
  if (bits < 80) return 3;
  return 4;
}
