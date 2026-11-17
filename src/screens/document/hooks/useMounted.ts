import { useEffect, useRef } from 'react';

/** A ref that is true while the screen is mounted, for work that outlives it. */
export function useMounted() {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}
