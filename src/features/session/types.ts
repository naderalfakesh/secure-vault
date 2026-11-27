import type { LockoutState } from '@/features/auth/lockout';
import type { BiometryType } from '@modules/expo-vault';

import type { SecuritySettings } from './settings';

// `unavailable`: key/PIN unreadable; never falls back to `setup` (would overwrite a vault).
export type SessionStatus = 'loading' | 'unavailable' | 'setup' | 'locked' | 'unlocked';

export type SessionCapture = {
  current: () => boolean;
  confirm: () => Promise<boolean>;
  ended: () => Promise<void>;
};

export type PinUnlockResult = 'unlocked' | 'wrong-pin' | 'not-unlocked';

export type AutoLockPause = { maxAwayMs?: number; endsOnReturn?: boolean };

export type PauseEntry = {
  maxAwayMs: number;
  endsOnReturn: boolean;
  startedAt: number;
  awayAt: number | null;
};

export type AwayClock = {
  backgroundedAt: number | null;
  pauses: Set<PauseEntry>;
  pauseEndedAway: boolean;
};

export type PinChangeResult = 'changed' | 'wrong-pin' | 'locked-out' | 'busy' | 'failed';

export type SessionNotice = { message: string; tone?: 'neutral' | 'success' | 'danger' };

export type ShareInterruption = { documentId: string };

export type KeyRead = 'present' | 'absent' | 'unreadable';

export type SessionState = {
  status: SessionStatus;
  vaultExists: boolean;
  vaultEmpty: boolean;
  biometry: BiometryType;
  settings: SecuritySettings;
  lockout: LockoutState;
  setupHeld: boolean;
  pinLost: boolean;
  keyInvalidated: boolean;
  notice: SessionNotice | null;
  shareInterrupted: ShareInterruption | null;
  error: string | null;
};

export type SessionActions = {
  unlock: () => Promise<boolean>;
  unlockWithPin: (pin: string) => Promise<PinUnlockResult>;
  setUp: (pin: string, options?: { holdForOnboarding?: boolean }) => Promise<boolean>;
  finishSetup: () => void;
  retry: () => Promise<SessionStatus>;
  resetLostPin: () => Promise<boolean>;
  changePin: (currentPin: string, nextPin: string) => Promise<PinChangeResult>;
  updateSettings: (changes: Partial<SecuritySettings>) => Promise<void>;
  lock: () => void;
  stepUp: () => Promise<boolean>;
  withoutAutoLock: <T>(work: () => Promise<T>, pause?: AutoLockPause) => Promise<T>;
  captureSession: () => SessionCapture;
  postNotice: (notice: SessionNotice) => void;
  dismissNotice: () => void;
  markShareInterrupted: (documentId: string) => void;
  clearShareInterrupted: (only?: ShareInterruption) => void;
  eraseVault: () => Promise<boolean>;
};
