import * as LocalAuthentication from 'expo-local-authentication';
import { useState } from 'react';

import { useSessionActions } from '@/features/session/SessionProvider';
import { useMountedRef } from '@/hooks/useMountedRef';
import { t } from '@/i18n';

/** "Use Face ID" or "Not now": either way biometric unlock is settled and setup finishes. */
export function useBiometricsChoice() {
  const { finishSetup, updateSettings } = useSessionActions();
  const mounted = useMountedRef();
  const [busy, setBusy] = useState(false);

  // A settings write that fails leaves the screen usable, so the owner can try again.
  const settle = async (biometricUnlock: boolean) => {
    try {
      await updateSettings({ biometricUnlock });
    } catch {
      if (mounted.current) setBusy(false);
      return;
    }
    finishSetup();
  };

  const enableBiometrics = async () => {
    setBusy(true);
    let allowed = false;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('onboarding.biometrics.prompt'),
        cancelLabel: t('onboarding.biometrics.notNow'),
        disableDeviceFallback: true,
      });
      allowed = result.success;
    } catch {
      // A prompt that could not be shown is a no; the PIN still works.
    }
    // Only a passed check turns it on: the prompt's own "Not now" means no.
    await settle(allowed);
  };

  const notNow = async () => {
    setBusy(true);
    await settle(false);
  };

  return { busy, enableBiometrics, notNow };
}
