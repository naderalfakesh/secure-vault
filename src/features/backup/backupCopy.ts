import { t, tp } from '@/i18n';
import { backup } from '@/i18n/en/backup';
import { describeBackupError, describeBackupErrorPlainly } from '@/services/BackupService';
import { formatDate } from '@/utils/format';

export type BackupCopyKey = keyof typeof backup extends infer K
  ? K extends `backup.${infer Short}`
    ? Short
    : never
  : never;

/**
 * The J6 Backup hub, create and restore strings (handover §6 J6, §7.1, §7.7),
 * read from the string table's `backup` namespace by their short names.
 * The outcome sentences themselves come from `describeBackupError`, which the
 * notices after a lock use too.
 */
export const backupCopy = Object.fromEntries(
  (Object.keys(backup) as (keyof typeof backup)[]).map((key) => [
    key.slice('backup.'.length),
    t(key),
  ]),
) as Record<BackupCopyKey, string>;

/** "Checking 18 of 48" / "Restoring 7 of 48". */
export function restoreProgressLabel(phase: 'verify' | 'import', done: number, total: number) {
  return t(`backup.restore.progress.${phase}`, { done, total });
}

/** "48 entries · made 12 Oct 2026", or without the date when the header has none. */
export function backupFileMeta(entries: number, created?: string | null): string {
  const count = tp('format.entries', entries);
  const made = created ? formatDate(created) : '';
  return made ? t('backup.restore.fileMeta', { entries: count, date: made }) : count;
}

export function lastCreatedLine(date: Date): string {
  return t('backup.hub.lastCreated', { date: formatDate(date.toISOString()) });
}

/** What the restore sheet shows after a restore that did not succeed (handover §7.1). */
export type RestoreOutcome =
  /** Back to the inspect step: the field keeps the passphrase and Restore stays enabled. */
  | { kind: 'inspect'; message: string; tone: 'danger' | 'info'; field: boolean }
  /** The file itself is the problem: offer another one. */
  | { kind: 'chooseFile'; message: string }
  /** Nothing to retry on this device: only Close. */
  | { kind: 'close'; message: string }
  /** After the wipe: the vault is partly replaced. */
  | { kind: 'partial'; message: string; stoppedAt: { entry: number; total: number } | null }
  /** The documents are back but the index is not. */
  | { kind: 'index'; message: string };

function codeOf(error: unknown): unknown {
  return typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : null;
}

export function restoreOutcome(error: unknown): RestoreOutcome {
  const code = codeOf(error);
  switch (code) {
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
      const stoppedAt = (error as { stoppedAt?: { entry: number; total: number } | null })
        .stoppedAt;
      return { kind: 'partial', message: describeBackupError(error), stoppedAt: stoppedAt ?? null };
    }
    case 'BACKUP_INDEX':
      return { kind: 'index', message: describeBackupError(error) };
    default:
      // KEY_LOCKED before the wipe, the staging and busy refusals: worth another try.
      // Never the platform's own text, which can name cache paths.
      return {
        kind: 'inspect',
        message: describeBackupErrorPlainly(error, backupCopy['restore.stoppedBehindLock']),
        tone: 'danger',
        field: false,
      };
  }
}
