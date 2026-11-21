import { passphraseLength } from '../backup/passphrase';
import {
  backupFileName,
  describeBackupError,
  describeBackupErrorPlainly,
  passphraseProblem,
} from '../BackupService';

describe('backup file name', () => {
  it('keeps the brand and the extension out of the translated part', () => {
    expect(backupFileName(new Date(2026, 9, 13, 12))).toBe(
      'SecureVault backup 2026-10-13.svbackup',
    );
  });

  it('names the local calendar day, not the UTC one', () => {
    // 00:30 local on 14 October; in any zone east of UTC that is still the 13th in UTC.
    const lateNight = new Date(2026, 9, 14, 0, 30);
    jest.spyOn(lateNight, 'toISOString').mockReturnValue('2026-10-13T21:30:00.000Z');

    expect(backupFileName(lateNight)).toBe('SecureVault backup 2026-10-14.svbackup');
    // 23:30 local on 13 October; west of UTC that is already the 14th in UTC.
    expect(backupFileName(new Date(2026, 9, 13, 23, 30))).toBe(
      'SecureVault backup 2026-10-13.svbackup',
    );
  });
});

describe('passphrase policy', () => {
  it('rejects short, repeated, and mismatched passphrases', () => {
    expect(passphraseProblem('short')).toMatch(/at least 8/);
    expect(passphraseProblem('aaaaaaaa')).toMatch(/more than one character/);
    expect(passphraseProblem('correct horse', 'wrong horse')).toMatch(/do not match/);
    expect(passphraseProblem('correct horse', 'correct horse')).toBeNull();
  });

  it('accepts a passphrase in any script, Arabic-Indic digits included', () => {
    expect(passphraseProblem('٢٠٢٦١٢٣٤')).toBeNull();
    expect(passphraseProblem('قمر فوق جبل', 'قمر فوق جبل')).toBeNull();
    expect(passphraseProblem('٢٠٢٦١٢٣٤', '20261234')).toMatch(/do not match/);
  });

  it('counts code points, so four emoji are too short and eight are enough', () => {
    expect(passphraseLength('😀😁😂🤣')).toBe(4);
    expect(passphraseProblem('😀😁😂🤣')).toMatch(/at least 8/);
    expect(passphraseProblem('😀😁😂🤣😃😄😅😆')).toBeNull();
    expect(passphraseProblem('😀'.repeat(8))).toMatch(/more than one character/);
  });

  it('turns native error codes into sentences', () => {
    expect(describeBackupError({ code: 'BACKUP_PASSPHRASE' })).toBe(
      'That passphrase does not match this backup. Nothing was changed.',
    );
    expect(describeBackupError({ code: 'BACKUP_INVALID' })).toBe(
      'This file is not a SecureVault backup, or it is damaged. Nothing was changed.',
    );
    expect(describeBackupError({ code: 'BACKUP_UNSUPPORTED' })).toBe(
      "This backup uses settings this version of the app doesn't support. Nothing was changed.",
    );
    expect(describeBackupError({ code: 'BACKUP_PARTIAL' })).toMatch(/previous vault was removed/);
    expect(describeBackupError({ code: 'BACKUP_PARTIAL' })).not.toMatch(/Nothing was changed/);
    expect(describeBackupError({ code: 'BACKUP_RESOURCE' })).toBe(
      "This device doesn't have enough free space or memory to restore this backup. Nothing was changed.",
    );
    expect(describeBackupError({ code: 'BACKUP_NO_SPACE' })).toBe(
      "This device doesn't have enough free space to restore this backup. Nothing was changed. Free up some space and try again.",
    );
    expect(describeBackupError({ code: 'BACKUP_INDEX' })).toBe(
      'Your documents were restored but the index could not be opened. Restore the backup again.',
    );
    expect(describeBackupError({ code: 'BACKUP_CANCELLED' })).toBe(
      'Restore cancelled. Nothing was changed.',
    );
    expect(describeBackupError({ code: 'KEY_LOCKED', message: 'User not authenticated' })).toBe(
      'The device key was not unlocked, so nothing was changed. Try again.',
    );
    expect(describeBackupError({ code: 'KEY_INVALIDATED' })).toMatch(
      /can no longer be used\..* Nothing was changed\.$/,
    );
    expect(describeBackupError({ code: 'BACKUP_STAGING_INVALID' })).toMatch(
      /temporary files could not be cleared/,
    );
    expect(describeBackupError({ code: 'BACKUP_RESTORE_STAGING_INVALID' })).toMatch(
      /restore's temporary files could not be cleared, so nothing was changed/,
    );
    expect(describeBackupError({ code: 'BACKUP_BUSY' })).toMatch(/still running/);
    expect(
      describeBackupError({ code: 'BACKUP_EXPORT_FAILED', message: 'Could not list files' }),
    ).toMatch(/backup could not be written/);
    expect(describeBackupError({ code: 'BACKUP_IMPORT_FAILED' })).toMatch(/nothing was changed/);
    expect(describeBackupError({ code: 'GET_ALL_KEYS_FAILED' })).toMatch(/files could not be read/);
    expect(describeBackupError(new Error('disk full'))).toBe('disk full');
    expect(describeBackupError(null)).toBe('Could not use this backup.');
    expect(describeBackupError(null, 'Could not create the backup.')).toBe(
      'Could not create the backup.',
    );
  });

  it('never passes on the platform message when describing plainly', () => {
    expect(describeBackupErrorPlainly({ code: 'BACKUP_PARTIAL' }, 'fallback')).toMatch(
      /previous vault was removed/,
    );
    expect(
      describeBackupErrorPlainly(new Error('/var/mobile/Caches/backup/restore: EIO'), 'fallback'),
    ).toBe('fallback');
    expect(describeBackupErrorPlainly({ code: 'SOMETHING_ELSE' }, 'fallback')).toBe('fallback');
    expect(
      describeBackupErrorPlainly({ code: 'BACKUP_RESTORE_STAGING_INVALID' }, 'fallback'),
    ).toMatch(/nothing was changed/);
    for (const code of ['BACKUP_UNSUPPORTED', 'BACKUP_RESOURCE', 'BACKUP_NO_SPACE']) {
      expect(describeBackupErrorPlainly({ code, message: '/var/mobile/x' }, 'fallback')).toMatch(
        /Nothing was changed/,
      );
    }
  });
});
