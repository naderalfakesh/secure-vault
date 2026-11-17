import { Directory } from 'expo-file-system';

import { busyError, indexError, partialError, stagingError } from '../errors';
import { isInside, toPath } from '../folders';
import { localDate } from '../format';

describe('localDate', () => {
  it('writes the device calendar date with padded month and day', () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localDate(new Date(2026, 10, 18))).toBe('2026-11-18');
  });
});

describe('backup paths', () => {
  it('turns a file URI into a decoded path', () => {
    expect(toPath('file:///cache/My%20Backup.svbackup')).toBe('/cache/My Backup.svbackup');
    expect(toPath('/cache/a')).toBe('/cache/a');
  });

  it('tells whether a URI lies inside a folder, not beside it', () => {
    const picker = new Directory('file:///cache/DocumentPicker');
    expect(isInside('file:///cache/DocumentPicker/a.svbackup', picker)).toBe(true);
    expect(isInside('file:///cache/DocumentPicker%20x/a.svbackup', picker)).toBe(false);
    expect(isInside('file:///cache/DocumentPickerX/a.svbackup', picker)).toBe(false);
  });
});

describe('backup errors', () => {
  it('gives busy and staging failures their codes', () => {
    expect(busyError()).toMatchObject({ code: 'BACKUP_BUSY' });
    const cause = new Error('EACCES /cache/backup');
    const staging = stagingError('BACKUP_STAGING_INVALID', cause);
    expect(staging).toMatchObject({ code: 'BACKUP_STAGING_INVALID', cause });
    expect(staging.message).not.toContain('/cache');
  });

  it('keeps the cause message for an index failure, or says the index could not open', () => {
    expect(indexError(new Error('bad key'))).toMatchObject({
      code: 'BACKUP_INDEX',
      message: 'bad key',
    });
    expect(indexError('x').message).toBe('The index could not be opened.');
  });

  it('names a failure after the wipe partial, except an index failure', () => {
    const stoppedAt = { entry: 3, total: 9 };
    expect(partialError(new Error('io'), stoppedAt)).toMatchObject({
      code: 'BACKUP_PARTIAL',
      message: 'io',
      stoppedAt,
    });
    const index = indexError(new Error('bad key'));
    expect(partialError(index, stoppedAt)).toBe(index);
  });
});
