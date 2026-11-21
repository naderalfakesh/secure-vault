import { useState } from 'react';

import { useSessionActions } from '@/features/session/SessionProvider';
import { useMountedRef } from '@/hooks/useMountedRef';

/** Read the key and the PIN record again, or add a new PIN when only the record is gone. */
export function useRetryActions() {
  const mounted = useMountedRef();
  const { retry, resetLostPin } = useSessionActions();
  const [trying, setTrying] = useState(false);
  const [resetting, setResetting] = useState(false);

  const tryAgain = () => {
    setTrying(true);
    retry()
      .catch(() => {})
      .finally(() => {
        if (mounted.current) setTrying(false);
      });
  };

  const resetPin = () => {
    setResetting(true);
    resetLostPin()
      .catch(() => {})
      .finally(() => {
        if (mounted.current) setResetting(false);
      });
  };

  return { trying, resetting, tryAgain, resetPin };
}
