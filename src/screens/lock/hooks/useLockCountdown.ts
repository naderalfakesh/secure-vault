import { useEffect, useState } from 'react';

import { type LockoutState, lockRemainingMs } from '@/features/auth/lockout';

import { COUNTDOWN_TICK_MS } from '../constants';
import { secondsLeft } from '../helpers';

/** Seconds left in the lockout, ticking while locked out. */
export function useLockCountdown(lockout: LockoutState): number {
  // Read the lockout on the first render, so the first frame under the
  // fading splash already shows the right mark.
  const [lockLeft, setLockLeft] = useState(() => secondsLeft(lockRemainingMs(lockout, Date.now())));

  // Tick the lockout countdown while locked out.
  useEffect(() => {
    const update = () => setLockLeft(secondsLeft(lockRemainingMs(lockout, Date.now())));
    update();
    if (lockRemainingMs(lockout, Date.now()) <= 0) return;
    const id = setInterval(update, COUNTDOWN_TICK_MS);
    return () => clearInterval(id);
  }, [lockout]);

  return lockLeft;
}
