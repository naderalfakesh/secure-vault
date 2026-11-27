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
  const lostPinResetRef = useRef(false);
  const resettingPinRef = useRef(false);
  // Deduplicate concurrent launch reads (e.g. retry vs foreground return).
  const launchingRef = useRef<Promise<SessionStatus> | null>(null);

  const activeRef = useRef(true);
  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  const pinLostRef = useRef(pinLost);
  useEffect(() => {
    pinLostRef.current = pinLost;
  }, [pinLost]);

  const launch = useCallback((): Promise<SessionStatus> => {
    launchingRef.current ??= (async () => {
      try {
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
          if (next === 'locked') setSettings(await sessionStorage.loadSettings());
        }
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
    if (!pinLostRef.current || statusRef.current !== 'unavailable' || resettingPinRef.current)
      return false;
    setError(null);
    resettingPinRef.current = true;
    try {
      if (!(await vault.unlockWithBiometrics())) {
        setError(keyNotUnlocked.resetPin);
        return false;
      }
      // Probe immediately so KEY_INVALIDATED fails fast without a second prompt.
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
      const next = await launch();
      if (next !== 'setup') lostPinResetRef.current = false;
      return next === 'setup';
    } catch (e) {
      setError(describeError(e, t('session.unlockKeyFailed'), 'resetPin'));
      return false;
    } finally {
      resettingPinRef.current = false;
    }
  }, [statusRef, launch, setError]);

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
