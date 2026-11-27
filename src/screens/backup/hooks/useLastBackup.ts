import { useEffect, useState } from 'react';

import { loadLastBackup } from '@/features/backup/lastBackup';

export function useLastBackup() {
  const [lastBackup, setLastBackup] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;
    loadLastBackup().then((date) => {
      if (active) setLastBackup(date);
    });
    return () => {
      active = false;
    };
  }, []);

  return [lastBackup, setLastBackup] as const;
}
