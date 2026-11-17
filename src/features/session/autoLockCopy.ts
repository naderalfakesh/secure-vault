import { t, tp } from '@/i18n';

import type { AutoLockSeconds } from './securitySettings';

export function autoLockLabel(seconds: AutoLockSeconds): string {
  if (seconds === 0) return t('settings.autoLock.immediately');
  if (seconds === -1) return t('settings.autoLock.never');
  if (seconds < 60) return t('settings.autoLock.seconds', { count: seconds });
  return tp('settings.autoLock.minutes', seconds / 60);
}

/** A choice on the Auto-lock page: "Immediately", "After 5 minutes", "Never". */
export function autoLockChoice(seconds: AutoLockSeconds): string {
  if (seconds === 0 || seconds === -1) return autoLockLabel(seconds);
  return t('settings.autoLock.after', { duration: autoLockLabel(seconds) });
}

/** Sentence for the Settings row, e.g. "After 1 minute in the background". */
export function autoLockDescription(seconds: AutoLockSeconds): string {
  if (seconds === 0) return t('settings.autoLock.onLeave');
  if (seconds === -1) return t('settings.autoLock.untilLocked');
  return t('settings.autoLock.afterBackground', { duration: autoLockLabel(seconds) });
}
