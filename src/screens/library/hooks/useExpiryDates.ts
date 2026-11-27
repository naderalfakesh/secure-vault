import { useEffect, useState } from 'react';

import type { ExpiryDates } from '@/features/documents/library';
import { documentService } from '@/services/DocumentService';
import type { Document } from '@/types';

import { ALL_EXPIRY_DAYS } from '../constants';
import { expiringCutoffDate } from '../helpers';

export function useExpiryDates(documents: readonly Document[]) {
  const [expiry, setExpiry] = useState<ExpiryDates>(new Map());

  useEffect(() => {
    let active = true;
    documentService
      .getExpiring(ALL_EXPIRY_DAYS)
      .then((rows) => {
        if (!active) return;
        setExpiry(new Map(rows.map(({ document, date }) => [document.id, date])));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [documents]);

  return { expiry, railCutoff: expiringCutoffDate() };
}
