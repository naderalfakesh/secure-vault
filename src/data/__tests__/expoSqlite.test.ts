import { openDatabaseAsync } from 'expo-sqlite';

import { openEncryptedDatabase } from '../expoSqlite';

jest.mock('expo-sqlite', () => ({
  defaultDatabaseDirectory: 'file:///data/SQLite',
  deleteDatabaseAsync: jest.fn(),
  openDatabaseAsync: jest.fn(),
}));

const KEY = 'ab'.repeat(32);

type Deferred = { promise: Promise<void>; resolve: () => void };

function deferred(): Deferred {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function nativeDatabase() {
  return {
    execAsync: jest.fn(async (_sql: string) => {}),
    runAsync: jest.fn(async () => ({ changes: 1 })),
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async (sql: string): Promise<Record<string, unknown> | null> =>
      sql === 'PRAGMA cipher_version' ? { cipher_version: '4.6.1 community' } : { count: 0 },
    ),
    withTransactionAsync: jest.fn(async (work: () => Promise<void>) => work()),
    closeAsync: jest.fn(async () => {}),
  };
}

const open = openDatabaseAsync as jest.Mock;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('expo-sqlite adapter', () => {
  let native: ReturnType<typeof nativeDatabase>;

  beforeEach(() => {
    native = nativeDatabase();
    open.mockReset().mockResolvedValue(native);
  });

  it('opens with the default options, which finalize only expo-sqlite statements on close', async () => {
    await openEncryptedDatabase('securevault.db', KEY);
    expect(open).toHaveBeenCalledWith('securevault.db');
  });

  it('checks that SQLCipher is linked before anything is written', async () => {
    await openEncryptedDatabase('securevault.db', KEY);
    expect(native.getFirstAsync).toHaveBeenCalledWith('PRAGMA cipher_version');
    const statements = native.execAsync.mock.calls.map(([sql]) => sql);
    expect(statements[0]).toMatch(/^PRAGMA key/);
    // The cipher check comes before the journal mode is set or any table is read.
    expect(native.getFirstAsync.mock.calls[0]).toEqual(['PRAGMA cipher_version']);
    expect(native.execAsync.mock.invocationCallOrder[1]).toBeGreaterThan(
      native.getFirstAsync.mock.invocationCallOrder[0],
    );
  });

  it('fails closed with a typed error when SQLite has no SQLCipher', async () => {
    // Plain SQLite ignores PRAGMA key and returns no cipher_version row.
    native.getFirstAsync.mockResolvedValueOnce(null);

    await expect(openEncryptedDatabase('securevault.db', KEY)).rejects.toMatchObject({
      code: 'SQLCIPHER_UNAVAILABLE',
    });
    expect(native.execAsync).toHaveBeenCalledTimes(1);
    expect(native.closeAsync).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the cipher version is empty', async () => {
    native.getFirstAsync.mockResolvedValueOnce({ cipher_version: '' });

    await expect(openEncryptedDatabase('securevault.db', KEY)).rejects.toMatchObject({
      code: 'SQLCIPHER_UNAVAILABLE',
    });
  });

  it('closes the native connection when the key does not open the file', async () => {
    native.getFirstAsync.mockRejectedValueOnce(new Error('file is not a database'));

    await expect(openEncryptedDatabase('securevault.db', KEY)).rejects.toThrow(
      'file is not a database',
    );
    expect(native.closeAsync).toHaveBeenCalledTimes(1);
  });

  it('waits for calls in flight before closing and turns new calls away', async () => {
    const db = await openEncryptedDatabase('securevault.db', KEY);
    const query = deferred();
    native.getAllAsync.mockImplementationOnce(() => query.promise.then(() => []));

    const searching = db.all("SELECT id FROM documents_fts WHERE documents_fts MATCH 'a*'");
    const closing = db.close();
    await flush();
    expect(native.closeAsync).not.toHaveBeenCalled();
    await expect(db.first('SELECT 1')).rejects.toMatchObject({ code: 'INDEX_CLOSED' });

    query.resolve();
    await expect(searching).resolves.toEqual([]);
    await closing;
    expect(native.closeAsync).toHaveBeenCalledTimes(1);
    await expect(db.run('DELETE FROM documents')).rejects.toMatchObject({ code: 'INDEX_CLOSED' });
  });

  it('lets a running transaction finish before closing', async () => {
    const db = await openEncryptedDatabase('securevault.db', KEY);
    const step = deferred();

    const writing = db.transaction(async () => {
      await step.promise;
      return db.run('INSERT INTO documents DEFAULT VALUES');
    });
    const closing = db.close();
    await flush();
    step.resolve();

    await expect(writing).resolves.toEqual({ changes: 1 });
    await closing;
    expect(native.runAsync).toHaveBeenCalledTimes(1);
    expect(native.closeAsync).toHaveBeenCalledTimes(1);
  });

  it('reports a failed close every time without closing the connection again', async () => {
    const db = await openEncryptedDatabase('securevault.db', KEY);
    native.closeAsync.mockRejectedValueOnce(new Error('database is locked'));

    await expect(db.close()).rejects.toThrow('database is locked');
    await expect(db.close()).rejects.toThrow('database is locked');
    expect(native.closeAsync).toHaveBeenCalledTimes(1);
  });
});
