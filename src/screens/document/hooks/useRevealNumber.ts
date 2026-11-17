import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Whether recognised numbers are shown in full. */
export function useRevealNumber() {
  const [revealNumber, setRevealNumber] = useState(false);

  // A revealed number is masked again as soon as the app leaves the screen.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') setRevealNumber(false);
    });
    return () => subscription.remove();
  }, []);

  const toggleReveal = useCallback(() => setRevealNumber((value) => !value), []);

  return { revealNumber, toggleReveal };
}
