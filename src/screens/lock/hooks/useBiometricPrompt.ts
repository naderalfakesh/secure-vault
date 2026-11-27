import { useEffect, useRef } from 'react';

import type { SessionStatus } from '@/features/session/SessionProvider';

export function useBiometricPrompt(
  status: SessionStatus,
  hasBiometrics: boolean,
  unlock: () => Promise<boolean>,
): void {
  const promptedRef = useRef(false);
  useEffect(() => {
    if (status !== 'locked' || promptedRef.current || !hasBiometrics) return;
    promptedRef.current = true;
    unlock().catch(() => {});
  }, [status, hasBiometrics, unlock]);
}
