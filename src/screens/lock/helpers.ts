import {
  biometricSubtitle,
  formatCountdown,
  LOCKOUT_BODY,
  wrongPinMessage,
} from '@/features/auth/lockCopy';
import { t } from '@/i18n';
import type { BiometryType } from '@modules/expo-vault';

export type LockMessageInput = {
  lockLeft: number;
  wrong: boolean;
  error: string | null;
  attemptsLeft: number;
  hasBiometrics: boolean;
  biometry: BiometryType;
  pinLength: number;
};

type LockMessage = {
  lockedOut: boolean;
  alerting: boolean;
  title: string;
  subtitle: string;
};

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
  const shownError = !lockedOut && !showWrong && error ? error : null;
  const alerting = showWrong || shownError !== null;

  const title = lockedOut
    ? t('lock.lockoutTitle', { time: formatCountdown(lockLeft) })
    : t('lock.title');
  const subtitle = lockedOut
    ? LOCKOUT_BODY
    : showWrong
      ? wrongPinMessage(attemptsLeft)
      : shownError
        ? shownError
        : hasBiometrics && pinLength === 0
          ? biometricSubtitle(biometry)
          : t('lock.enterPin');

  return { lockedOut, alerting, title, subtitle };
}
