import { useEffect } from 'react';

import { useToast } from '@/components/ui';

import { useSessionActions, useSessionState } from '../SessionProvider';

export function useSessionToasts(): void {
  const { status, notice } = useSessionState();
  const { dismissNotice } = useSessionActions();
  const toast = useToast();

  useEffect(() => {
    if (status === 'locked') toast.hide();
  }, [status, toast]);

  useEffect(() => {
    if (status === 'unlocked' && notice) {
      toast.show(notice);
      dismissNotice();
    }
  }, [status, notice, toast, dismissNotice]);
}
