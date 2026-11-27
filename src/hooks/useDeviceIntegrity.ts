import { useEffect, useState } from 'react';

import { detectDeviceCompromise } from '@/security/securityChecks';

export function useDeviceIntegrity(): boolean {
  const [intact, setIntact] = useState(true);

  useEffect(() => {
    let active = true;
    detectDeviceCompromise().then((result) => {
      if (active) setIntact(!result.rooted && !result.tampered);
    });
    return () => {
      active = false;
    };
  }, []);

  return intact;
}
