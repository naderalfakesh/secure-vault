import * as LocalAuthentication from 'expo-local-authentication';
import { useState } from 'react';

import { useSession } from '@/features/session/SessionProvider';
import { t } from '@/i18n';

/** "Use Face ID" or "Not now": either way biometric unlock is settled and setup finishes. */
export function useBiometricsChoice() {
  const { finishSetup, updateSettings } = useSession();
  const [busy, setBusy] = useState(false);

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
    await updateSettings({ biometricUnlock: allowed });
    finishSetup();
  };

  const notNow = async () => {
    setBusy(true);
    await updateSettings({ biometricUnlock: false });
    finishSetup();
  };

  return { busy, enableBiometrics, notNow };
}
