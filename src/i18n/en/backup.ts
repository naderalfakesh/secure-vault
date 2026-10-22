/** J6 Backup hub, create and restore (handover §6 J6, §7.1, §7.7). */
export const backup = {
  'backup.hub.title': 'Backup',
  'backup.hub.back': 'Settings',
  'backup.hub.card.title': 'One encrypted file, your passphrase',
  'backup.hub.card.body':
    'A backup holds every document and the index, encrypted with a passphrase you choose. SecureVault never stores that passphrase, so nobody can open the backup without it, including you.',
  'backup.hub.create': 'Create a backup',
  'backup.hub.exportRunning': 'An export started earlier is still finishing',
  'backup.hub.restore.header': 'Restore',
  'backup.hub.restore.title': 'Restore from a backup…',
  'backup.hub.restore.subtitle': 'Replaces everything in this vault',
  'backup.hub.restoreRunning': 'A restore started earlier is still running',
  'backup.hub.footnote':
    'You decide where the file goes: Files, a computer or a drive. A backup made on iPhone restores on Android, and the other way round.',
  'backup.picker.notBackup': 'That file isn’t a SecureVault backup.',
  'backup.picker.failed': 'The file picker couldn’t open. Try again in a moment.',

  'backup.create.title': 'Encrypted backup',
  'backup.create.intro':
    'Choose a passphrase. You’ll need it to restore, and SecureVault can’t recover it for you.',
  'backup.create.passphrase': 'Passphrase',
  'backup.create.repeat': 'Repeat passphrase',
  'backup.create.hint':
    'A few unrelated words are easier to remember than a short, complex password.',
  'backup.create.rule.length': 'At least 8 characters',
  'backup.create.rule.repeated': 'Not the same character repeated',
  'backup.create.match': 'Passphrases match',
  'backup.create.mismatch': 'The passphrases don’t match yet.',
  'backup.create.sameEverywhere': 'Type it exactly the same way when you restore, on any phone.',
  'backup.create.button': 'Create backup',
  'backup.create.busy.title': 'Creating backup',
  'backup.create.busy.body':
    'Keep SecureVault open until this finishes. Your vault isn’t changed by creating a backup.',
  'backup.create.failed':
    'The backup couldn’t be created. There may not be enough free space. Your vault wasn’t changed.',
  'backup.create.retry': 'Try again',
  'backup.create.close': 'Close',

  'backup.restore.title': 'Restore from backup',
  'backup.restore.warning':
    'Everything currently in this vault will be replaced by this backup, including documents added after it was made.',
  'backup.restore.passphrase': 'Backup passphrase',
  'backup.restore.placeholder': 'Enter the passphrase',
  'backup.restore.explainer':
    'SecureVault checks the whole file first. Nothing changes until every entry has been checked.',
  'backup.restore.button': 'Restore and replace vault',
  'backup.restore.cancel': 'Cancel',
  'backup.restore.cancelling': 'Cancelling…',
  'backup.restore.checking.step': 'Step 1 of 2',
  'backup.restore.restoring.step': 'Step 2 of 2',
  'backup.restore.unchanged': 'Nothing has been changed yet.',
  'backup.restore.cancelAvailable': 'You can still cancel.',
  'backup.restore.cantStop.title': 'This can’t be stopped.',
  'backup.restore.cantStop.body':
    'The previous vault has been removed. Keep SecureVault open until this finishes.',
  'backup.restore.partial.title': 'The restore didn’t finish',
  'backup.restore.again': 'Restore again',
  'backup.restore.chooseAnother': 'Choose another file',
  'backup.restore.close': 'Close',
  'backup.restore.stoppedBehindLock': 'The restore did not finish. Try it again.',

  'backup.restore.progress.verify': 'Checking {done} of {total}',
  'backup.restore.progress.import': 'Restoring {done} of {total}',
  /** Before the first entry of a pass is done, when "0 of N" would read as stuck. */
  'backup.restore.progress.verifyStart': 'Checking…',
  'backup.restore.progress.importStart': 'Restoring…',
  'backup.restore.fileMeta': '{entries} · made {date}',
  'backup.restore.stoppedAt': 'Stopped at entry {entry} of {total}',
  'backup.restore.done': 'Vault restored: {count} entries',
  'backup.hub.lastCreated': 'Last created on this phone: {date}',
  'backup.create.progress': 'Encrypting {done} of {total}',
  'backup.create.percent': '{percent}%',
  'backup.create.shared': 'Backup of {count} entries ({size}) shared',
  'backup.create.shareInterrupted':
    'SecureVault locked while you were sharing. The temporary copy was removed.',
  'backup.create.exportStopped':
    'The backup was cancelled before it could be shared. Nothing left the vault.',
  /** The localisable middle of the file name; the brand and `.svbackup` stay fixed. */
  'backup.fileName': 'backup {date}',
  'backup.passphrase.tooShort': 'Use at least {count} characters.',
  'backup.passphrase.oneCharacter': 'Use more than one character.',
  'backup.passphrase.mismatch': 'The two passphrases do not match.',
  'backup.error.fallback': 'Could not use this backup.',
  'backup.error.passphrase': 'That passphrase does not match this backup. Nothing was changed.',
  'backup.error.invalid':
    'This file is not a SecureVault backup, or it is damaged. Nothing was changed.',
  'backup.error.unsupported':
    "This backup uses settings this version of the app doesn't support. Nothing was changed.",
  'backup.error.partial':
    'The restore stopped after the previous vault was removed. Restore the backup again.',
  'backup.error.resource':
    "This device doesn't have enough free space or memory to restore this backup. Nothing was changed.",
  'backup.error.noSpace':
    "This device doesn't have enough free space to restore this backup. Nothing was changed. Free up some space and try again.",
  'backup.error.index':
    'Your documents were restored but the index could not be opened. Restore the backup again.',
  'backup.error.cancelled': 'Restore cancelled. Nothing was changed.',
  'backup.error.keyLocked': 'The device key was not unlocked, so nothing was changed. Try again.',
  'backup.error.keyInvalidated': '{message} Nothing was changed.',
  'backup.error.staging':
    "The backup's temporary files could not be cleared, so no backup was made. Try again.",
  'backup.error.restoreStaging':
    "The restore's temporary files could not be cleared, so nothing was changed. Try again.",
  'backup.error.busy': 'A backup or restore is still running. Try again once it has finished.',
  'backup.error.exportFailed':
    'The backup could not be written. Check that the device has free space and try again.',
  'backup.error.importFailed': 'The restore could not start, so nothing was changed. Try again.',
  'backup.error.keysFailed': "The vault's files could not be read. Try again.",
} as const;
