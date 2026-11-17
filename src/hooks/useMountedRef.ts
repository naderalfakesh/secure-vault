import { useEffect, useRef } from 'react';

/** True while the screen is mounted; late async results check it before touching state. */
export function useMountedRef() {
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  return mountedRef;
}
