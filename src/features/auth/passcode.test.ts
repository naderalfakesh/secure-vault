import { hashPasscode } from '@/testing/passcode';

import {
  hashPasscodeAsync,
  isPasscodeRecord,
  parsePasscodeRecord,
  verifyPasscodeAsync,
} from './passcode';

const SALT = new Uint8Array(16).fill(7);

describe('hashPasscodeAsync', () => {
  it('produces a self-describing record', async () => {
    const record = parsePasscodeRecord(
      await hashPasscodeAsync('123456', { salt: SALT, iterations: 64 }),
    );
    expect(record?.scheme).toBe('pbkdf2-sha256');
    expect(record?.iterations).toBe(64);
    expect(record?.salt).toEqual(SALT);
    expect(record?.hash).toHaveLength(32);
  });

  it('is deterministic for the same salt and different across salts', async () => {
    // The tests' synchronous seed helper writes the same records.
    const a = hashPasscode('123456', { salt: SALT, iterations: 64 });
    const b = await hashPasscodeAsync('123456', { salt: SALT, iterations: 64 });
    const c = await hashPasscodeAsync('123456', { iterations: 64 });
    expect(a).toBe(b);
    expect(c).not.toBe(a);
  });
});

describe('verifyPasscodeAsync', () => {
  const stored = hashPasscode('123456', { iterations: 64 });

  it('accepts the original pin and rejects others', async () => {
    expect(await verifyPasscodeAsync('123456', stored)).toBe(true);
    expect(await verifyPasscodeAsync('123457', stored)).toBe(false);
    expect(await verifyPasscodeAsync('654321', stored)).toBe(false);
  });

  it('never verifies against a malformed or plaintext value', async () => {
    expect(await verifyPasscodeAsync('123456', '123456')).toBe(false);
    expect(await verifyPasscodeAsync('123456', '')).toBe(false);
    expect(await verifyPasscodeAsync('123456', 'pbkdf2-sha256$0$00$00')).toBe(false);
    expect(isPasscodeRecord(stored)).toBe(true);
    expect(isPasscodeRecord('000000')).toBe(false);
  });
});
