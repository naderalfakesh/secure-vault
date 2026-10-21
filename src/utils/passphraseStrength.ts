/** 0 = empty, 1 Weak, 2 Fair, 3 Good, 4 Strong. */
export type PassphraseStrength = 0 | 1 | 2 | 3 | 4;

export const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const;

/**
 * A rough, on-device estimate for the strength meter, never a gate: the only
 * rules the backup enforces are at least 8 characters and not one repeated
 * character. Works on code points, so any script counts, and the estimate is
 * the length times the bits of the character classes used, with repeats
 * discounted.
 */
export function estimatePassphraseStrength(passphrase: string): PassphraseStrength {
  const characters = Array.from(passphrase.normalize('NFC'));
  if (characters.length === 0) return 0;
  const unique = new Set(characters).size;
  if (characters.length < 8 || unique <= 1) return 1;

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
