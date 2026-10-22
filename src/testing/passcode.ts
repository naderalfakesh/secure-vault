import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import * as Crypto from 'expo-crypto';

import type { HashPasscodeOptions } from '@/features/auth/passcode';

/**
 * A PIN record made synchronously, for seeding tests, in the format
 * `hashPasscodeAsync` writes. The app itself only uses the async variants.
 */
export function hashPasscode(pin: string, opts: HashPasscodeOptions = {}): string {
  const iterations = opts.iterations ?? 4096;
  const salt = opts.salt ?? Crypto.getRandomBytes(16);
  const hash = pbkdf2(sha256, utf8ToBytes(pin), salt, { c: iterations, dkLen: 32 });
  return ['pbkdf2-sha256', iterations, bytesToHex(salt), bytesToHex(hash)].join('$');
}
