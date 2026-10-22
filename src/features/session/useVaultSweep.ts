import { useEffect, useRef } from 'react';

import vault from '../../../modules/expo-vault';
import type { SessionStatus } from '@/features/session/SessionProvider';
import { clearCopiedText } from '@/features/viewer/clipboard';
import { backupService } from '@/services/BackupService';
import { documentService } from '@/services/DocumentService';

/** Decrypted previews, rendered pages, share copies, and backup ciphertext. */
function sweepCaches() {
  documentService.clearCache().catch(() => {});
  backupService.sweepCache();
}

/**
 * Removes what a session leaves behind. Every lock, whichever path locked it,
 * sweeps the caches, closes a share sheet left up, and clears copied text.
 * A launch that lands on setup or `unavailable` instead of the lock screen
 * sweeps the caches once too, so a copy a killed session left is not kept
 * until the first lock.
 */
export function useVaultSweep(status: SessionStatus): void {
  const landed = useRef(false);
  useEffect(() => {
    if (status === 'loading') return;
    const launching = !landed.current;
    landed.current = true;
    if (status === 'locked') {
      // A share sheet left up (iOS) closes with the vault, before its copy
      // goes, so it never sits over the lock screen offering a deleted file.
      vault.dismissShareSheet().catch(() => false);
      sweepCaches();
      // Document text the viewer copied, unless something else was copied since.
      void clearCopiedText();
    } else if (launching && (status === 'setup' || status === 'unavailable')) {
      sweepCaches();
    }
  }, [status]);
}
