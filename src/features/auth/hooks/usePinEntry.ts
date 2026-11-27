import { useCallback, useEffect, useRef, useState } from 'react';

const PIN_LENGTH = 6;
// Brief delay so the final filled dot renders before reacting.
const SUBMIT_DELAY_MS = 120;
const ERROR_FLASH_MS = 600;

interface PinEntryHelpers {
  clear: () => void;
  fail: (after?: () => void) => void;
}

interface UsePinEntryOptions {
  length?: number;
  onComplete: (pin: string, helpers: PinEntryHelpers) => void;
}

export function usePinEntry({ length = PIN_LENGTH, onComplete }: UsePinEntryOptions) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(0);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const schedule = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const clear = useCallback(() => {
    setPin('');
    setError(false);
  }, []);

  const fail = useCallback(
    (after?: () => void) => {
      setError(true);
      setShake((value) => value + 1);
      schedule(() => {
        setPin('');
        after?.();
      }, ERROR_FLASH_MS);
    },
    [schedule],
  );

  const press = useCallback(
    (key: string) => {
      setError(false);
      if (key === 'del') {
        setPin((current) => current.slice(0, -1));
        return;
      }
      setPin((current) => {
        if (current.length >= length) return current;
        const next = current + key;
        if (next.length === length) {
          schedule(() => onComplete(next, { clear, fail }), SUBMIT_DELAY_MS);
        }
        return next;
      });
    },
    [length, onComplete, schedule, clear, fail],
  );

  return { pin, error, shake, press, clear, fail };
}
