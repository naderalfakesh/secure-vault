import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useRef,
  useState,
} from 'react';

import { EMPTY_LOCKOUT, type LockoutState } from '@/features/auth/lockout';
import { hashPasscodeAsync } from '@/features/auth/passcode';
import { t } from '@/i18n';
import { documentService } from '@/services/DocumentService';
import { errorCode } from '@/utils/errors';
import vault from '@modules/expo-vault';

import { KEY_PROBE_ENTRY } from '../constants';
import { describeError } from '../errors';
import { launchStatus } from '../helpers';
import { readLaunchState } from '../launchState';
import { type SecuritySettings, sessionStorage } from '../settings';
import type { SessionStatus } from '../types';
import type { VaultAvailability } from './useVaultAvailability';

type Options = {
  statusRef: RefObject<SessionStatus>;
  changeStatus: (next: SessionStatus) => void;
  applyLockout: (next: LockoutState) => void;
  setSettings: Dispatch<SetStateAction<SecuritySettings>>;
  setError: Dispatch<SetStateAction<string | null>>;
  availability: Pick<
    VaultAvailability,
    'setVaultExists' | 'setVaultEmpty' | 'setPinLost' | 'setKeyInvalidated' | 'lostPinResetRef'
  >;
};

export function useVaultSetup({
  statusRef,
  changeStatus,
  applyLockout,
  setSettings,
  setError,
  availability,
}: Options) {
  const { setVaultExists, setVaultEmpty, setPinLost, setKeyInvalidated, lostPinResetRef } =
    availability;
  const [setupHeld, setSetupHeld] = useState(false);
  const setupHeldRef = useRef(false);

  const setUp = useCallback(
    async (pin: string, options: { holdForOnboarding?: boolean } = {}) => {
      setError(null);
      try {
        // Re-read key/PIN before setup so we never create a new key over an existing vault.
        const fresh = await readLaunchState(lostPinResetRef.current);
        if (launchStatus(fresh.key, fresh.pin, fresh.orphaned) === 'unavailable') {
          setPinLost(fresh.pinLost);
          if (fresh.orphaned) setKeyInvalidated(true);
          changeStatus('unavailable');
          return false;
        }
        if (fresh.key === 'present' && fresh.pin === 'present' && fresh.entries !== 0) {
          setVaultExists(true);
          changeStatus('locked');
          return false;
        }
        const exists = fresh.key === 'present';
        setVaultExists(exists);
        if (!exists) await vault.createVault();
        const ok = await vault.unlockWithBiometrics();
        if (!ok) return false;
        try {
          await vault.put(KEY_PROBE_ENTRY, 'ok');
        } catch (probeError) {
          // Empty vault can safely replace an OS-invalidated device key.
          if (
            errorCode(probeError) !== 'KEY_INVALIDATED' ||
            (await vault.getAllKeys()).length > 0
          ) {
            throw probeError;
          }
          await vault.createVault();
          if (!(await vault.unlockWithBiometrics())) return false;
          await vault.put(KEY_PROBE_ENTRY, 'ok');
        }
        // Preserve prior settings (e.g. declined biometrics) when re-adding a lost PIN.
        const kept = await sessionStorage.loadSettings();
        await sessionStorage.savePinRecord(await hashPasscodeAsync(pin));
        lostPinResetRef.current = false;
        await sessionStorage.saveSettings(kept);
        await sessionStorage.saveLockout(EMPTY_LOCKOUT).catch(() => {});
        documentService.allowIndex();
        setSettings(kept);
        applyLockout(EMPTY_LOCKOUT);
        setVaultExists(true);
        setVaultEmpty(false);
        if (options.holdForOnboarding) {
          setupHeldRef.current = true;
          setSetupHeld(true);
        } else {
          changeStatus('unlocked');
        }
        return true;
      } catch (e) {
        setError(describeError(e, t('session.setUpFailed'), 'setup'));
        return false;
      }
    },
    [
      applyLockout,
      changeStatus,
      setError,
      setSettings,
      setVaultExists,
      setVaultEmpty,
      setPinLost,
      setKeyInvalidated,
      lostPinResetRef,
    ],
  );

  const finishSetup = useCallback(() => {
    if (!setupHeldRef.current || statusRef.current !== 'setup') return;
    setupHeldRef.current = false;
    setSetupHeld(false);
    changeStatus('unlocked');
  }, [statusRef, changeStatus]);

  const resetSetup = useCallback(() => {
    setupHeldRef.current = false;
    setSetupHeld(false);
  }, []);

  return { setUp, setupHeld, finishSetup, resetSetup };
}
