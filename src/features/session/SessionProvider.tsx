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

// Android's share chooser is a separate activity (`endsOnReturn`); kept as a direct export for jest.spyOn.
export function sharePause(): AutoLockPause {
  return { maxAwayMs: SHARE_PAUSE_MAX_AWAY_MS, endsOnReturn: Platform.OS === 'android' };
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [error, setError] = useState<string | null>(null);
  // Hook order preserves effect sequence: auto-lock limit, launch read, then app-state listener.
  const { settings, setSettings, autoLockRef, loadProtectedState, updateSettings } =
    useSecuritySettings();
  const core = useSessionStatus();
  const { status, changeStatus } = core;
  const { lockout, lockoutRef, applyLockout } = useLockoutState();
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
