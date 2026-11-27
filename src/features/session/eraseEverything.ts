import { Alert } from 'react-native';

import { clearLastBackup } from '@/features/backup/lastBackup';
import { t } from '@/i18n';
import { backupService } from '@/services/BackupService';
import { documentService } from '@/services/DocumentService';

export function confirmErase(onConfirm: () => void): void {
  Alert.alert(t('settings.erase.title'), t('settings.erase.confirmBody'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('settings.erase'), style: 'destructive', onPress: onConfirm },
  ]);
}

export function eraseEverything(eraseVault: () => Promise<boolean>): Promise<boolean> {
  return backupService.exclusive('erase', async () => {
    await documentService.eraseEverything();
    await clearLastBackup();
    return eraseVault();
  });
}
