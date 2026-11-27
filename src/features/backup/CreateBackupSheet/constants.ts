import { Platform } from 'react-native';

import { backupCopy as copy } from '../backupCopy';

export const SHARE_INTERRUPTED = copy['create.shareInterrupted'];

export const CAN_SAVE = () => Platform.OS === 'android';

export const SAVE_INTERRUPTED = copy['create.saveInterrupted'];

export const EXPORT_STOPPED = copy['create.exportStopped'];

export const SPECIFIC_EXPORT_ERRORS = new Set([
  'BACKUP_STAGING_INVALID',
  'BACKUP_BUSY',
  'KEY_LOCKED',
  'KEY_INVALIDATED',
]);

export const SHEET_DISMISS_MS = 450;
