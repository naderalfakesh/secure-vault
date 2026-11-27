import { useState } from 'react';

import { usePinEntry } from '@/features/auth/hooks/usePinEntry';
import type { PinUnlockResult } from '@/features/session/SessionProvider';

export function usePinUnlock(unlockWithPin: (pin: string) => Promise<PinUnlockResult>) {
  const [checking, setChecking] = useState(false);
  const [wrong, setWrong] = useState(false);

  const {
    pin,
    error: flash,
    shake,
    press,
  } = usePinEntry({
    onComplete: (entered, { clear, fail }) => {
      setChecking(true);
      unlockWithPin(entered)
        .then((result) => {
          if (result === 'unlocked') return;
          setWrong(result === 'wrong-pin');
          if (result === 'wrong-pin') fail();
          else clear();
        })
        .finally(() => setChecking(false));
    },
  });

  const onKey = (key: string) => {
    setWrong(false);
    press(key);
  };

  return { pin, flash, shake, checking, wrong, onKey };
}
