import { useState } from 'react';

import { confirmErase, eraseEverything } from '@/features/session/eraseEverything';
import { useSessionActions } from '@/features/session/SessionProvider';
import { useMountedRef } from '@/hooks/useMountedRef';

export function useEraseVault() {
  const mounted = useMountedRef();
  const { eraseVault } = useSessionActions();
  const [erasing, setErasing] = useState(false);
  const [eraseFailed, setEraseFailed] = useState(false);

  const eraseAll = () => {
    confirmErase(async () => {
      setErasing(true);
      setEraseFailed(false);
      try {
        await eraseEverything(eraseVault);
      } catch {
        if (mounted.current) setEraseFailed(true);
      } finally {
        if (mounted.current) setErasing(false);
      }
    });
  };

  return { erasing, eraseFailed, eraseAll };
}
