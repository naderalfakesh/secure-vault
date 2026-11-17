import { describeBackupError, MIN_PASSPHRASE_LENGTH } from '@/services/BackupService';

import { backupCopy as copy } from '../../backupCopy';
import { exportFailure, exportPercent, passphraseChecks } from '../helpers';

const coded = (code: string) => Object.assign(new Error('native text'), { code });

describe('create backup helpers', () => {
  it('names a specific export failure, and says the general line otherwise', () => {
    expect(exportFailure(coded('KEY_LOCKED'))).toBe(describeBackupError(coded('KEY_LOCKED')));
    expect(exportFailure(coded('BACKUP_BUSY'))).toBe(describeBackupError(coded('BACKUP_BUSY')));
    expect(exportFailure(coded('SOMETHING_ELSE'))).toBe(copy['create.failed']);
    expect(exportFailure(new Error('no code'))).toBe(copy['create.failed']);
    expect(exportFailure(null)).toBe(copy['create.failed']);
  });

  it('checks length by characters, variety, and the repeat', () => {
    const long = 'ab'.repeat(MIN_PASSPHRASE_LENGTH);
    expect(passphraseChecks('', '')).toEqual({ longEnough: false, varied: false, matches: false });
    expect(passphraseChecks(long, long)).toEqual({ longEnough: true, varied: true, matches: true });
    expect(passphraseChecks('a'.repeat(MIN_PASSPHRASE_LENGTH), '')).toEqual({
      longEnough: true,
      varied: false,
      matches: false,
    });
    // Emoji count as one character each.
    expect(passphraseChecks('😀'.repeat(MIN_PASSPHRASE_LENGTH - 1), 'x').longEnough).toBe(false);
    expect(passphraseChecks(long, `${long}x`).matches).toBe(false);
  });

  it('rounds the export progress to whole percent', () => {
    expect(exportPercent({ name: 'form' })).toBe(0);
    expect(exportPercent({ name: 'busy', done: 0, total: 0 })).toBe(0);
    expect(exportPercent({ name: 'busy', done: 1, total: 3 })).toBe(33);
    expect(exportPercent({ name: 'busy', done: 3, total: 3 })).toBe(100);
  });
});
