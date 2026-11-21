import type { LockoutState } from '@/features/auth/lockout';
import type { BiometryType } from '@modules/expo-vault';

import type { SecuritySettings } from './settings';

/**
 * `unavailable`: the device key or the PIN record could not be read, so the
 * app cannot tell a vault from no vault. It never falls back to setup, which
 * would create a new key over a real vault.
 */
export type SessionStatus = 'loading' | 'unavailable' | 'setup' | 'locked' | 'unlocked';

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
  /**
   * Resolves once that session has ended (locked or erased). Race system UI
   * against it so work never waits on a sheet that outlived the session.
   */
  ended: () => Promise<void>;
};

/** How a PIN attempt ended. Only `wrong-pin` counts towards the lockout. */
export type PinUnlockResult = 'unlocked' | 'wrong-pin' | 'not-unlocked';

/**
 * Limits on pausing auto-lock for system UI. `maxAwayMs` bounds the time away
 * a pause can excuse; `endsOnReturn` is for UI that cannot still be open once
 * the app is back in the foreground (Android's share chooser is an activity of
 * its own), so a pause still pending shortly after the return is ended.
 */
export type AutoLockPause = { maxAwayMs?: number; endsOnReturn?: boolean };

/** A running pause, with the time it began and the time it was left the foreground. */
export type PauseEntry = {
  maxAwayMs: number;
  endsOnReturn: boolean;
  startedAt: number;
  awayAt: number | null;
};

/**
 * The time away being judged for auto-lock, shared by the app-state listener,
 * the pauses and the status transitions. One mutable object per provider.
 */
export type AwayClock = {
  /** When the app left the foreground in the unlocked session, or null. */
  backgroundedAt: number | null;
  /** Running pauses of auto-lock, each with the time it was left the foreground. */
  pauses: Set<PauseEntry>;
  /** True when the time away being judged began as a pause ended in the background. */
  pauseEndedAway: boolean;
};

/**
 * How a PIN change ended. `failed` leaves the reason in `error`.
 * `locked-out`: the lockout pause is running, and the current PIN was not
 * checked. `busy`: another PIN attempt was still being judged; nothing was
 * checked or changed.
 */
export type PinChangeResult = 'changed' | 'wrong-pin' | 'locked-out' | 'busy' | 'failed';

export type SessionNotice = { message: string; tone?: 'neutral' | 'success' | 'danger' };

/** A share the lock cut short; the viewer of that document says so after unlock. */
export type ShareInterruption = { documentId: string };

/** What one launch read found for the device key or the PIN record. */
export type KeyRead = 'present' | 'absent' | 'unreadable';

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
  /**
   * First run: creates the device key and stores the hashed PIN, then unlocks.
   * The key and PIN are read again first: an unreadable one ends in
   * `unavailable`, a vault that has both ends in `locked`, and an existing key
   * is kept. With `holdForOnboarding` the session stays in `setup` with
   * `setupHeld` until `finishSetup`, so onboarding can show its last step.
   */
  setUp: (pin: string, options?: { holdForOnboarding?: boolean }) => Promise<boolean>;
  /** True after a held setup succeeded and before `finishSetup`. */
  setupHeld: boolean;
  /** Ends a held setup and unlocks; does nothing when no setup is held. */
  finishSetup: () => void;
  /** Reads the key and PIN again after `unavailable`; resolves the new status. */
  retry: () => Promise<SessionStatus>;
  /**
   * True while `unavailable` because the PIN record is gone although it was
   * written, and the device key is there (M1). `resetLostPin` is then the way on.
   */
  pinLost: boolean;
  /**
   * After a lost PIN record: asks for the device key's own gate (biometrics or
   * the device passcode, the same door the lock screen offers) and, once it
   * opens, goes to setup to add a new PIN to the existing vault. Resolves
   * false when the prompt was cancelled or failed, with the reason in `error`.
   */
  resetLostPin: () => Promise<boolean>;
  /**
   * The vault holds entries its device key can no longer open, so nothing in
   * it can be decrypted on this device again and the only way on is "Delete
   * everything". Android: after a lost PIN record the key's gate opened but
   * the key was invalidated (the screen lock or biometrics changed). Either
   * platform: the key is gone while entries remain (removing Android's screen
   * lock deletes it; an earlier install lost it), so setup never runs over them.
   */
  keyInvalidated: boolean;
  changePin: (currentPin: string, nextPin: string) => Promise<PinChangeResult>;
  updateSettings: (changes: Partial<SecuritySettings>) => Promise<void>;
  lock: () => void;
  /** Ask for biometrics again for a sensitive action such as sharing. */
  stepUp: () => Promise<boolean>;
  /**
   * Runs `work` with auto-lock paused. System pickers, the camera, the scanner,
   * and share sheets send the app to the background without the user leaving it.
   */
  withoutAutoLock: <T>(work: () => Promise<T>, pause?: AutoLockPause) => Promise<T>;
  /** Captures the current unlocked session so long work can tell whether it ended. */
  captureSession: () => SessionCapture;
  /** A message for work that ended behind the lock; shown once the vault is unlocked. */
  notice: SessionNotice | null;
  postNotice: (notice: SessionNotice) => void;
  dismissNotice: () => void;
  /**
   * Set when the vault locked while a share of this document was running.
   * In memory only, so a relaunch forgets it; cleared by erase.
   */
  shareInterrupted: ShareInterruption | null;
  markShareInterrupted: (documentId: string) => void;
  /** Clears the mark; given one, only while that same mark is still the current one. */
  clearShareInterrupted: (only?: ShareInterruption) => void;
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
