import { errorCode } from '@/utils/errors';

import { INDEX_FILE, MAIN_INDEX_FILE } from '../constants';
import { keyError } from '../errors';
import { isRestoredName } from '../files';
import { toHex } from '../key';

jest.mock('../../expoSqlite', () => ({
  databaseFilePath: (name: string) => `/data/SQLite/${name}`,
}));

describe('index file names', () => {
  it('matches the index under any restored name, with its side files', () => {
    for (const name of ['securevault.db', 'securevault-17.db', 'securevault-17.db-wal']) {
      expect(INDEX_FILE.test(name)).toBe(true);
    }
    expect(INDEX_FILE.test('securevault.db.bak')).toBe(false);
    expect(MAIN_INDEX_FILE.test('securevault-17.db')).toBe(true);
    expect(MAIN_INDEX_FILE.test('securevault.db-shm')).toBe(false);
  });

  it('takes only a renamed main index for a restored one', () => {
    expect(isRestoredName('securevault-17.db')).toBe(true);
    expect(isRestoredName('securevault.db')).toBe(false);
    expect(isRestoredName('securevault-17.db-wal')).toBe(false);
  });
});

describe('toHex', () => {
  it('writes two lowercase digits per byte', () => {
    expect(toHex(new Uint8Array([0, 15, 171, 255]))).toBe('000fabff');
  });
});

describe('key errors', () => {
  it('carries a code and a cause, and reads the code of anything', () => {
    const cause = new Error('io');
    const error = keyError('DATABASE_KEY_MISSING', 'Missing.', cause);
    expect(error).toMatchObject({ message: 'Missing.', code: 'DATABASE_KEY_MISSING', cause });
    expect(errorCode(error)).toBe('DATABASE_KEY_MISSING');
    expect(errorCode('text')).toBeUndefined();
    expect(errorCode(null)).toBeUndefined();
  });
});
