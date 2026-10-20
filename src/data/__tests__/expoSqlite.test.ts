import { openDatabaseAsync } from 'expo-sqlite';

import { openEncryptedDatabase } from '../expoSqlite';

jest.mock('expo-sqlite', () => ({
  defaultDatabaseDirectory: 'file:///data/SQLite',
  deleteDatabaseAsync: jest.fn(),
  openDatabaseAsync: jest.fn(),
}));

const KEY = 'ab'.repeat(32);

function nativeDatabase() {
  return {
    execAsync: jest.fn(async () => {}),
    runAsync: jest.fn(async () => ({ changes: 1 })),
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async () => ({ count: 0 })),
    withTransactionAsync: jest.fn(async (work: () => Promise<void>) => work()),
    closeAsync: jest.fn(async () => {}),
  };
}

const open = openDatabaseAsync as jest.Mock;

describe('expo-sqlite adapter', () => {
  let native: ReturnType<typeof nativeDatabase>;

  beforeEach(() => {
    native = nativeDatabase();
    open.mockReset().mockResolvedValue(native);
  });

  it('opens without finalizing statements on close, so FTS5 statements are not freed twice', async () => {
    await openEncryptedDatabase('securevault.db', KEY);
    expect(open).toHaveBeenCalledWith('securevault.db', {
      finalizeUnusedStatementsBeforeClosing: false,
    });
  });
});
