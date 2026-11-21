import { Alert } from 'react-native';

import { clearLastBackup } from '@/features/backup/lastBackup';
import { t } from '@/i18n';
import { backupService } from '@/services/BackupService';
import { documentService } from '@/services/DocumentService';

/** Destructive and irreversible: the one place a native confirmation is right. */
export function confirmErase(onConfirm: () => void): void {
  Alert.alert(t('settings.erase.title'), t('settings.erase.confirmBody'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('settings.erase'), style: 'destructive', onPress: onConfirm },
  ]);
}

/**
 * Empties the vault, forgets the last backup, then resets the session, with no
 * export or restore running alongside. Resolves to whether the old PIN record
 * was cleared; rejects when any step fails.
 */
export function eraseEverything(eraseVault: () => Promise<boolean>): Promise<boolean> {
  return backupService.exclusive('erase', async () => {
    await documentService.eraseEverything();
    await clearLastBackup();
    return eraseVault();
  });
}
