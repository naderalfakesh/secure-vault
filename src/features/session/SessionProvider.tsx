import { type PropsWithChildren, useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { SHARE_PAUSE_MAX_AWAY_MS } from './constants';
import { SessionActionsContext, SessionStateContext } from './context';
import { useAutoLock } from './hooks/useAutoLock';
import { useBiometricUnlock } from './hooks/useBiometricUnlock';
import { useLockoutState } from './hooks/useLockoutState';
import { usePinAuth } from './hooks/usePinAuth';
import { useSecuritySettings } from './hooks/useSecuritySettings';
import { useSessionCapture } from './hooks/useSessionCapture';
import { useSessionNotices } from './hooks/useSessionNotices';
import { useSessionStatus } from './hooks/useSessionStatus';
import { useVaultAvailability } from './hooks/useVaultAvailability';
import { useVaultReset } from './hooks/useVaultReset';
import { useVaultSetup } from './hooks/useVaultSetup';
import type { AutoLockPause } from './types';

export { AUTO_LOCK_RETURN_GRACE_MS, DEFAULT_PAUSE_MAX_AWAY_MS } from './constants';
export { useSessionActions, useSessionState } from './context';
export type {
  AutoLockPause,
  PinChangeResult,
  PinUnlockResult,
  SessionActions,
  SessionCapture,
  SessionNotice,
  SessionState,
  SessionStatus,
  ShareInterruption,
} from './types';

/**
 * The pause for a share sheet. On iOS the sheet is in-process and may stay up
 * while the user is away briefly; on Android the chooser is its own activity,
 * so a share still pending after the return was blocked or is gone.
 *
 * Declared here, not re-exported: tests replace it on this module with
 * `jest.spyOn`, which needs a plain export the app's calls go through.
 */
export function sharePause(): AutoLockPause {
  return { maxAwayMs: SHARE_PAUSE_MAX_AWAY_MS, endsOnReturn: Platform.OS === 'android' };
}

/**
 * Owns the lock state for the whole app. The root layout reads `status` to
 * decide which routes exist, so no screen can be reached while locked. The
 * device key gate (biometrics or passcode) and the app PIN are two doors to
 * the same room: both end in `unlocked`, and either can be used to get there.
 *
 * Each concern lives in its own hook; the order of the calls below keeps the
 * order of their effects: the auto-lock limit, the launch read, then the
 * app-state listener.
 */
export function SessionProvider({ children }: PropsWithChildren) {
  const [error, setError] = useState<string | null>(null);
  const { settings, setSettings, autoLockRef, loadProtectedState, updateSettings } =
    useSecuritySettings();
  const core = useSessionStatus();
  const { status, changeStatus } = core;
  const { lockout, lockoutRef, applyLockout } = useLockoutState();
  // What most concerns share: the status and its transition, the lockout, the error.
  const shared = { ...core, applyLockout, setSettings, setError };

  const availability = useVaultAvailability(shared);
  const { biometry, vaultExists, vaultEmpty, pinLost, keyInvalidated } = availability;
  const { launch, retry, resetLostPin, resettingPinRef, markErased } = availability;
  const { withoutAutoLock } = useAutoLock({ ...shared, autoLockRef, launch, resettingPinRef });
  const { unlock, ensureKeyAccess, stepUp } = useBiometricUnlock({
    ...shared,
    loadProtectedState,
    withoutAutoLock,
  });
  const { unlockWithPin, changePin } = usePinAuth({
    ...shared,
    lockoutRef,
    ensureKeyAccess,
    loadProtectedState,
  });
  const { setUp, setupHeld, finishSetup, resetSetup } = useVaultSetup({ ...shared, availability });
  const notices = useSessionNotices();
  const { notice, postNotice, dismissNotice, resetNotices } = notices;
  const { shareInterrupted, markShareInterrupted, clearShareInterrupted } = notices;
  const eraseVault = useVaultReset({ ...shared, resetNotices, markErased, resetSetup });
  const captureSession = useSessionCapture(core);

  const lock = useCallback(() => {
    setError(null);
    changeStatus('locked');
  }, [changeStatus]);

  const state = useMemo(
    () => ({
      status,
      vaultExists,
      vaultEmpty,
      biometry,
      settings,
      lockout,
      setupHeld,
      pinLost,
      keyInvalidated,
      notice,
      shareInterrupted,
      error,
    }),
    [
      status,
      vaultExists,
      vaultEmpty,
      biometry,
      settings,
      lockout,
      setupHeld,
      pinLost,
      keyInvalidated,
      notice,
      shareInterrupted,
      error,
    ],
  );

  // Every function below keeps its identity (state they read goes through a
  // ref), so this value is created once and consumers of it never render again.
  const actions = useMemo(
    () => ({
      unlock,
      unlockWithPin,
      setUp,
      finishSetup,
      retry,
      resetLostPin,
      changePin,
      updateSettings,
      lock,
      stepUp,
      withoutAutoLock,
      captureSession,
      postNotice,
      dismissNotice,
      markShareInterrupted,
      clearShareInterrupted,
      eraseVault,
    }),
    [
      unlock,
      unlockWithPin,
      setUp,
      finishSetup,
      retry,
      resetLostPin,
      changePin,
      updateSettings,
      lock,
      stepUp,
      withoutAutoLock,
      captureSession,
      postNotice,
      dismissNotice,
      markShareInterrupted,
      clearShareInterrupted,
      eraseVault,
    ],
  );

  return (
    <SessionActionsContext.Provider value={actions}>
      <SessionStateContext.Provider value={state}>{children}</SessionStateContext.Provider>
    </SessionActionsContext.Provider>
  );
}
