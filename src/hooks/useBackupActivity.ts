import { useSyncExternalStore } from 'react';

import { backupService } from '../services/BackupService';

/** The export, restore, or erase still running, including one started before the last lock. */
export const useBackupActivity = () =>
  useSyncExternalStore(backupService.onActivity, backupService.activity);
