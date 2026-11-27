import { t } from '@/i18n';

import { BACKUP_BRAND, BACKUP_EXTENSION } from './constants';

export function localDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function backupFileName(date = new Date()): string {
  const middle = t('backup.fileName', { date: localDate(date) });
  return `${BACKUP_BRAND} ${middle}${BACKUP_EXTENSION}`;
}
