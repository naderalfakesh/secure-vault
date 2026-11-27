import { useEffect, useRef } from 'react';

import { clearCopiedText } from '@/features/viewer/clipboard';
import { backupService } from '@/services/BackupService';
import { documentService } from '@/services/DocumentService';
import vault from '@modules/expo-vault';

import type { SessionStatus } from '../types';

function sweepCaches() {
  documentService.clearCache().catch(() => {});
  backupService.sweepCache();
}

export function useVaultSweep(status: SessionStatus): void {
  const landed = useRef(false);
  useEffect(() => {
    if (status === 'loading') return;
    const launching = !landed.current;
    landed.current = true;
    if (status === 'locked') {
      // Dismiss iOS share sheet before sweeping caches so it never offers a deleted file.
      vault.dismissShareSheet().catch(() => false);
      sweepCaches();
      void clearCopiedText();
    } else if (launching && (status === 'setup' || status === 'unavailable')) {
      sweepCaches();
    }
  }, [status]);
}
