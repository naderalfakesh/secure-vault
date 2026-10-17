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
 * prompt, so the wrapper only ever engages on Android. It only prompts while
 * `isForeground` holds: a prompt requested from the background is never shown
 * and would leave the caller waiting.
 *
 * One prompt is open at a time. Android keeps a single prompt callback per
 * activity, so a second prompt requested while one is showing takes over its
 * answer and the first caller never hears back. Every caller that asks while
 * a prompt is open shares that prompt's outcome instead.
 */
export function withKeyRecovery<T extends KeyRecoveryTarget>(
  vault: T,
  isForeground: () => boolean = () => true,
): T {
  let openPrompt: Promise<boolean> | null = null;
  const unlockWithBiometrics = (): Promise<boolean> => {
    if (!openPrompt) {
      openPrompt = Promise.resolve()
        .then(() => vault.unlockWithBiometrics())
        .finally(() => {
          openPrompt = null;
        });
    }
    return openPrompt;
  };

  return new Proxy(vault, {
    get(target, property, receiver) {
      if (property === 'unlockWithBiometrics') return unlockWithBiometrics;
      const value = Reflect.get(target, property, receiver) as unknown;
      if (typeof value !== 'function') return value;
      const method = value as (...args: unknown[]) => unknown;
      return (...args: unknown[]) => {
        const result = method.apply(target, args);
        // Only promise-returning vault calls take part; event subscriptions
        // and other synchronous helpers pass through untouched.
        if (!isThenable(result)) return result;
        return result.catch(async (error: unknown) => {
          if (!isKeyLocked(error) || !isForeground()) throw error;
          const unlocked = await unlockWithBiometrics().catch(() => false);
          if (!unlocked) throw error;
          return method.apply(target, args);
        });
      };
    },
  });
}
