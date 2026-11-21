import { useEffect, useState } from 'react';

import { type LockoutState, lockRemainingMs, secondsLeft } from '../lockout';

const TICK_MS = 1000;

/**
 * Seconds left in the lockout, ticking while locked out. One lockout for the
 * lock and change-PIN screens: a pause from one holds on the other.
 */
export function useLockoutCountdown(lockout: LockoutState): number {
  // Read the lockout on the first render, so the first frame under the
  // fading splash already shows the right mark.
  const [lockLeft, setLockLeft] = useState(() => secondsLeft(lockRemainingMs(lockout, Date.now())));

  useEffect(() => {
    const update = () => setLockLeft(secondsLeft(lockRemainingMs(lockout, Date.now())));
    update();
    if (lockRemainingMs(lockout, Date.now()) <= 0) return;
    const id = setInterval(update, TICK_MS);
    return () => clearInterval(id);
  }, [lockout]);

  return lockLeft;
}
