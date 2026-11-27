import { t, tp } from '@/i18n';
import { backup } from '@/i18n/en/backup';
import { PartialRestoreError } from '@/services/backup/errors';
import { describeBackupError, describeBackupErrorPlainly } from '@/services/BackupService';
import { errorCode } from '@/utils/errors';
import { formatDate } from '@/utils/format';

type BackupCopyKey = keyof typeof backup extends infer K
  ? K extends `backup.${infer Short}`
    ? Short
    : never
  : never;

export const backupCopy = Object.fromEntries(
  (Object.keys(backup) as (keyof typeof backup)[]).map((key) => [
    key.slice('backup.'.length),
    t(key),
  ]),
) as Record<BackupCopyKey, string>;

// Native module counts the passphrase check entry as entry 1; hide it from user-facing counts.
function withoutCheckEntry(done: number, total: number): { done: number; total: number } {
  return { done: Math.max(done - 1, 0), total: Math.max(total - 1, 0) };
}

export function restoreProgressLabel(phase: 'verify' | 'import', done: number, total: number) {
  const shown = withoutCheckEntry(done, total);
  if (shown.done <= 0) return t(`backup.restore.progress.${phase}Start`);
  return t(`backup.restore.progress.${phase}`, shown);
}

export function stoppedAtLabel(stoppedAt: { entry: number; total: number }): string {
  const shown = withoutCheckEntry(stoppedAt.entry, stoppedAt.total);
  return t('backup.restore.stoppedAt', { entry: Math.max(shown.done, 1), total: shown.total });
}

export function backupFileMeta(entries: number, created?: string | null): string {
  const count = tp('format.entries', entries);
  const made = created ? formatDate(created) : '';
  return made ? t('backup.restore.fileMeta', { entries: count, date: made }) : count;
}

export function lastCreatedLine(date: Date): string {
  return t('backup.hub.lastCreated', { date: formatDate(date.toISOString()) });
}

export type RestoreOutcome =
  | { kind: 'inspect'; message: string; tone: 'danger' | 'info'; field: boolean }
  | { kind: 'chooseFile'; message: string }
  | { kind: 'close'; message: string }
  | { kind: 'partial'; message: string; stoppedAt: { entry: number; total: number } | null }
  | { kind: 'index'; message: string };

export function restoreOutcome(error: unknown): RestoreOutcome {
  switch (errorCode(error)) {
    case 'BACKUP_PASSPHRASE':
      return { kind: 'inspect', message: describeBackupError(error), tone: 'danger', field: true };
    case 'BACKUP_CANCELLED':
      return { kind: 'inspect', message: describeBackupError(error), tone: 'info', field: false };
    case 'BACKUP_INVALID':
      return { kind: 'chooseFile', message: describeBackupError(error) };
    case 'BACKUP_UNSUPPORTED':
    case 'BACKUP_RESOURCE':
    case 'BACKUP_NO_SPACE':
      return { kind: 'close', message: describeBackupError(error) };
    case 'BACKUP_PARTIAL': {
      const stoppedAt = error instanceof PartialRestoreError ? error.stoppedAt : null;
      return { kind: 'partial', message: describeBackupError(error), stoppedAt };
    }
    case 'BACKUP_INDEX':
      return { kind: 'index', message: describeBackupError(error) };
    default:
      // Never expose raw platform text, which can include cache paths.
      return {
        kind: 'inspect',
        message: describeBackupErrorPlainly(error, backupCopy['restore.stoppedBehindLock']),
        tone: 'danger',
        field: false,
      };
  }
}
