import { formatCountdown, LOCKOUT_BODY } from '@/features/auth/lockCopy';
import { t } from '@/i18n';

import { TITLES } from './constants';
import type { Stage } from './types';

export type PinPrompt = {
  lockedOut: boolean;
  alert: boolean;
  title: string;
  subtitle: string | null;
};

export function pinPrompt(
  stage: Stage,
  lockLeftSeconds: number,
  message: string | null,
  error: string | null,
): PinPrompt {
  const lockedOut = lockLeftSeconds > 0 && stage === 'current';
  const alert = Boolean(message || error) && !lockedOut;
  const title = lockedOut
    ? t('lock.lockoutTitle', { time: formatCountdown(lockLeftSeconds) })
    : t(TITLES[stage]);
  const subtitle = lockedOut
    ? LOCKOUT_BODY
    : (message ?? error ?? (stage === 'current' ? null : t('changePin.untouched')));
  return { lockedOut, alert, title, subtitle };
}
