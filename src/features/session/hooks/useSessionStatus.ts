import { useCallback, useRef, useState } from 'react';

import vault from '@modules/expo-vault';

import type { AwayClock, SessionStatus } from '../types';

export function useSessionStatus() {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const statusRef = useRef(status);
  // Bumped whenever leaving unlocked so in-flight work cannot adopt a later session.
  const generationRef = useRef(0);
  const waitersRef = useRef(new Set<() => void>());
  const away = useRef<AwayClock>({
    backgroundedAt: null,
    pauses: new Set(),
    pauseEndedAway: false,
  });

  const settleWaiters = useCallback(() => {
    for (const settle of [...waitersRef.current]) settle();
  }, []);

  // Update ref synchronously before render so checks between awaits never see stale unlocked.
  const changeStatus = useCallback(
    (next: SessionStatus) => {
      if (statusRef.current === 'unlocked' && next !== 'unlocked') {
        generationRef.current += 1;
        away.current.pauses.clear();
        away.current.backgroundedAt = null;
        away.current.pauseEndedAway = false;
      }
      // Invalidate cached key auth outside unlocked so the next read prompts again (iOS).
      if (next !== 'unlocked') {
        try {
          vault.endKeySession();
        } catch {
          // Ignore on older native builds without endKeySession.
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
