import {
  biometricSubtitle,
  formatCountdown,
  LOCKOUT_BODY,
  wrongPinMessage,
} from '@/features/auth/lockCopy';
import { t } from '@/i18n';
import type { BiometryType } from '@modules/expo-vault';

/** Whole seconds left in a lockout, from its remaining milliseconds. */
export function secondsLeft(remainingMs: number): number {
  return Math.ceil(remainingMs / 1000);
}

export type LockMessageInput = {
  /** Seconds left in a lockout; 0 when there is none. */
  lockLeft: number;
  /** The last PIN was wrong. */
  wrong: boolean;
  /** The session's error, if any. */
  error: string | null;
  attemptsLeft: number;
  hasBiometrics: boolean;
  biometry: BiometryType;
  /** Digits entered so far. */
  pinLength: number;
};

export type LockMessage = {
  lockedOut: boolean;
  alerting: boolean;
  title: string;
  subtitle: string;
};

/** What the lock screen says: a lockout first, then a wrong PIN, an error, or the prompt. */
export function lockMessage({
  lockLeft,
  wrong,
  error,
  attemptsLeft,
  hasBiometrics,
  biometry,
  pinLength,
}: LockMessageInput): LockMessage {
  const lockedOut = lockLeft > 0;

  const showWrong = wrong && !lockedOut;
  const showError = Boolean(error) && !lockedOut && !showWrong;
  const alerting = showWrong || showError;

  const title = lockedOut
    ? t('lock.lockoutTitle', { time: formatCountdown(lockLeft) })
    : t('lock.title');
  const subtitle = lockedOut
    ? LOCKOUT_BODY
    : showWrong
      ? wrongPinMessage(attemptsLeft)
      : showError
        ? (error as string)
        : hasBiometrics && pinLength === 0
          ? biometricSubtitle(biometry)
          : t('lock.enterPin');

  return { lockedOut, alerting, title, subtitle };
}
