import { router } from 'expo-router';
import { useState } from 'react';

import { useBiometricAvailability } from '@/features/auth/biometricAvailability';
import { isEasyPin } from '@/features/auth/onboardingCopy';
import { usePinEntry } from '@/features/auth/usePinEntry';
import { useSession } from '@/features/session/SessionProvider';

import type { Stage } from '../types';

/** Choose, (maybe) accept an easy PIN, confirm, then save the PIN with the session. */
export function useCreatePin(keepsDocuments: boolean) {
  const { setUp, error } = useSession();
  const biometrics = useBiometricAvailability();
  const [stage, setStage] = useState<Stage>('create');
  const [first, setFirst] = useState('');
  const [mismatch, setMismatch] = useState(false);
  // A setup failure stays in the session until the next attempt; once the
  // owner starts a new PIN it is old news and gives way to the step's hint.
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
        // A soft warning only: the owner may keep an easy PIN.
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
      // The biometrics step follows a new or emptied vault when there is
      // something to turn on; Add a PIN goes straight back to the documents.
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

  const useAnyway = () => {
    clear();
    setStage('confirm');
  };

  const chooseAnother = () => {
    clear();
    startOver();
  };

  return { stage, mismatch, shownError, pin, flash, shake, onKey, useAnyway, chooseAnother };
}
