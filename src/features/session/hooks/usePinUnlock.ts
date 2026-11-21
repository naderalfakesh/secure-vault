import { type Dispatch, type RefObject, type SetStateAction, useCallback, useRef } from 'react';

import { EMPTY_LOCKOUT, isLocked, type LockoutState, recordFailure } from '@/features/auth/lockout';
import { hashPasscodeAsync, verifyPasscodeAsync } from '@/features/auth/passcode';
import { t } from '@/i18n';

import { describeError } from '../errors';
import { currentLockout } from '../helpers';
import { loadCappedLockout } from '../launchState';
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

/** The app PIN: unlocking with it and changing it, both judged against the lockout. */
export function usePinUnlock({
  statusRef,
  lockoutRef,
  applyLockout,
  changeStatus,
  setError,
  ensureKeyAccess,
  loadProtectedState,
}: Options) {
  // One PIN attempt at a time, so two in flight cannot both count from the same state.
  const attemptingRef = useRef(false);

  const checkPin = useCallback(
    async (pin: string): Promise<PinUnlockResult> => {
      // The stored copy outlives a relaunch and the one in memory outlives a
      // failed write; the attempt is judged against the stricter of the two.
      const stored = await loadCappedLockout();
      const now = Date.now();
      const current = currentLockout(lockoutRef.current, stored, now);
      applyLockout(current);
      if (isLocked(current, now)) return 'not-unlocked';
      try {
        // The PIN record is in the secure store, readable without the device
        // key; a store that refuses the read is not a wrong PIN.
        const record = await sessionStorage.loadPinRecord();
        const ok = record ? await verifyPasscodeAsync(pin, record) : false;
        if (ok) {
          // The PIN opens the app; the device key still needs the OS gate if its
          // authentication window has lapsed. iOS prompts on first Keychain read,
          // Android needs an explicit prompt, so probe and re-arm when required.
          // A key prompt the user cancelled is not a wrong PIN.
          if (!(await ensureKeyAccess())) return 'not-unlocked';
          await loadProtectedState();
          applyLockout(EMPTY_LOCKOUT);
          await sessionStorage.saveLockout(EMPTY_LOCKOUT).catch(() => {});
          changeStatus('unlocked');
          return 'unlocked';
        }
        const next = recordFailure(current, now);
        applyLockout(next);
        // A stored copy that could not be read may be stricter; leave it be.
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
      // Nothing is judged before the startup read of the stored lockout landed,
      // or while another attempt is still being judged.
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
      // The current PIN is judged like one typed on the lock screen: against
      // the same lockout, one attempt at a time, and a wrong one counts, so an
      // unlocked session cannot guess without limit. The device unlock on the
      // lock screen still ends the pause.
      // A second call while one is judged changes nothing and resets nothing.
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
          // A stored copy that could not be read may be stricter; leave it be.
          if (stored) await sessionStorage.saveLockout(next).catch(() => {});
          return 'wrong-pin';
        }
        if (current.failures > 0) {
          applyLockout(EMPTY_LOCKOUT);
          await sessionStorage.saveLockout(EMPTY_LOCKOUT).catch(() => {});
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
