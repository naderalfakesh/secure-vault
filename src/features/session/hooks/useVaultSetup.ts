import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useRef,
  useState,
} from 'react';

import { hashPasscodeAsync } from '@/features/auth/passcode';
import { EMPTY_LOCKOUT, type LockoutState } from '@/features/auth/lockout';
import { t } from '@/i18n';
import { documentService } from '@/services/DocumentService';

import vault from '../../../../modules/expo-vault';
import { KEY_PROBE_ENTRY } from '../constants';
import { describeError, errorCode } from '../errors';
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

/** First run: the device key, the hashed PIN, and the hold for onboarding's last step. */
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
        // Launch may have been a while ago, or wrong: read the key and PIN
        // again so setup never creates a key over a vault it cannot see.
        const fresh = await readLaunchState(lostPinResetRef.current);
        if (launchStatus(fresh.key, fresh.pin, fresh.orphaned) === 'unavailable') {
          setPinLost(fresh.pinLost);
          if (fresh.orphaned) setKeyInvalidated(true);
          changeStatus('unavailable');
          return false;
        }
        // A vault with a PIN and entries is opened, never set up again. An
        // emptied one may still hold a PIN an erase could not remove.
        if (fresh.key === 'present' && fresh.pin === 'present' && fresh.entries !== 0) {
          setVaultExists(true);
          changeStatus('locked');
          return false;
        }
        const exists = fresh.key === 'present';
        setVaultExists(exists);
        // Only a brand-new vault gets a key; an existing one keeps what it has.
        if (!exists) await vault.createVault();
        const ok = await vault.unlockWithBiometrics();
        if (!ok) return false;
        try {
          await vault.put(KEY_PROBE_ENTRY, 'ok');
        } catch (probeError) {
          // "Delete everything" keeps the device key; one the system invalidated
          // can never encrypt again, and an empty vault loses nothing by a new one.
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
        // Settings stored by an earlier setup are kept: a new PIN after a lost
        // one (Add a PIN, which offers no biometrics step) must not turn Face ID
        // back on when the owner declined it. "Delete everything" removed them,
        // so a new vault starts from the defaults.
        const kept = await sessionStorage.loadSettings();
        await sessionStorage.savePinRecord(await hashPasscodeAsync(pin));
        lostPinResetRef.current = false;
        await sessionStorage.saveSettings(kept);
        await sessionStorage.saveLockout(EMPTY_LOCKOUT).catch(() => {});
        // Only setup creates the index and its key, once the screens behind the gate mount.
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

  /** Drops a held setup, as "Delete everything" does. */
  const resetSetup = useCallback(() => {
    setupHeldRef.current = false;
    setSetupHeld(false);
  }, []);

  return { setUp, setupHeld, finishSetup, resetSetup };
}
