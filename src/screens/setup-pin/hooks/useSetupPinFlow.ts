import { router } from 'expo-router';
import { useState } from 'react';

import { useBiometricAvailability } from '@/features/auth/biometricAvailability';
import { usePinEntry } from '@/features/auth/hooks/usePinEntry';
import { isEasyPin } from '@/features/auth/onboardingCopy';
import { useSessionActions, useSessionState } from '@/features/session/SessionProvider';

import type { Stage } from '../types';

export function useSetupPinFlow(keepsDocuments: boolean) {
  const { error } = useSessionState();
  const { setUp } = useSessionActions();
  const biometrics = useBiometricAvailability();
  const [stage, setStage] = useState<Stage>('create');
  const [first, setFirst] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const shownError = error !== dismissedError ? error : null;

  const startOver = () => {
    setStage('create');
    setFirst('');
  };

  const {
    pin,
    error: flash,
    shake,
    press,
    clear,
  } = usePinEntry({
    onComplete: (entered, helpers) => {
      if (stage === 'create') {
        setFirst(entered);
        setMismatch(false);
        setStage(isEasyPin(entered) ? 'easy' : 'confirm');
        if (!isEasyPin(entered)) helpers.clear();
        return;
      }
      if (entered !== first) {
        setMismatch(true);
        helpers.fail(startOver);
        return;
      }
      setStage('saving');
      setDismissedError(null);
      const offerBiometrics = !keepsDocuments && biometrics?.state === 'available';
      setUp(entered, { holdForOnboarding: offerBiometrics }).then((ok) => {
        if (ok && offerBiometrics) {
          router.replace('/setup/biometrics');
        } else if (!ok) {
          startOver();
          clear();
        }
      });
    },
  });

  const onKey = (key: string) => {
    if (error) setDismissedError(error);
    press(key);
  };

  const acceptEasyPin = () => {
    clear();
    setStage('confirm');
  };

  const chooseAnother = () => {
    clear();
    startOver();
  };

  return { stage, mismatch, shownError, pin, flash, shake, onKey, acceptEasyPin, chooseAnother };
}
