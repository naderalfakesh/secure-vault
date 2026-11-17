import { t } from '@/i18n';

import { BACKUP_BRAND, BACKUP_EXTENSION } from './constants';

/** The calendar date on this device, YYYY-MM-DD: the day the user made the backup, not UTC's. */
export function localDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The container's file name: the brand, the dated middle in the user's language, the extension. */
export function backupFileName(date = new Date()): string {
  const middle = t('backup.fileName', { date: localDate(date) });
  return `${BACKUP_BRAND} ${middle}${BACKUP_EXTENSION}`;
}
