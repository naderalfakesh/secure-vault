import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import * as Crypto from 'expo-crypto';

const SCHEME = 'pbkdf2-sha256';
const DEFAULT_ITERATIONS = 4096;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

interface PasscodeRecord {
  scheme: typeof SCHEME;
  iterations: number;
  salt: Uint8Array;
  hash: Uint8Array;
}

export interface HashPasscodeOptions {
  iterations?: number;
  salt?: Uint8Array;
}

function serialize(record: PasscodeRecord): string {
  return [record.scheme, record.iterations, bytesToHex(record.salt), bytesToHex(record.hash)].join(
    '$',
  );
}

export function parsePasscodeRecord(value: string): PasscodeRecord | null {
  const [scheme, rawIterations, rawSalt, rawHash, ...rest] = value.split('$');
  if (rest.length > 0 || scheme !== SCHEME || !rawIterations || !rawSalt || !rawHash) return null;
  const iterations = Number(rawIterations);
  if (!Number.isInteger(iterations) || iterations < 1) return null;
  try {
    const salt = hexToBytes(rawSalt);
    const hash = hexToBytes(rawHash);
    if (salt.length === 0 || hash.length === 0) return null;
    return { scheme: SCHEME, iterations, salt, hash };
  } catch {
    return null;
  }
}

export function isPasscodeRecord(value: string): boolean {
  return parsePasscodeRecord(value) !== null;
}

function newRecord(opts: HashPasscodeOptions): Omit<PasscodeRecord, 'hash'> {
  return {
    scheme: SCHEME,
    iterations: opts.iterations ?? DEFAULT_ITERATIONS,
    // Hermes lacks crypto.getRandomValues; expo-crypto reads the OS CSPRNG.
    salt: opts.salt ?? Crypto.getRandomBytes(SALT_BYTES),
  };
}

export async function hashPasscodeAsync(
  pin: string,
  opts: HashPasscodeOptions = {},
): Promise<string> {
  const base = newRecord(opts);
  const hash = await pbkdf2Async(sha256, utf8ToBytes(pin), base.salt, {
    c: base.iterations,
    dkLen: KEY_BYTES,
  });
  return serialize({ ...base, hash });
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export async function verifyPasscodeAsync(pin: string, stored: string): Promise<boolean> {
  const record = parsePasscodeRecord(stored);
  if (!record) return false;
  const hash = await pbkdf2Async(sha256, utf8ToBytes(pin), record.salt, {
    c: record.iterations,
    dkLen: record.hash.length,
  });
  return constantTimeEqual(hash, record.hash);
}
