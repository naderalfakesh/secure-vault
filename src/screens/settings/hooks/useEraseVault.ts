import { useCallback, useState } from 'react';

import { useToast } from '@/components/ui';
import { useBackupActivity } from '@/features/backup/hooks/useBackupActivity';
import { confirmErase, eraseEverything } from '@/features/session/eraseEverything';
import { useSessionActions } from '@/features/session/SessionProvider';
import { t } from '@/i18n';
import { describeBackupError } from '@/services/BackupService';
import { documentService } from '@/services/DocumentService';

import { totalCount } from '../helpers';
import type { EraseRequest, SettingsBusy } from '../types';

export function useEraseVault() {
  const toast = useToast();
  const { eraseVault } = useSessionActions();
  const [erase, setErase] = useState<EraseRequest | null>(null);
  const [busy, setBusy] = useState<SettingsBusy>(null);
  // Block vault erase while a background backup export/restore holds the BackupService slot.
  const running = useBackupActivity();
  const blocked = busy !== null || running !== null;

  const openErase = useCallback(() => {
    setErase({ count: null });
    documentService
      .countByCategory()
      .then((counts) => {
        const count = totalCount(counts);
        setErase((current) => (current ? { count } : current));
      })
      .catch(() => {});
  }, []);

  const closeErase = useCallback(() => setErase(null), []);

  const clearAll = useCallback(() => {
    confirmErase(async () => {
      setErase(null);
      setBusy('clear');
      try {
        const pinCleared = await eraseEverything(eraseVault);
        toast.show(
          pinCleared
            ? { message: t('settings.erase.done') }
            : { message: t('settings.erase.pinNotCleared'), tone: 'danger' },
        );
      } catch (e) {
        toast.show({
          message: describeBackupError(e, t('settings.erase.failed')),
          tone: 'danger',
        });
      } finally {
        setBusy(null);
      }
    });
  }, [toast, eraseVault]);

  return { erase, busy, running, blocked, openErase, closeErase, clearAll };
}
