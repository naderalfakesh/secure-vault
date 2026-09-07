import { useCallback, useEffect, useState } from 'react';
import type { SecurityCheckResult } from '../security/securityChecks';
import { detectDeviceCompromise } from '../security/securityChecks';

interface SecurityStatus extends SecurityCheckResult {
  loading: boolean;
}

const initialStatus: SecurityStatus = {
  loading: true,
  rooted: false,
  tampered: false,
  indicators: [],
  integrityIssues: [],
};

export const useSecurityStatus = () => {
  const [status, setStatus] = useState<SecurityStatus>(initialStatus);

  const runChecks = useCallback(async () => {
    setStatus((prev) => ({ ...prev, loading: true }));
    const result = await detectDeviceCompromise();
    setStatus({ ...result, loading: false });
  }, []);

  useEffect(() => {
    let active = true;
    detectDeviceCompromise().then((result) => {
      if (active) setStatus({ ...result, loading: false });
    });
    return () => {
      active = false;
    };
  }, []);

  return {
    ...status,
    refresh: runChecks,
    isSecure: !status.rooted && !status.tampered,
  };
};

export default useSecurityStatus;
