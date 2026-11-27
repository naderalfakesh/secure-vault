import { useSyncExternalStore } from 'react';

import { backupService } from '@/services/BackupService';

export const useBackupActivity = () =>
  useSyncExternalStore(backupService.onActivity, backupService.activity);
