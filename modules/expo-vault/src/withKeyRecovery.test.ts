import { isKeyLocked, withKeyRecovery } from './withKeyRecovery';

function lockedError() {
  return Object.assign(new Error('Failed to encrypt file: User not authenticated'), {
    code: 'PUT_FILE_FAILED',
  });
}

describe('withKeyRecovery', () => {
  it('recognises the lapsed key window by code or message', () => {
    expect(isKeyLocked(lockedError())).toBe(true);
    expect(isKeyLocked(Object.assign(new Error('x'), { code: 'KEY_LOCKED' }))).toBe(true);
    expect(isKeyLocked(new Error('disk full'))).toBe(false);
    expect(isKeyLocked(null)).toBe(false);
  });

  it('re-authenticates once and retries the failed call', async () => {
    let attempts = 0;
    const vault = {
      unlockWithBiometrics: jest.fn(async () => true),
      async putFile(key: string) {
        attempts += 1;
        if (attempts === 1) throw lockedError();
        return key;
      },
    };
    const wrapped = withKeyRecovery(vault);
    await expect(wrapped.putFile('file_1')).resolves.toBe('file_1');
    expect(vault.unlockWithBiometrics).toHaveBeenCalledTimes(1);
    expect(attempts).toBe(2);
  });

  it('surfaces the original error when the user declines and for other failures', async () => {
    const decliningVault = {
      unlockWithBiometrics: async () => false,
      async getFile() {
        throw lockedError();
      },
    };
    const declined = withKeyRecovery(decliningVault);
    await expect(declined.getFile()).rejects.toThrow('User not authenticated');

    const corruptVault = {
      unlockWithBiometrics: jest.fn(async () => true),
      async getFile() {
        throw new Error('corrupt');
      },
    };
    const other = withKeyRecovery(corruptVault);
    await expect(other.getFile()).rejects.toThrow('corrupt');
    expect(corruptVault.unlockWithBiometrics).not.toHaveBeenCalled();
  });

  it('leaves synchronous helpers such as event subscriptions alone', () => {
    const subscription = { remove: jest.fn() };
    const vault = {
      unlockWithBiometrics: async () => true,
      addListener: () => subscription,
    };
    const wrapped = withKeyRecovery(vault);
    expect(wrapped.addListener()).toBe(subscription);
  });
});
