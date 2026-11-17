import { Platform } from 'react-native';

import { backupCopy as copy } from '../backupCopy';

// The vault locked while the share sheet was still open or never appeared.
export const SHARE_INTERRUPTED = copy['create.shareInterrupted'];

// Android offers the system save screen; iOS's share sheet has Save to Files.
export const CAN_SAVE = () => Platform.OS === 'android';

// The vault locked while the save screen was up or the copy was being written.
export const SAVE_INTERRUPTED = copy['create.saveInterrupted'];

// Shown once the vault is unlocked; it names nothing about the vault.
export const EXPORT_STOPPED = copy['create.exportStopped'];

// Codes whose own sentence says more than the sheet's general failure line.
export const SPECIFIC_EXPORT_ERRORS = new Set([
  'BACKUP_STAGING_INVALID',
  'BACKUP_BUSY',
  'KEY_LOCKED',
  'KEY_INVALIDATED',
]);

/**
 * Time for the sheet's modal to finish dismissing; presenting the share sheet
 * over a dismissing modal leaves iOS with neither on screen.
 */
export const SHEET_DISMISS_MS = 450;
