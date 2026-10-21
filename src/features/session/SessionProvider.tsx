import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { hashPasscodeAsync, verifyPasscodeAsync } from '@/features/auth/passcode';
import {
  clampLockout,
  EMPTY_LOCKOUT,
  isLocked,
  type LockoutState,
  recordFailure,
  strictestLockout,
  unreadableLockout,
} from '@/features/auth/lockout';

import { documentService } from '@/services/DocumentService';
import { KEY_INVALIDATED_MESSAGE } from '@/utils/errors';

import vault, { type BiometryType } from '../../../modules/expo-vault';
import { isKeyLocked } from '../../../modules/expo-vault/src/withKeyRecovery';
import { DEFAULT_SETTINGS, type SecuritySettings, sessionStorage } from './settings';

export type SessionStatus = 'loading' | 'setup' | 'locked' | 'unlocked';

/** The unlocked session a piece of work started in. */
export type SessionCapture = {
  /** True while that same session is still unlocked. */
  current: () => boolean;
  /**
   * Resolves true once the app is in the foreground with any time away already
   * checked against auto-lock, and that same session is still unlocked;
   * resolves false as soon as it has ended. Call it right before presenting
   * system UI such as a share sheet.
   */
  confirm: () => Promise<boolean>;
};

/** How a PIN attempt ended. Only `wrong-pin` counts towards the lockout. */
export type PinUnlockResult = 'unlocked' | 'wrong-pin' | 'not-unlocked';

/** How a PIN change ended. `failed` leaves the reason in `error`. */
export type PinChangeResult = 'changed' | 'wrong-pin' | 'failed';

export type SessionNotice = { message: string; tone?: 'neutral' | 'success' | 'danger' };

// A tiny vault entry whose read proves the device key is currently usable.
const KEY_PROBE_ENTRY = '_key_probe';

export type SessionContextValue = {
  status: SessionStatus;
  /** True during setup when a device key already exists (upgrade from the prototype, or an interrupted setup). */
  vaultExists: boolean;
  /**
   * True during setup when that device key guards no entries at all, e.g.
   * after "Delete everything": there are no documents that stay.
   */
  vaultEmpty: boolean;
  biometry: BiometryType;
  settings: SecuritySettings;
  lockout: LockoutState;
  /** Prompts for biometrics or the device passcode; resolves false when cancelled or failed. */
  unlock: () => Promise<boolean>;
  /** Checks a PIN, records failures for the lockout policy, and unlocks on success. */
  unlockWithPin: (pin: string) => Promise<PinUnlockResult>;
  /** First run: creates the device key and stores the hashed PIN, then unlocks. */
  setUp: (pin: string) => Promise<boolean>;
  changePin: (currentPin: string, nextPin: string) => Promise<PinChangeResult>;
  updateSettings: (changes: Partial<SecuritySettings>) => Promise<void>;
  lock: () => void;
  /** Ask for biometrics again for a sensitive action such as sharing. */
  stepUp: () => Promise<boolean>;
  /**
   * Runs `work` with auto-lock paused. System pickers, the camera, the scanner,
   * and share sheets send the app to the background without the user leaving it.
   */
  withoutAutoLock: <T>(work: () => Promise<T>) => Promise<T>;
  /** Captures the current unlocked session so long work can tell whether it ended. */
  captureSession: () => SessionCapture;
  /** A message for work that ended behind the lock; shown once the vault is unlocked. */
  notice: SessionNotice | null;
  postNotice: (notice: SessionNotice) => void;
  dismissNotice: () => void;
  /**
   * Forget the PIN, settings, and lockout after the vault was emptied; returns
   * to setup. Resolves false when the secure store refused to delete them,
   * also on a second try: the old PIN then still opens the empty vault after a
   * relaunch until setup replaces it.
   */
  eraseVault: () => Promise<boolean>;
  /** Last unlock or setup failure, cleared on the next attempt. */
  error: string | null;
};

const SessionContext = createContext<SessionContextValue | null>(null);

/** Native error codes that deserve a plain sentence instead of the OS text. */
const friendlyMessages: Record<string, string> = {
  BIOMETRIC_AUTH_FAILED: 'That did not match. Try again or enter your PIN.',
  BIOMETRIC_NOT_AVAILABLE: 'Biometrics are not available right now. Enter your PIN.',
  NO_AUTH_ENROLLED: 'Set up a screen lock in your device settings first.',
  KEY_RETRIEVAL_FAILED: 'The vault key could not be read. Restart the app and try again.',
  // Android only: setup keeps an invalidated key while the vault still holds entries.
  KEY_INVALIDATED: KEY_INVALIDATED_MESSAGE,
};

const KEY_NOT_UNLOCKED = 'The device key was not unlocked. Enter your PIN to try again.';

/**
 * The stored lockout with any pause longer than its count earned capped and the
 * cap written back, so it ends instead of sliding with the clock; null when the
 * store could not be read.
 */
async function loadCappedLockout(): Promise<LockoutState | null> {
  const stored = await sessionStorage.loadLockout();
  if (!stored) return null;
  const capped = clampLockout(stored, Date.now());
  if (capped !== stored) await sessionStorage.saveLockout(capped).catch(() => {});
  return capped;
}

/** What a cancelled or lapsed key prompt means where it happened; setup has no PIN yet. */
const keyNotUnlocked = {
  unlock: KEY_NOT_UNLOCKED,
  setup: 'The device key was not unlocked. Try again.',
  changePin: 'The device key was not unlocked, so the PIN was not changed. Try again.',
} as const;

function describeError(
  e: unknown,
  fallback: string,
  context: keyof typeof keyNotUnlocked = 'unlock',
): string {
  // A cancelled or lapsed Android key prompt carries the Keystore's own text.
  if (isKeyLocked(e)) return keyNotUnlocked[context];
  const code = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined;
  if (typeof code === 'string' && friendlyMessages[code]) return friendlyMessages[code];
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

/**
 * Owns the lock state for the whole app. The root layout reads `status` to
 * decide which routes exist, so no screen can be reached while locked. The
 * device key gate (biometrics or passcode) and the app PIN are two doors to
 * the same room: both end in `unlocked`, and either can be used to get there.
 */
export function SessionProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [biometry, setBiometry] = useState<BiometryType>('none');
  const [vaultExists, setVaultExists] = useState(false);
  const [vaultEmpty, setVaultEmpty] = useState(false);
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SETTINGS);
  const [lockout, setLockout] = useState<LockoutState>(EMPTY_LOCKOUT);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<SessionNotice | null>(null);
  const backgroundedAt = useRef<number | null>(null);
  const suspendedRef = useRef(0);
  const statusRef = useRef(status);
  // Bumped every time the vault leaves `unlocked`, so work that started in an
  // earlier session never mistakes a later unlock for its own.
  const generationRef = useRef(0);
  const waitersRef = useRef(new Set<() => void>());
  // The lockout a PIN attempt is judged against, current within the same tick.
  const lockoutRef = useRef<LockoutState>(EMPTY_LOCKOUT);
  // One PIN attempt at a time, so two in flight cannot both count from the same state.
  const attemptingRef = useRef(false);

  const applyLockout = useCallback((next: LockoutState) => {
    lockoutRef.current = next;
    setLockout(next);
  }, []);

  const settleWaiters = useCallback(() => {
    for (const settle of [...waitersRef.current]) settle();
  }, []);

  // The ref changes in the same tick as the transition, before React renders,
  // so a check between two awaits never sees a stale `unlocked`.
  const changeStatus = useCallback(
    (next: SessionStatus) => {
      if (statusRef.current === 'unlocked' && next !== 'unlocked') generationRef.current += 1;
      statusRef.current = next;
      setStatus(next);
      settleWaiters();
    },
    [settleWaiters],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const [exists, type, hasPin, storedLockout, entries] = await Promise.all([
        vault.hasVault().catch(() => false),
        vault.biometryType().catch(() => 'none' as const),
        sessionStorage.hasPinRecord(),
        // Readable before the device key is authenticated, so a relaunch keeps
        // the attempt counter and any pause that is still running.
        loadCappedLockout(),
        // The listing reads the folder only and needs no device key; when it
        // fails, setup keeps saying the documents stay.
        vault.getAllKeys().then(
          (keys) => keys.length,
          () => null,
        ),
      ]);
      if (!active) return;
      setBiometry(type);
      applyLockout(storedLockout ?? unreadableLockout(Date.now()));
      setVaultExists(exists);
      setVaultEmpty(exists && entries === 0);
      // A key without a PIN record is either the 2025 prototype's vault or an
      // interrupted setup. Both go through setup again, and setUp keeps the
      // existing key so nothing already encrypted is lost.
      changeStatus(exists && hasPin ? 'locked' : 'setup');
    })();
    return () => {
      active = false;
    };
  }, [changeStatus, applyLockout]);

  const loadProtectedState = useCallback(async () => {
    setSettings(await sessionStorage.loadSettings());
  }, []);

  const ensureKeyAccess = useCallback(async () => {
    try {
      await vault.get(KEY_PROBE_ENTRY);
      return true;
    } catch (probeError) {
      // The vault's key recovery has already shown the Android prompt for a
      // locked key (or declined to from the background). Prompting again here
      // would open a second prompt right after the user cancelled the first.
      if (isKeyLocked(probeError)) {
        setError(KEY_NOT_UNLOCKED);
        return false;
      }
      try {
        if (await vault.unlockWithBiometrics()) return true;
        setError(KEY_NOT_UNLOCKED);
        return false;
      } catch (e) {
        setError(describeError(e, 'Could not unlock the vault key.'));
        return false;
      }
    }
  }, []);

  const unlock = useCallback(async () => {
    setError(null);
    try {
      const ok = await vault.unlockWithBiometrics();
      if (ok) {
        await loadProtectedState();
        applyLockout(EMPTY_LOCKOUT);
        await sessionStorage.saveLockout(EMPTY_LOCKOUT).catch(() => {});
        changeStatus('unlocked');
      }
      return ok;
    } catch (e) {
      setError(describeError(e, 'Could not unlock the vault.'));
      return false;
    }
  }, [loadProtectedState, applyLockout, changeStatus]);

  const checkPin = useCallback(
    async (pin: string): Promise<PinUnlockResult> => {
      // The stored copy outlives a relaunch and the one in memory outlives a
      // failed write; the attempt is judged against the stricter of the two.
      const stored = await loadCappedLockout();
      const now = Date.now();
      const current = strictestLockout(lockoutRef.current, stored ?? lockoutRef.current, now);
      applyLockout(current);
      if (isLocked(current, now)) return 'not-unlocked';
      try {
        // Reading the PIN record needs the device key, which the OS may gate
        // with its own prompt; that is the same gate biometrics use.
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
        setError(describeError(e, 'Could not check the PIN.'));
        return 'not-unlocked';
      }
    },
    [loadProtectedState, ensureKeyAccess, applyLockout, changeStatus],
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
    [checkPin],
  );

  const setUp = useCallback(
    async (pin: string) => {
      setError(null);
      try {
        // Only a brand-new vault gets a key; an existing one keeps what it has.
        if (!vaultExists) await vault.createVault();
        const ok = await vault.unlockWithBiometrics();
        if (!ok) return false;
        try {
          await vault.put(KEY_PROBE_ENTRY, 'ok');
        } catch (probeError) {
          // "Delete everything" keeps the device key; one the system invalidated
          // can never encrypt again, and an empty vault loses nothing by a new one.
          const code = (probeError as { code?: unknown } | null)?.code;
          if (code !== 'KEY_INVALIDATED' || (await vault.getAllKeys()).length > 0) {
            throw probeError;
          }
          await vault.createVault();
          if (!(await vault.unlockWithBiometrics())) return false;
          await vault.put(KEY_PROBE_ENTRY, 'ok');
        }
        await sessionStorage.savePinRecord(await hashPasscodeAsync(pin));
        await sessionStorage.saveSettings(DEFAULT_SETTINGS);
        await sessionStorage.saveLockout(EMPTY_LOCKOUT).catch(() => {});
        // Only setup creates the index and its key, once the screens behind the gate mount.
        documentService.allowIndex();
        setSettings(DEFAULT_SETTINGS);
        applyLockout(EMPTY_LOCKOUT);
        setVaultExists(true);
        setVaultEmpty(false);
        changeStatus('unlocked');
        return true;
      } catch (e) {
        setError(describeError(e, 'Could not set up the vault.', 'setup'));
        return false;
      }
    },
    [vaultExists, applyLockout, changeStatus],
  );

  const changePin = useCallback(
    async (currentPin: string, nextPin: string): Promise<PinChangeResult> => {
      setError(null);
      try {
        const record = await sessionStorage.loadPinRecord();
        if (!record || !(await verifyPasscodeAsync(currentPin, record))) return 'wrong-pin';
        await sessionStorage.savePinRecord(await hashPasscodeAsync(nextPin));
        return 'changed';
      } catch (e) {
        setError(describeError(e, 'Could not change the PIN.', 'changePin'));
        return 'failed';
      }
    },
    [],
  );

  const updateSettings = useCallback(
    async (changes: Partial<SecuritySettings>) => {
      const next = { ...settings, ...changes };
      setSettings(next);
      await sessionStorage.saveSettings(next).catch(() => {});
    },
    [settings],
  );

  const lock = useCallback(() => {
    setError(null);
    changeStatus('locked');
  }, [changeStatus]);

  const eraseVault = useCallback(async () => {
    // expo-secure-store 58 rejects a delete the Keychain refuses; one retry
    // covers a transient refusal, and the caller tells the user otherwise.
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
    setNotice(null);
    setVaultEmpty(true);
    changeStatus('setup');
    return cleared;
  }, [applyLockout, changeStatus]);

  const withoutAutoLock = useCallback(
    async <T,>(work: () => Promise<T>) => {
      suspendedRef.current += 1;
      try {
        return await work();
      } finally {
        suspendedRef.current -= 1;
        backgroundedAt.current = null;
        settleWaiters();
      }
    },
    [settleWaiters],
  );

  const captureSession = useCallback((): SessionCapture => {
    const generation = statusRef.current === 'unlocked' ? generationRef.current : -1;
    const current = () => generation === generationRef.current && statusRef.current === 'unlocked';
    const confirm = () =>
      new Promise<boolean>((resolve) => {
        const settle = () => {
          if (!current()) {
            waitersRef.current.delete(settle);
            resolve(false);
          } else if (AppState.currentState === 'active' && backgroundedAt.current === null) {
            waitersRef.current.delete(settle);
            resolve(true);
          }
        };
        waitersRef.current.add(settle);
        settle();
      });
    return { current, confirm };
  }, []);

  const postNotice = useCallback((next: SessionNotice) => setNotice(next), []);
  const dismissNotice = useCallback(() => setNotice(null), []);

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

  // Auto-lock: remember when the app left the foreground and compare on return.
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (statusRef.current === 'unlocked' && suspendedRef.current === 0) {
        if (next === 'background' || next === 'inactive') {
          backgroundedAt.current ??= Date.now();
        } else if (next === 'active' && backgroundedAt.current !== null) {
          const idleMs = Date.now() - backgroundedAt.current;
          backgroundedAt.current = null;
          const limit = settings.autoLockSeconds;
          if (limit >= 0 && idleMs >= limit * 1000) changeStatus('locked');
        }
      }
      // Waiting work resumes only after the return to the foreground was judged.
      settleWaiters();
    };
    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, [settings.autoLockSeconds, changeStatus, settleWaiters]);

  const value = useMemo(
    () => ({
      status,
      vaultExists,
      vaultEmpty,
      biometry,
      settings,
      lockout,
      unlock,
      unlockWithPin,
      setUp,
      changePin,
      updateSettings,
      lock,
      stepUp,
      withoutAutoLock,
      captureSession,
      notice,
      postNotice,
      dismissNotice,
      eraseVault,
      error,
    }),
    [
      status,
      vaultExists,
      vaultEmpty,
      biometry,
      settings,
      lockout,
      unlock,
      unlockWithPin,
      setUp,
      changePin,
      updateSettings,
      lock,
      stepUp,
      withoutAutoLock,
      captureSession,
      notice,
      postNotice,
      dismissNotice,
      eraseVault,
      error,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used inside SessionProvider');
  }
  return context;
}
