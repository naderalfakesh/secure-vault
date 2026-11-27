import { useCallback, useRef, useState } from 'react';

import { EMPTY_LOCKOUT, type LockoutState } from '@/features/auth/lockout';

export function useLockoutState() {
  const [lockout, setLockout] = useState<LockoutState>(EMPTY_LOCKOUT);
  const lockoutRef = useRef<LockoutState>(EMPTY_LOCKOUT);

  const applyLockout = useCallback((next: LockoutState) => {
    lockoutRef.current = next;
    setLockout(next);
  }, []);

  return { lockout, lockoutRef, applyLockout };
}
