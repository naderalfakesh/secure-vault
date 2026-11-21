import { router } from 'expo-router';
import { useState } from 'react';

import { useToast } from '@/components/ui';
import { usePinEntry } from '@/features/auth/hooks/usePinEntry';
import type { SessionContextValue } from '@/features/session/SessionProvider';
import { t } from '@/i18n';

import type { Stage } from '../types';

/** Current PIN, new PIN, confirmation, then the change itself. */
export function useChangePinFlow(changePin: SessionContextValue['changePin']) {
  const toast = useToast();
  const [stage, setStage] = useState<Stage>('current');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const entry = usePinEntry({
    onComplete: (entered, helpers) => {
      setMessage(null);
      if (stage === 'current') {
        setCurrent(entered);
        setStage('next');
        helpers.clear();
        return;
      }
      if (stage === 'next') {
        if (entered === current) {
          setMessage(t('changePin.same'));
          helpers.fail();
          return;
        }
        setNext(entered);
        setStage('confirm');
        helpers.clear();
        return;
      }
      if (entered !== next) {
        setMessage(t('changePin.mismatch'));
        helpers.fail(() => setStage('next'));
        return;
      }
      setStage('saving');
      // The current PIN is checked once, here, together with the change.
      changePin(current, entered).then((result) => {
        if (result === 'changed') {
          toast.show({ message: t('changePin.changed'), tone: 'success' });
          router.back();
          return;
        }
        // Another attempt was still running: back to the last step, with the
        // current and new PIN kept, so only the confirmation is typed again.
        if (result === 'busy') {
          setStage('confirm');
          helpers.clear();
          return;
        }
        // A failure that is not a wrong PIN has its own sentence in the session
        // error; a running lockout shows its own title.
        if (result === 'wrong-pin') setMessage(t('changePin.wrongPin'));
        setStage('current');
        helpers.clear();
      });
    },
  });

  return { stage, message, entry };
}
