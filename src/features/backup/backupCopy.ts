import { describeBackupError, describeBackupErrorPlainly } from '@/services/BackupService';
import { formatDate, pluralize } from '@/utils/format';

/**
 * The J6 Backup hub, create and restore strings (handover §6 J6, §7.1, §7.7),
 * keyed so a later string table (§10.1, F17) can take them over unchanged.
 * The outcome sentences themselves come from `describeBackupError`, which the
 * notices after a lock use too.
 */
export const backupCopy = {
  'hub.title': 'Backup',
  'hub.back': 'Settings',
  'hub.card.title': 'One encrypted file, your passphrase',
  'hub.card.body':
    'A backup holds every document and the index, encrypted with a passphrase you choose. SecureVault never stores that passphrase, so nobody can open the backup without it, including you.',
  'hub.create': 'Create a backup',
  'hub.exportRunning': 'An export started earlier is still finishing',
  'hub.restore.header': 'Restore',
  'hub.restore.title': 'Restore from a backup…',
  'hub.restore.subtitle': 'Replaces everything in this vault',
  'hub.restoreRunning': 'A restore started earlier is still running',
  'hub.footnote':
    'You decide where the file goes: Files, a computer or a drive. A backup made on iPhone restores on Android, and the other way round.',
  'picker.notBackup': 'That file isn’t a SecureVault backup.',

  'create.title': 'Encrypted backup',
  'create.intro':
    'Choose a passphrase. You’ll need it to restore, and SecureVault can’t recover it for you.',
  'create.passphrase': 'Passphrase',
  'create.repeat': 'Repeat passphrase',
  'create.hint': 'A few unrelated words are easier to remember than a short, complex password.',
  'create.rule.length': 'At least 8 characters',
  'create.rule.repeated': 'Not the same character repeated',
  'create.match': 'Passphrases match',
  'create.mismatch': 'The passphrases don’t match yet.',
  'create.sameEverywhere': 'Type it exactly the same way when you restore, on any phone.',
  'create.button': 'Create backup',
  'create.busy.title': 'Creating backup',
  'create.busy.body':
    'Keep SecureVault open until this finishes. Your vault isn’t changed by creating a backup.',
  'create.failed':
    'The backup couldn’t be created. There may not be enough free space. Your vault wasn’t changed.',
  'create.retry': 'Try again',
  'create.close': 'Close',

  'restore.title': 'Restore from backup',
  'restore.warning':
    'Everything currently in this vault will be replaced by this backup, including documents added after it was made.',
  'restore.passphrase': 'Backup passphrase',
  'restore.placeholder': 'Enter the passphrase',
  'restore.explainer':
    'SecureVault checks the whole file first. Nothing changes until every entry has been checked.',
  'restore.button': 'Restore and replace vault',
  'restore.cancel': 'Cancel',
  'restore.cancelling': 'Cancelling…',
  'restore.checking.step': 'Step 1 of 2',
  'restore.restoring.step': 'Step 2 of 2',
  'restore.unchanged': 'Nothing has been changed yet.',
  'restore.cancelAvailable': 'You can still cancel.',
  'restore.cantStop.title': 'This can’t be stopped.',
  'restore.cantStop.body':
    'The previous vault has been removed. Keep SecureVault open until this finishes.',
  'restore.partial.title': 'The restore didn’t finish',
  'restore.again': 'Restore again',
  'restore.chooseAnother': 'Choose another file',
  'restore.close': 'Close',
  'restore.stoppedBehindLock': 'The restore did not finish. Try it again.',
} as const;

export type BackupCopyKey = keyof typeof backupCopy;

/** "Checking 18 of 48" / "Restoring 7 of 48". */
export function restoreProgressLabel(phase: 'verify' | 'import', done: number, total: number) {
  return `${phase === 'verify' ? 'Checking' : 'Restoring'} ${done} of ${total}`;
}

/** "48 entries · made 12 Oct 2026", or without the date when the header has none. */
export function backupFileMeta(entries: number, created?: string | null): string {
  const count = pluralize(entries, 'entry', 'entries');
  const made = created ? formatDate(created) : '';
  return made ? `${count} · made ${made}` : count;
}

export function lastCreatedLine(date: Date): string {
  return `Last created on this phone: ${formatDate(date.toISOString())}`;
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
