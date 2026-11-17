import { useEffect, useState } from 'react';

import { lockRemainingMs, type LockoutState } from '@/features/auth/lockout';

import { LOCKOUT_TICK_MS } from '../constants';

/**
 * Seconds left in the lockout. One lockout for both screens: a pause from the
 * lock screen holds here, and wrong current PINs here count towards it.
 */
export function useLockoutCountdown(lockout: LockoutState): number {
  const [lockLeft, setLockLeft] = useState(0);

  useEffect(() => {
    const update = () => setLockLeft(Math.ceil(lockRemainingMs(lockout, Date.now()) / 1000));
    update();
    if (lockRemainingMs(lockout, Date.now()) <= 0) return;
    const id = setInterval(update, LOCKOUT_TICK_MS);
    return () => clearInterval(id);
  }, [lockout]);

  return lockLeft;
}
