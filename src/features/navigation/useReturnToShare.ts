import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import type { SessionStatus, ShareInterruption } from '@/features/session/SessionProvider';

/**
 * A lock that cut a share short brings the user back to that document's
 * viewer after the unlock, where its banner explains.
 * Only on the unlock that follows a lock, once per lock.
 */
export function useReturnToShare(
  status: SessionStatus,
  shareInterrupted: ShareInterruption | null,
): void {
  const backToShare = useRef(false);
  useEffect(() => {
    if (status === 'locked') backToShare.current = true;
    else if (status !== 'unlocked') backToShare.current = false;
  }, [status]);
  useEffect(() => {
    if (status !== 'unlocked' || !backToShare.current) return;
    backToShare.current = false;
    if (!shareInterrupted) return;
    const { documentId } = shareInterrupted;
    // The guarded screens are back only once this render has been committed.
    const timer = setTimeout(() => {
      router.push({ pathname: '/documents/[id]', params: { id: documentId } });
    }, 0);
    return () => clearTimeout(timer);
  }, [status, shareInterrupted]);
}
