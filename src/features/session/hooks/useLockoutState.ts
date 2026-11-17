import { useCallback, useRef, useState } from 'react';

import { EMPTY_LOCKOUT, type LockoutState } from '@/features/auth/lockout';

/** The PIN lockout, rendered and current within the same tick. */
export function useLockoutState() {
  const [lockout, setLockout] = useState<LockoutState>(EMPTY_LOCKOUT);
  // The lockout a PIN attempt is judged against, current within the same tick.
  const lockoutRef = useRef<LockoutState>(EMPTY_LOCKOUT);

  const applyLockout = useCallback((next: LockoutState) => {
    lockoutRef.current = next;
    setLockout(next);
  }, []);

  return { lockout, lockoutRef, applyLockout };
}
