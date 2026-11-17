import { type RefObject, useEffect, useRef } from 'react';

/** True while the calling component is mounted, so late results do not set state. */
export function useMounted(): RefObject<boolean> {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}
