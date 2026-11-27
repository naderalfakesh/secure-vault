import { useEffect } from 'react';

import { documentService } from '@/services/DocumentService';

export function useLegacyScratchSweep(): void {
  useEffect(() => {
    documentService.sweepLegacyScratch();
  }, []);
}
