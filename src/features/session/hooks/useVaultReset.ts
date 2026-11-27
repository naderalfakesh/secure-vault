import { type Dispatch, type SetStateAction, useCallback } from 'react';

import { EMPTY_LOCKOUT, type LockoutState } from '@/features/auth/lockout';

import { DEFAULT_SETTINGS, type SecuritySettings, sessionStorage } from '../settings';
import type { SessionStatus } from '../types';

type Options = {
  setSettings: Dispatch<SetStateAction<SecuritySettings>>;
  applyLockout: (next: LockoutState) => void;
  setError: Dispatch<SetStateAction<string | null>>;
  resetNotices: () => void;
  markErased: () => void;
  resetSetup: () => void;
  changeStatus: (next: SessionStatus) => void;
};

export function useVaultReset({
  setSettings,
  applyLockout,
  setError,
  resetNotices,
  markErased,
  resetSetup,
  changeStatus,
}: Options) {
  return useCallback(async () => {
    // Retry once for transient expo-secure-store Keychain delete refusals.
    const cleared = await sessionStorage
      .clear()
      .catch(() => sessionStorage.clear())
      .then(
        () => true,
        () => false,
      );
    setSettings(DEFAULT_SETTINGS);
    applyLockout(EMPTY_LOCKOUT);
    setError(null);
    resetNotices();
    markErased();
    resetSetup();
    changeStatus('setup');
    return cleared;
  }, [setSettings, applyLockout, setError, resetNotices, markErased, resetSetup, changeStatus]);
}
