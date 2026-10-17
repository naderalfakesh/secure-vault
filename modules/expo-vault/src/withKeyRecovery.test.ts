import { isKeyLocked, withKeyRecovery } from './withKeyRecovery';

function lockedError() {
  return Object.assign(new Error('Failed to encrypt file: User not authenticated'), {
    code: 'PUT_FILE_FAILED',
  });
}

// Models the Android prompt: one client callback per activity, and a later
// prompt request takes it over, so only the latest caller is ever answered.
function promptHost() {
  let latest: { resolve(unlocked: boolean): void; reject(error: Error): void } | null = null;
  return {
    unlockWithBiometrics: jest.fn(
      () =>
        new Promise<boolean>((resolve, reject) => {
          latest = { resolve, reject };
        }),
    ),
    answer(unlocked: boolean) {
      latest?.resolve(unlocked);
      latest = null;
    },
    fail(error: Error) {
      latest?.reject(error);
      latest = null;
    },
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

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

  it('does not prompt from the background, where the prompt would never answer', async () => {
    let foreground = false;
    let attempts = 0;
    const vault = {
      unlockWithBiometrics: jest.fn(() => new Promise<boolean>(() => {})),
      async getFile() {
        attempts += 1;
        throw lockedError();
      },
    };
    const wrapped = withKeyRecovery(vault, () => foreground);
    await expect(wrapped.getFile()).rejects.toThrow('User not authenticated');
    expect(vault.unlockWithBiometrics).not.toHaveBeenCalled();
    expect(attempts).toBe(1);

    foreground = true;
    vault.unlockWithBiometrics.mockImplementationOnce(async () => false);
    await expect(wrapped.getFile()).rejects.toThrow('User not authenticated');
    expect(vault.unlockWithBiometrics).toHaveBeenCalledTimes(1);
  });

  it('shares one open prompt between a direct unlock and a key-recovery retry', async () => {
    const host = promptHost();
    let attempts = 0;
    const vault = {
      unlockWithBiometrics: host.unlockWithBiometrics,
      async getFile() {
        attempts += 1;
        if (attempts === 1) throw lockedError();
        return 'plain';
      },
    };
    const wrapped = withKeyRecovery(vault);

    // The lock screen prompts; a running restore then hits the lapsed key.
    const unlock = wrapped.unlockWithBiometrics();
    const restore = wrapped.getFile();
    await settle();
    expect(host.unlockWithBiometrics).toHaveBeenCalledTimes(1);

    host.answer(true);
    await expect(unlock).resolves.toBe(true);
    await expect(restore).resolves.toBe('plain');
    expect(attempts).toBe(2);

    // The prompt has closed, so the next request opens a new one.
    const again = wrapped.unlockWithBiometrics();
    await settle();
    expect(host.unlockWithBiometrics).toHaveBeenCalledTimes(2);
    host.answer(false);
    await expect(again).resolves.toBe(false);
  });

  it('fails every waiter closed when the shared prompt is dismissed', async () => {
    const host = promptHost();
    let attempts = 0;
    const vault = {
      unlockWithBiometrics: host.unlockWithBiometrics,
      async getFile() {
        attempts += 1;
        throw lockedError();
      },
    };
    const wrapped = withKeyRecovery(vault);

    const unlock = wrapped.unlockWithBiometrics();
    const restore = wrapped.getFile();
    await settle();
    host.answer(false);
    await expect(unlock).resolves.toBe(false);
    await expect(restore).rejects.toThrow('User not authenticated');
    expect(host.unlockWithBiometrics).toHaveBeenCalledTimes(1);
    expect(attempts).toBe(1);
  });

  it('reports a prompt failure to the direct caller and the original error to the retry', async () => {
    const host = promptHost();
    const vault = {
      unlockWithBiometrics: host.unlockWithBiometrics,
      async getFile() {
        throw lockedError();
      },
    };
    const wrapped = withKeyRecovery(vault);

    const unlock = wrapped.unlockWithBiometrics();
    const restore = wrapped.getFile();
    await settle();
    host.fail(Object.assign(new Error('Too many attempts'), { code: 'BIOMETRIC_AUTH_FAILED' }));
    await expect(unlock).rejects.toThrow('Too many attempts');
    await expect(restore).rejects.toThrow('User not authenticated');

    // A failed prompt does not stay open.
    const again = wrapped.unlockWithBiometrics();
    await settle();
    expect(host.unlockWithBiometrics).toHaveBeenCalledTimes(2);
    host.answer(true);
    await expect(again).resolves.toBe(true);
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
