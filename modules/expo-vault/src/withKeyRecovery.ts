export interface KeyRecoveryTarget {
  unlockWithBiometrics(): Promise<boolean>;
}

/**
 * True for the error the Android Keystore raises once its authentication
 * window has lapsed: the key exists but needs the user to authenticate again.
 */
export function isKeyLocked(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (code === 'KEY_LOCKED') return true;
  return typeof message === 'string' && /not authenticated/i.test(message);
}

/**
 * Wraps the native vault so that a call failing with a locked key prompts the
 * system credential once and retries. On iOS the Keychain shows its own
 * prompt, so the wrapper only ever engages on Android.
 */
export function withKeyRecovery<T extends KeyRecoveryTarget>(vault: T): T {
  return new Proxy(vault, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver) as unknown;
      if (typeof value !== 'function' || property === 'unlockWithBiometrics') return value;
      const method = value as (...args: unknown[]) => Promise<unknown>;
      return async (...args: unknown[]) => {
        try {
          return await method.apply(target, args);
        } catch (error) {
          if (!isKeyLocked(error)) throw error;
          const unlocked = await target.unlockWithBiometrics().catch(() => false);
          if (!unlocked) throw error;
          return method.apply(target, args);
        }
      };
    },
  });
}
