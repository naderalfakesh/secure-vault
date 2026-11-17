import { useEffect } from 'react';

import { useToast } from '@/components/ui';

import { type SessionStatus, useSession } from './SessionProvider';

/** A lock hides any toast; work that ended behind the lock reports after the unlock. */
export function useSessionToasts(status: SessionStatus): void {
  const { notice, dismissNotice } = useSession();
  const toast = useToast();

  useEffect(() => {
    if (status === 'locked') toast.hide();
  }, [status, toast]);

  useEffect(() => {
    // Work that ended behind the lock reports here, never over the lock screen.
    if (status === 'unlocked' && notice) {
      toast.show(notice);
      dismissNotice();
    }
  }, [status, notice, toast, dismissNotice]);
}
