import { type Dispatch, type RefObject, type SetStateAction, useCallback, useRef } from 'react';

import { isLocked, type LockoutState, recordFailure } from '@/features/auth/lockout';
import { hashPasscodeAsync, verifyPasscodeAsync } from '@/features/auth/passcode';
import { t } from '@/i18n';

import { describeError } from '../errors';
import { currentLockout } from '../helpers';
import { clearLockout, loadCappedLockout } from '../launchState';
import { sessionStorage } from '../settings';
import type { PinChangeResult, PinUnlockResult, SessionStatus } from '../types';

type Options = {
  statusRef: RefObject<SessionStatus>;
  lockoutRef: RefObject<LockoutState>;
  applyLockout: (next: LockoutState) => void;
  changeStatus: (next: SessionStatus) => void;
  setError: Dispatch<SetStateAction<string | null>>;
  ensureKeyAccess: () => Promise<boolean>;
  loadProtectedState: () => Promise<void>;
};

export function usePinAuth({
  statusRef,
  lockoutRef,
  applyLockout,
  changeStatus,
  setError,
  ensureKeyAccess,
  loadProtectedState,
}: Options) {
  // Serialize PIN attempts so concurrent calls cannot count from the same lockout state.
  const attemptingRef = useRef(false);

  const checkPin = useCallback(
    async (pin: string): Promise<PinUnlockResult> => {
      const stored = await loadCappedLockout();
      const now = Date.now();
      const current = currentLockout(lockoutRef.current, stored, now);
      applyLockout(current);
      if (isLocked(current, now)) return 'not-unlocked';
      try {
        const record = await sessionStorage.loadPinRecord();
        const ok = record ? await verifyPasscodeAsync(pin, record) : false;
        if (ok) {
          // Re-arm the OS key gate if its auth window lapsed (cancelled prompt is not a wrong PIN).
          if (!(await ensureKeyAccess())) return 'not-unlocked';
          await loadProtectedState();
          await clearLockout(applyLockout);
          changeStatus('unlocked');
          return 'unlocked';
        }
        const next = recordFailure(current, now);
        applyLockout(next);
        // Preserve an unreadable stored lockout since it may be stricter.
        if (stored) await sessionStorage.saveLockout(next).catch(() => {});
        return 'wrong-pin';
      } catch (e) {
        setError(describeError(e, t('session.checkPinFailed')));
        return 'not-unlocked';
      }
    },
    [lockoutRef, loadProtectedState, ensureKeyAccess, applyLockout, changeStatus, setError],
  );

  const unlockWithPin = useCallback(
    async (pin: string): Promise<PinUnlockResult> => {
      setError(null);
      if (statusRef.current === 'loading' || attemptingRef.current) return 'not-unlocked';
      attemptingRef.current = true;
      try {
        return await checkPin(pin);
      } finally {
        attemptingRef.current = false;
      }
    },
    [statusRef, setError, checkPin],
  );

  const changePin = useCallback(
    async (currentPin: string, nextPin: string): Promise<PinChangeResult> => {
      setError(null);
      if (attemptingRef.current) return 'busy';
      attemptingRef.current = true;
      try {
        const stored = await loadCappedLockout();
        const now = Date.now();
        const current = currentLockout(lockoutRef.current, stored, now);
        applyLockout(current);
        if (isLocked(current, now)) return 'locked-out';
        const record = await sessionStorage.loadPinRecord();
        if (!record || !(await verifyPasscodeAsync(currentPin, record))) {
          const next = recordFailure(current, now);
          applyLockout(next);
          if (stored) await sessionStorage.saveLockout(next).catch(() => {});
          return 'wrong-pin';
        }
        if (current.failures > 0) {
          await clearLockout(applyLockout);
        }
        await sessionStorage.savePinRecord(await hashPasscodeAsync(nextPin));
        return 'changed';
      } catch (e) {
        setError(describeError(e, t('session.changePinFailed'), 'changePin'));
        return 'failed';
      } finally {
        attemptingRef.current = false;
      }
    },
    [lockoutRef, applyLockout, setError],
  );

  return { unlockWithPin, changePin };
}
