import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { useToast } from '@/components/ui';
import { clearLastBackup } from '@/features/backup/lastBackup';
import { useSession } from '@/features/session/SessionProvider';
import { useBackupActivity } from '@/hooks/useBackupActivity';
import { t } from '@/i18n';
import { backupService, describeBackupError } from '@/services/BackupService';
import { documentService } from '@/services/DocumentService';

import { totalCount } from '../helpers';
import type { EraseRequest, SettingsBusy } from '../types';

/** Delete everything: the sheet with its document count, the confirmation, and the erase. */
export function useEraseVault() {
  const toast = useToast();
  const { eraseVault } = useSession();
  // The Delete everything sheet, with the number of documents it erases.
  const [erase, setErase] = useState<EraseRequest | null>(null);
  const [busy, setBusy] = useState<SettingsBusy>(null);
  // An export or restore, possibly started before the last lock, is still
  // running in the Backup hub; nothing may erase the vault under it.
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
    // Destructive and irreversible: the one place a native confirmation is right.
    Alert.alert(t('settings.erase.title'), t('settings.erase.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.erase'),
        style: 'destructive',
        onPress: async () => {
          setErase(null);
          setBusy('clear');
          try {
            const pinCleared = await backupService.exclusive('erase', async () => {
              await documentService.eraseEverything();
              await clearLastBackup();
              return eraseVault();
            });
            toast.show(
              pinCleared
                ? { message: t('settings.erase.done') }
                : // The erase finished, but the old PIN record survived both delete attempts.
                  { message: t('settings.erase.pinNotCleared'), tone: 'danger' },
            );
          } catch (e) {
            toast.show({
              message: describeBackupError(e, t('settings.erase.failed')),
              tone: 'danger',
            });
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }, [toast, eraseVault]);

  return { erase, busy, running, blocked, openErase, closeErase, clearAll };
}
