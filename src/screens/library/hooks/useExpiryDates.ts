import { useEffect, useState } from 'react';

import type { ExpiryDates } from '@/features/documents/library';
import { documentService } from '@/services/DocumentService';
import type { Document } from '@/types';

import { ALL_EXPIRY_DAYS } from '../constants';
import { expiringCutoffDate } from '../helpers';

/**
 * Every recorded expiry date, and the last day that goes on the Expiring soon
 * rail. Re-read whenever the list changes: fields are written right after a save.
 */
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

  // Computed per render: until the dates load no document has one, so the rail is empty.
  return { expiry, railCutoff: expiringCutoffDate() };
}
