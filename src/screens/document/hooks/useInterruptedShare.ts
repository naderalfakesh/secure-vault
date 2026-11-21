import { useCallback, useEffect, useRef } from 'react';

import { useSessionActions, useSessionState } from '@/features/session/SessionProvider';
import type { Document } from '@/types';

/** The banner for a share the lock cut short, and its Share again. */
export function useInterruptedShare(document: Document | null, openShare: () => void) {
  const { shareInterrupted } = useSessionState();
  const { clearShareInterrupted } = useSessionActions();

  // A banner that was seen goes once its viewer closes (Back, or the lock), so
  // later unlocks do not bring this viewer back for it. Only that same mark:
  // a share cut short meanwhile sets a newer one, which is kept.
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
