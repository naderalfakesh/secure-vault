import { type Dispatch, type SetStateAction, useCallback } from 'react';

import type { LockoutState } from '@/features/auth/lockout';
import { t } from '@/i18n';
import vault, { isKeyLocked } from '@modules/expo-vault';

import { KEY_PROBE_ENTRY } from '../constants';
import { describeError, KEY_NOT_UNLOCKED } from '../errors';
import { clearLockout } from '../launchState';
import type { SessionActions, SessionStatus } from '../types';

type Options = {
  setError: Dispatch<SetStateAction<string | null>>;
  loadProtectedState: () => Promise<void>;
  applyLockout: (next: LockoutState) => void;
  changeStatus: (next: SessionStatus) => void;
  withoutAutoLock: SessionActions['withoutAutoLock'];
};

export function useBiometricUnlock({
  setError,
  loadProtectedState,
  applyLockout,
  changeStatus,
  withoutAutoLock,
}: Options) {
  const ensureKeyAccess = useCallback(async () => {
    try {
      await vault.get(KEY_PROBE_ENTRY);
      return true;
    } catch (probeError) {
      // Key recovery already prompted for a locked key; don't open a second prompt after cancel.
      if (isKeyLocked(probeError)) {
        setError(KEY_NOT_UNLOCKED);
        return false;
      }
      try {
        if (await vault.unlockWithBiometrics()) return true;
        setError(KEY_NOT_UNLOCKED);
        return false;
      } catch (e) {
        setError(describeError(e, t('session.unlockKeyFailed')));
        return false;
      }
    }
  }, [setError]);

  const unlock = useCallback(async () => {
    setError(null);
    try {
      const ok = await vault.unlockWithBiometrics();
      if (ok) {
        await loadProtectedState();
        await clearLockout(applyLockout);
        changeStatus('unlocked');
      }
      return ok;
    } catch (e) {
      setError(describeError(e, t('session.unlockFailed')));
      return false;
    }
  }, [setError, loadProtectedState, applyLockout, changeStatus]);

  const stepUp = useCallback(
    () =>
      withoutAutoLock(async () => {
        try {
          return await vault.unlockWithBiometrics();
        } catch {
          return false;
        }
      }),
    [withoutAutoLock],
  );

  return { unlock, ensureKeyAccess, stepUp };
}
