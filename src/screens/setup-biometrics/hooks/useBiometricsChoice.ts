import * as LocalAuthentication from 'expo-local-authentication';
import { useState } from 'react';

import { useSessionActions } from '@/features/session/SessionProvider';
import { useMountedRef } from '@/hooks/useMountedRef';
import { t } from '@/i18n';

export function useBiometricsChoice() {
  const { finishSetup, updateSettings } = useSessionActions();
  const mounted = useMountedRef();
  const [busy, setBusy] = useState(false);

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
    } catch {}
    await settle(allowed);
  };

  const notNow = async () => {
    setBusy(true);
    await settle(false);
  };

  return { busy, enableBiometrics, notNow };
}
