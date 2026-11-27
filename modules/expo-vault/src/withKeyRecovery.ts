interface KeyRecoveryTarget {
  unlockWithBiometrics(): Promise<boolean>;
}

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
 * Retries Android Keystore KEY_LOCKED errors after prompting (foreground-only so background calls never hang).
 * Coalesces concurrent prompts because Android BiometricPrompt keeps a single callback per activity.
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
