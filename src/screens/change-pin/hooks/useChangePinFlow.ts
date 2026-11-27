import { router } from 'expo-router';
import { useState } from 'react';

import { useToast } from '@/components/ui';
import { usePinEntry } from '@/features/auth/hooks/usePinEntry';
import type { SessionActions } from '@/features/session/SessionProvider';
import { t } from '@/i18n';

import type { Stage } from '../types';

export function useChangePinFlow(changePin: SessionActions['changePin']) {
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
      // Current PIN is verified atomically with the change inside changePin().
      changePin(current, entered).then((result) => {
        if (result === 'changed') {
          toast.show({ message: t('changePin.changed'), tone: 'success' });
          router.back();
          return;
        }
        if (result === 'busy') {
          setStage('confirm');
          helpers.clear();
          return;
        }
        if (result === 'wrong-pin') setMessage(t('changePin.wrongPin'));
        setStage('current');
        helpers.clear();
      });
    },
  });

  return { stage, message, entry };
}
