import { useEffect, useState } from 'react';

import { detectDeviceCompromise } from '@/security/securityChecks';

/** False once the device looks rooted or tampered with; true until the check says so. Advisory only. */
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
