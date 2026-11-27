import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function useRevealNumber() {
  const [revealNumber, setRevealNumber] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') setRevealNumber(false);
    });
    return () => subscription.remove();
  }, []);

  const toggleReveal = useCallback(() => setRevealNumber((value) => !value), []);

  return { revealNumber, toggleReveal };
}
