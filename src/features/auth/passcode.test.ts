import {
  hashPasscode,
  hashPasscodeAsync,
  isPasscodeRecord,
  parsePasscodeRecord,
  verifyPasscode,
  verifyPasscodeAsync,
} from './passcode';

const SALT = new Uint8Array(16).fill(7);

describe('hashPasscode', () => {
  it('produces a self-describing record', () => {
    const record = parsePasscodeRecord(hashPasscode('123456', { salt: SALT, iterations: 64 }));
    expect(record?.scheme).toBe('pbkdf2-sha256');
    expect(record?.iterations).toBe(64);
    expect(record?.salt).toEqual(SALT);
    expect(record?.hash).toHaveLength(32);
  });

  it('is deterministic for the same salt and different across salts', async () => {
    const a = hashPasscode('123456', { salt: SALT, iterations: 64 });
    const b = await hashPasscodeAsync('123456', { salt: SALT, iterations: 64 });
    const c = hashPasscode('123456', { iterations: 64 });
    expect(a).toBe(b);
    expect(c).not.toBe(a);
  });
});

describe('verifyPasscode', () => {
  const stored = hashPasscode('123456', { iterations: 64 });

  it('accepts the original pin and rejects others', async () => {
    expect(verifyPasscode('123456', stored)).toBe(true);
    expect(await verifyPasscodeAsync('123456', stored)).toBe(true);
    expect(verifyPasscode('123457', stored)).toBe(false);
    expect(await verifyPasscodeAsync('654321', stored)).toBe(false);
  });

  it('never verifies against a malformed or plaintext value', () => {
    expect(verifyPasscode('123456', '123456')).toBe(false);
    expect(verifyPasscode('123456', '')).toBe(false);
    expect(verifyPasscode('123456', 'pbkdf2-sha256$0$00$00')).toBe(false);
    expect(isPasscodeRecord(stored)).toBe(true);
    expect(isPasscodeRecord('000000')).toBe(false);
  });
});
