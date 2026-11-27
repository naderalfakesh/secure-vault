import { useCallback, useEffect, useRef } from 'react';

import { useSessionActions, useSessionState } from '@/features/session/SessionProvider';
import type { Document } from '@/types';

export function useInterruptedShare(document: Document | null, openShare: () => void) {
  const { shareInterrupted } = useSessionState();
  const { clearShareInterrupted } = useSessionActions();

  // Clear only this banner's mark on exit so a newer interrupted share is not erased.
  const bannerMark =
    document && shareInterrupted?.documentId === document.id ? shareInterrupted : null;
  const seenMark = useRef<typeof shareInterrupted>(null);
  useEffect(() => {
    if (bannerMark) seenMark.current = bannerMark;
  }, [bannerMark]);
  useEffect(
    () => () => {
      if (seenMark.current) clearShareInterrupted(seenMark.current);
    },
    [clearShareInterrupted],
  );

  const shareAgain = useCallback(() => {
    clearShareInterrupted();
    openShare();
  }, [clearShareInterrupted, openShare]);

  const dismissBanner = useCallback(() => clearShareInterrupted(), [clearShareInterrupted]);

  return { bannerMark, shareAgain, dismissBanner };
}
