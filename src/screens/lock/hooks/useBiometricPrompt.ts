import { useEffect, useRef } from 'react';

import type { SessionStatus } from '@/features/session/SessionProvider';

/** Returning users get the biometric prompt once, as soon as the screen appears. */
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
