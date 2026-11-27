import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import type { SessionStatus, ShareInterruption } from '@/features/session/SessionProvider';

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
    // Wait a tick for guarded screens to mount after unlock before pushing.
    const timer = setTimeout(() => {
      router.push({ pathname: '/documents/[id]', params: { id: documentId } });
    }, 0);
    return () => clearTimeout(timer);
  }, [status, shareInterrupted]);
}
