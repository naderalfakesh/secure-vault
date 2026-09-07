import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import vault from '../../../modules/expo-vault';

export type SessionStatus = 'loading' | 'setup' | 'locked' | 'unlocked';

export type SessionContextValue = {
  status: SessionStatus;
  /** Prompts for biometrics or the device passcode; resolves false when cancelled or failed. */
  unlock: () => Promise<boolean>;
  /** Generates the device key, then unlocks. */
  setUp: () => Promise<boolean>;
  lock: () => void;
  /** Last unlock or setup failure, cleared on the next attempt. */
  error: string | null;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function describeError(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

/**
 * Owns the lock state for the whole app. The root layout reads `status` to
 * decide which routes exist, so no screen can be reached while locked.
 */
export function SessionProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    vault
      .hasVault()
      .then((exists) => {
        if (active) setStatus(exists ? 'locked' : 'setup');
      })
      .catch(() => {
        if (active) setStatus('setup');
      });
    return () => {
      active = false;
    };
  }, []);

  const unlock = useCallback(async () => {
    setError(null);
    try {
      const ok = await vault.unlockWithBiometrics();
      if (ok) setStatus('unlocked');
      return ok;
    } catch (e) {
      setError(describeError(e, 'Could not unlock the vault.'));
      return false;
    }
  }, []);

  const setUp = useCallback(async () => {
    setError(null);
    try {
      await vault.createVault();
    } catch (e) {
      setError(describeError(e, 'Could not create the vault.'));
      return false;
    }
    return unlock();
  }, [unlock]);

  const lock = useCallback(() => {
    setError(null);
    setStatus('locked');
  }, []);

  const value = useMemo(
    () => ({ status, unlock, setUp, lock, error }),
    [status, unlock, setUp, lock, error],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used inside SessionProvider');
  }
  return context;
}
