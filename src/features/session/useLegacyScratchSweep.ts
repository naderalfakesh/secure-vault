import { useEffect } from 'react';

import { documentService } from '@/services/DocumentService';

/** Clears scratch files an earlier version left behind, once per launch. */
export function useLegacyScratchSweep(): void {
  useEffect(() => {
    documentService.sweepLegacyScratch();
  }, []);
}
