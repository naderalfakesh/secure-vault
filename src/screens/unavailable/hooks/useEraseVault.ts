import { type RefObject, useState } from 'react';
import { Alert } from 'react-native';

import { clearLastBackup } from '@/features/backup/lastBackup';
import { useSession } from '@/features/session/SessionProvider';
import { t } from '@/i18n';
import { backupService } from '@/services/BackupService';
import { documentService } from '@/services/DocumentService';

/** "Delete everything", the only way on once nothing in the vault can be decrypted. */
export function useEraseVault(mounted: RefObject<boolean>) {
  const { eraseVault } = useSession();
  const [erasing, setErasing] = useState(false);
  const [eraseFailed, setEraseFailed] = useState(false);

  const eraseAll = () => {
    // Destructive and irreversible: the one place a native confirmation is right.
    Alert.alert(t('settings.erase.title'), t('settings.erase.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.erase'),
        style: 'destructive',
        onPress: async () => {
          setErasing(true);
          setEraseFailed(false);
          try {
            await backupService.exclusive('erase', async () => {
              await documentService.eraseEverything();
              await clearLastBackup();
              // Setup follows; an old PIN record that survived is replaced there.
              return eraseVault();
            });
          } catch {
            if (mounted.current) setEraseFailed(true);
          } finally {
            if (mounted.current) setErasing(false);
          }
        },
      },
    ]);
  };

  return { erasing, eraseFailed, eraseAll };
}
