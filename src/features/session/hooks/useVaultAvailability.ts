import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { type LockoutState, unreadableLockout } from '@/features/auth/lockout';
import { t } from '@/i18n';
import { errorCode, KEY_INVALIDATED_MESSAGE } from '@/utils/errors';
import vault, { type BiometryType } from '@modules/expo-vault';

import { KEY_PROBE_ENTRY } from '../constants';
import { describeError, keyNotUnlocked } from '../errors';
import { reconcileInstall } from '../freshInstall';
import { launchStatus } from '../helpers';
import { readLaunchState } from '../launchState';
import { type SecuritySettings, sessionStorage } from '../settings';
import type { SessionStatus } from '../types';

type Options = {
  statusRef: RefObject<SessionStatus>;
  changeStatus: (next: SessionStatus) => void;
  applyLockout: (next: LockoutState) => void;
  setSettings: Dispatch<SetStateAction<SecuritySettings>>;
  setError: Dispatch<SetStateAction<string | null>>;
};

/**
 * Whether there is a vault and whether it can be read: the launch read, the
 * retry after `unavailable`, and the way on after a lost PIN record.
 */
export function useVaultAvailability({
  statusRef,
  changeStatus,
  applyLockout,
  setSettings,
  setError,
}: Options) {
  const [biometry, setBiometry] = useState<BiometryType>('none');
  const [vaultExists, setVaultExists] = useState(false);
  const [vaultEmpty, setVaultEmpty] = useState(false);
  const [pinLost, setPinLost] = useState(false);
  const [keyInvalidated, setKeyInvalidated] = useState(false);
  // Set once the device key's gate opened for a lost PIN record; in memory only.
  const lostPinResetRef = useRef(false);
  // True while that gate's prompt is up, so a foreground return does not relaunch under it.
  const resettingPinRef = useRef(false);
  // One launch read at a time, so a retry and a foreground return never race.
  const launchingRef = useRef<Promise<SessionStatus> | null>(null);

  const activeRef = useRef(true);
  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  const launch = useCallback((): Promise<SessionStatus> => {
    launchingRef.current ??= (async () => {
      try {
        // iOS: a reinstall's leftover Keychain items go before anything reads them.
        await reconcileInstall();
        const {
          key,
          type,
          pin,
          pinLost: lost,
          storedLockout,
          entries,
          orphaned,
        } = await readLaunchState(lostPinResetRef.current);
        if (!activeRef.current) return statusRef.current;
        setBiometry(type);
        setPinLost(lost);
        if (orphaned) setKeyInvalidated(true);
        applyLockout(storedLockout ?? unreadableLockout(Date.now()));
        const next = launchStatus(key, pin, orphaned);
        if (next !== 'unavailable') {
          const exists = key === 'present';
          setVaultExists(exists);
          setVaultEmpty(exists && entries === 0);
          // The lock screen needs to know whether biometric unlock is on. The
          // settings sit in the same store as the PIN record, readable before
          // the device key; a failed read keeps the defaults.
          if (next === 'locked') setSettings(await sessionStorage.loadSettings());
        }
        // A key without a PIN record is either the 2025 prototype's vault or an
        // interrupted setup. Both go through setup again, and setUp keeps the
        // existing key so nothing already encrypted is lost.
        if (activeRef.current) changeStatus(next);
        return next;
      } finally {
        launchingRef.current = null;
      }
    })();
    return launchingRef.current;
  }, [statusRef, changeStatus, applyLockout, setSettings]);

  useEffect(() => {
    void launch();
  }, [launch]);

  const retry = useCallback(async () => {
    if (statusRef.current !== 'unavailable') return statusRef.current;
    return launch();
  }, [statusRef, launch]);

  const resetLostPin = useCallback(async () => {
    if (!pinLost || statusRef.current !== 'unavailable' || resettingPinRef.current) return false;
    setError(null);
    resettingPinRef.current = true;
    try {
      if (!(await vault.unlockWithBiometrics())) {
        // The PIN is what was lost, so there is none to enter instead.
        setError(keyNotUnlocked.resetPin);
        return false;
      }
      // An invalidated key is reported at once, with no second prompt. With
      // entries left nothing can be decrypted again, so setup would stop on
      // them; an empty vault goes on, and setup replaces the key.
      try {
        await vault.get(KEY_PROBE_ENTRY);
      } catch (probeError) {
        if (errorCode(probeError) === 'KEY_INVALIDATED' && (await vault.getAllKeys()).length > 0) {
          setKeyInvalidated(true);
          setError(KEY_INVALIDATED_MESSAGE);
          return false;
        }
      }
      lostPinResetRef.current = true;
      // Read everything again: only a lost PIN with its key present goes on to setup.
      const next = await launch();
      if (next !== 'setup') lostPinResetRef.current = false;
      return next === 'setup';
    } catch (e) {
      setError(describeError(e, t('session.unlockKeyFailed'), 'resetPin'));
      return false;
    } finally {
      resettingPinRef.current = false;
    }
  }, [statusRef, launch, pinLost, setError]);

  /** After "Delete everything": an empty vault with nothing lost or invalidated. */
  const markErased = useCallback(() => {
    setVaultEmpty(true);
    setPinLost(false);
    setKeyInvalidated(false);
    lostPinResetRef.current = false;
  }, []);

  return {
    biometry,
    vaultExists,
    setVaultExists,
    vaultEmpty,
    setVaultEmpty,
    pinLost,
    setPinLost,
    keyInvalidated,
    setKeyInvalidated,
    lostPinResetRef,
    resettingPinRef,
    launch,
    retry,
    resetLostPin,
    markErased,
  };
}

export type VaultAvailability = ReturnType<typeof useVaultAvailability>;
