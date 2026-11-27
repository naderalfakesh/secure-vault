import { useEffect, useState } from 'react';

import { type LockoutState, lockRemainingMs, secondsLeft } from '../lockout';

const TICK_MS = 1000;

export function useLockoutCountdown(lockout: LockoutState): number {
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
