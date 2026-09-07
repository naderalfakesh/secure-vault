import { pbkdf2, pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils.js';

// The PIN is never stored in the clear. It is stretched with PBKDF2-SHA256 and
// a per-device random salt, and only the resulting record is written to the
// vault (itself encrypted by the device key). A 6-digit PIN has a tiny
// keyspace, so this is defense in depth against a leaked record rather than a
// substitute for the OS gate; the iteration count keeps verification quick on
// the JS thread of a mid-range phone.
const SCHEME = 'pbkdf2-sha256';
const DEFAULT_ITERATIONS = 4096;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

export interface PasscodeRecord {
  scheme: typeof SCHEME;
  iterations: number;
  salt: Uint8Array;
  hash: Uint8Array;
}

export interface HashPasscodeOptions {
  iterations?: number;
  /** Test hook. Production callers let a fresh salt be drawn. */
  salt?: Uint8Array;
}

function serialize(record: PasscodeRecord): string {
  return [record.scheme, record.iterations, bytesToHex(record.salt), bytesToHex(record.hash)].join(
    '$',
  );
}

/** Parses a serialized record, or returns null for anything that is not one. */
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
    salt: opts.salt ?? randomBytes(SALT_BYTES),
  };
}

/** Derives a fresh record for `pin`. Synchronous; prefer the async variant on the UI thread. */
export function hashPasscode(pin: string, opts: HashPasscodeOptions = {}): string {
  const base = newRecord(opts);
  const hash = pbkdf2(sha256, utf8ToBytes(pin), base.salt, {
    c: base.iterations,
    dkLen: KEY_BYTES,
  });
  return serialize({ ...base, hash });
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

/** Checks `pin` against a serialized record. Malformed records never verify. */
export function verifyPasscode(pin: string, stored: string): boolean {
  const record = parsePasscodeRecord(stored);
  if (!record) return false;
  const hash = pbkdf2(sha256, utf8ToBytes(pin), record.salt, {
    c: record.iterations,
    dkLen: record.hash.length,
  });
  return constantTimeEqual(hash, record.hash);
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
