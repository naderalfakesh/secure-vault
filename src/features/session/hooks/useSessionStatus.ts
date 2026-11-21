import { useCallback, useRef, useState } from 'react';

import vault from '@modules/expo-vault';

import type { AwayClock, SessionStatus } from '../types';

/**
 * The session status, with a ref that changes in the same tick, the session
 * generation, the waiters that resume work on a change, and the time away
 * that belongs to the unlocked session.
 */
export function useSessionStatus() {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const statusRef = useRef(status);
  // Bumped every time the vault leaves `unlocked`, so work that started in an
  // earlier session never mistakes a later unlock for its own.
  const generationRef = useRef(0);
  const waitersRef = useRef(new Set<() => void>());
  // The trip away being timed for auto-lock and the pauses running over it.
  const away = useRef<AwayClock>({
    backgroundedAt: null,
    pauses: new Set(),
    pauseEndedAway: false,
  });

  const settleWaiters = useCallback(() => {
    for (const settle of [...waitersRef.current]) settle();
  }, []);

  // The ref changes in the same tick as the transition, before React renders,
  // so a check between two awaits never sees a stale `unlocked`.
  const changeStatus = useCallback(
    (next: SessionStatus) => {
      if (statusRef.current === 'unlocked' && next !== 'unlocked') {
        generationRef.current += 1;
        // Pauses belong to the session that took them. System UI that never
        // settles (a share sheet the lock dismissed) must not excuse the next
        // session's time away.
        away.current.pauses.clear();
        // A trip being timed belongs to that session too; the next one starts fresh.
        away.current.backgroundedAt = null;
        away.current.pauseEndedAway = false;
      }
      // Outside an unlocked session no key read may reuse its authentication:
      // the next one prompts again (iOS; Android's key window bounds its own).
      if (next !== 'unlocked') {
        try {
          vault.endKeySession();
        } catch {
          // A build without the call keeps the previous behaviour.
        }
      }
      statusRef.current = next;
      setStatus(next);
      settleWaiters();
    },
    [settleWaiters],
  );

  return { status, statusRef, generationRef, waitersRef, away, settleWaiters, changeStatus };
}
