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

function isThenable(value: unknown): value is Promise<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  );
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
      const method = value as (...args: unknown[]) => unknown;
      return (...args: unknown[]) => {
        const result = method.apply(target, args);
        // Only promise-returning vault calls take part; event subscriptions
        // and other synchronous helpers pass through untouched.
        if (!isThenable(result)) return result;
        return result.catch(async (error: unknown) => {
          if (!isKeyLocked(error)) throw error;
          const unlocked = await target.unlockWithBiometrics().catch(() => false);
          if (!unlocked) throw error;
          return method.apply(target, args);
        });
      };
    },
  });
}
