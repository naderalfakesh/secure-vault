import { useCallback, useState } from 'react';

import type { SessionNotice, ShareInterruption } from '../types';

export function useSessionNotices() {
  const [notice, setNotice] = useState<SessionNotice | null>(null);
  const [shareInterrupted, setShareInterrupted] = useState<ShareInterruption | null>(null);

  const postNotice = useCallback((next: SessionNotice) => setNotice(next), []);
  const dismissNotice = useCallback(() => setNotice(null), []);
  const markShareInterrupted = useCallback(
    (documentId: string) => setShareInterrupted({ documentId }),
    [],
  );
  const clearShareInterrupted = useCallback(
    (only?: ShareInterruption) =>
      setShareInterrupted((current) => (!only || current === only ? null : current)),
    [],
  );

  const resetNotices = useCallback(() => {
    setNotice(null);
    setShareInterrupted(null);
  }, []);

  return {
    notice,
    postNotice,
    dismissNotice,
    shareInterrupted,
    markShareInterrupted,
    clearShareInterrupted,
    resetNotices,
  };
}
