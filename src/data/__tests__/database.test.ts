import { Directory, File } from 'expo-file-system';

import vault from '../../../modules/expo-vault';
import {
  closeDocumentStore,
  deleteDocumentStore,
  exportDatabaseFile,
  openDocumentStore,
  replaceDatabaseFile,
} from '../database';
import { deleteEncryptedDatabase, openEncryptedDatabase } from '../expoSqlite';

jest.mock('../expoSqlite', () => ({
  databaseFilePath: (name: string) => `/data/SQLite/${name}`,
  deleteEncryptedDatabase: jest.fn(async () => {}),
  openEncryptedDatabase: jest.fn(async () => ({ exec: jest.fn(async () => {}), close: jest.fn() })),
}));
jest.mock('../schema', () => ({ applyMigrations: jest.fn(async () => 0) }));

const vaultMock = vault as unknown as { reset(): void };
const openEncrypted = openEncryptedDatabase as jest.Mock;
const keyLocked = () => Object.assign(new Error('User not authenticated'), { code: 'KEY_LOCKED' });

describe('database file handling', () => {
  beforeEach(async () => {
    vaultMock.reset();
    await vault.put('_database_key', 'ab'.repeat(32));
    await vault.put('_legacy_index_imported', 'yes');
    await closeDocumentStore();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fails a database export with KEY_LOCKED instead of copying a guessed file', async () => {
    const get = vault.get.bind(vault);
    jest
      .spyOn(vault, 'get')
      .mockImplementation((key) =>
        key === '_database_file' ? Promise.reject(keyLocked()) : get(key),
      );
    const copy = jest.spyOn(File.prototype, 'copy');

    await expect(exportDatabaseFile('/cache/backup/index.db')).rejects.toMatchObject({
      code: 'KEY_LOCKED',
    });
    expect(copy).not.toHaveBeenCalled();
  });

  it('copies the default index when no restore renamed it, and reports a failed copy', async () => {
    const copy = jest
      .spyOn(File.prototype, 'copy')
      .mockRejectedValueOnce(new Error('NoSuchFileException'));

    await expect(exportDatabaseFile('/cache/backup/index.db')).rejects.toThrow(
      'NoSuchFileException',
    );
    expect(copy).toHaveBeenCalledTimes(1);
    expect(copy.mock.contexts[0]).toMatchObject({ uri: 'file:///data/SQLite/securevault.db' });
  });

  it('points the vault at a restored index only after the move finished', async () => {
    let finishMove: () => void = () => {};
    jest.spyOn(File.prototype, 'move').mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishMove = resolve;
        }),
    );
    const put = jest.spyOn(vault, 'put');

    const replacing = replaceDatabaseFile('/cache/backup/restore/database');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(put).not.toHaveBeenCalled();

    finishMove();
    await replacing;
    expect(put).toHaveBeenCalledWith(
      '_database_file',
      expect.stringMatching(/^securevault-\d+\.db$/),
    );
  });

  it('leaves the vault pointing at the old index when the move fails', async () => {
    jest.spyOn(File.prototype, 'move').mockRejectedValueOnce(new Error('EIO'));
    const put = jest.spyOn(vault, 'put');

    await expect(replaceDatabaseFile('/cache/backup/restore/database')).rejects.toThrow('EIO');
    expect(put).not.toHaveBeenCalled();
  });

  it('makes an open during a restore wait for the restored index', async () => {
    const previous = await openDocumentStore();
    let finishMove: () => void = () => {};
    jest.spyOn(File.prototype, 'move').mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishMove = resolve;
        }),
    );
    openEncrypted.mockClear();

    const replacing = replaceDatabaseFile('/cache/backup/restore/database');
    const duringSwap = openDocumentStore();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(openEncrypted).not.toHaveBeenCalled();

    finishMove();
    await replacing;
    const restored = await duringSwap;
    expect(openEncrypted).toHaveBeenCalledTimes(1);
    expect(openEncrypted).toHaveBeenCalledWith(
      expect.stringMatching(/^securevault-\d+\.db$/),
      'ab'.repeat(32),
    );
    expect(await openDocumentStore()).toBe(restored);
    expect(restored).not.toBe(previous);
    expect(previous.db.close).not.toHaveBeenCalled();
  });

  it('keeps the restored index when an open of the old one was still in flight', async () => {
    const files = new Set(['securevault.db']);
    jest.spyOn(Object.getPrototypeOf(Directory.prototype), 'exists', 'get').mockReturnValue(true);
    jest
      .spyOn(Directory.prototype, 'list')
      .mockImplementation(() =>
        [...files].map((name) => ({ name, delete: () => files.delete(name) }) as never),
      );
    jest.spyOn(File.prototype, 'move').mockImplementation(async (target) => {
      files.add((target as File).uri.split('/').pop()!);
    });
    let finishOpen: () => void = () => {};
    openEncrypted.mockClear().mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOpen = () => resolve({ exec: jest.fn(async () => {}), close: jest.fn() });
        }),
    );

    const inFlight = openDocumentStore();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(openEncrypted).toHaveBeenCalledWith('securevault.db', 'ab'.repeat(32));
    const replacing = replaceDatabaseFile('/cache/backup/restore/database');
    await new Promise((resolve) => setTimeout(resolve, 0));
    finishOpen();
    await replacing;
    await inFlight;
    await openDocumentStore();

    const restored = await vault.get('_database_file');
    expect(openEncrypted).toHaveBeenLastCalledWith(restored, 'ab'.repeat(32));
    expect([...files]).toEqual([restored]);
  });

  it('lets the next open retry when the restored index cannot be installed', async () => {
    jest.spyOn(File.prototype, 'move').mockRejectedValueOnce(new Error('EIO'));
    openEncrypted.mockClear();

    await expect(replaceDatabaseFile('/cache/backup/restore/database')).rejects.toThrow('EIO');
    await openDocumentStore();
    expect(openEncrypted).toHaveBeenCalledWith('securevault.db', 'ab'.repeat(32));
  });
});

describe('database key', () => {
  const storedKey = 'cd'.repeat(32);
  const keyInvalidated = () =>
    Object.assign(new Error('Key permanently invalidated'), { code: 'KEY_INVALIDATED' });
  const getFailed = () => Object.assign(new Error('Input/output error'), { code: 'GET_FAILED' });

  function failGet(entry: string, error: () => Error) {
    const get = vault.get.bind(vault);
    return jest
      .spyOn(vault, 'get')
      .mockImplementation((key) => (key === entry ? Promise.reject(error()) : get(key)));
  }

  function indexFiles(names: string[]) {
    jest
      .spyOn(Object.getPrototypeOf(Directory.prototype), 'exists', 'get')
      .mockReturnValue(names.length > 0);
    jest
      .spyOn(Directory.prototype, 'list')
      .mockImplementation(() => names.map((name) => ({ name, delete: () => {} }) as never));
  }

  beforeEach(async () => {
    vaultMock.reset();
    await vault.put('_legacy_index_imported', 'yes');
    await closeDocumentStore();
    openEncrypted.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['KEY_LOCKED', keyLocked],
    ['KEY_INVALIDATED', keyInvalidated],
  ])('keeps the stored key when reading it fails with %s', async (code, error) => {
    await vault.put('_database_key', storedKey);
    failGet('_database_key', error);
    const put = jest.spyOn(vault, 'put');

    await expect(openDocumentStore()).rejects.toMatchObject({ code });
    expect(put).not.toHaveBeenCalledWith('_database_key', expect.anything());
    expect(openEncrypted).not.toHaveBeenCalled();
    jest.restoreAllMocks();
    expect(await vault.get('_database_key')).toBe(storedKey);
  });

  it('keeps the stored key when reading it fails for another reason', async () => {
    await vault.put('_database_key', storedKey);
    failGet('_database_key', getFailed);
    const put = jest.spyOn(vault, 'put');

    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'DATABASE_KEY_UNREADABLE' });
    expect(put).not.toHaveBeenCalled();
    expect(openEncrypted).not.toHaveBeenCalled();
  });

  it('keeps a stored key it cannot use instead of replacing it', async () => {
    await vault.put('_database_key', 'not a key');
    const put = jest.spyOn(vault, 'put');

    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'DATABASE_KEY_UNREADABLE' });
    expect(put).not.toHaveBeenCalled();
    expect(await vault.get('_database_key')).toBe('not a key');
  });

  it('writes no key when the vault cannot list its entries', async () => {
    jest.spyOn(vault, 'getAllKeys').mockRejectedValueOnce(new Error('EIO'));
    failGet('_database_key', getFailed);
    const put = jest.spyOn(vault, 'put');

    await expect(openDocumentStore()).rejects.toMatchObject({
      code: 'DATABASE_FILES_UNREADABLE',
      message: expect.stringMatching(/^The vault's files could not be read/),
    });
    expect(put).not.toHaveBeenCalled();
  });

  it('creates a key on first run, when there is neither a key nor an index', async () => {
    indexFiles([]);

    await openDocumentStore();
    const created = await vault.get('_database_key');
    expect(created).toMatch(/^[0-9a-f]{64}$/);
    expect(openEncrypted).toHaveBeenCalledWith('securevault.db', created);
  });

  it('refuses to create a key for an index that already exists', async () => {
    indexFiles(['securevault.db']);
    const put = jest.spyOn(vault, 'put');

    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'DATABASE_KEY_MISSING' });
    expect(put).not.toHaveBeenCalled();
    expect(openEncrypted).not.toHaveBeenCalled();
  });

  it('checks the restored index file, not the default one, before creating a key', async () => {
    await vault.put('_database_file', 'securevault-1700000000000.db');
    indexFiles(['securevault-1700000000000.db']);

    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'DATABASE_KEY_MISSING' });
  });

  it('refuses to create a key while a restored index exists under another name', async () => {
    // `_database_file` could not be read, so its name is unknown.
    await vault.put('_database_file', 'securevault-1700000000000.db');
    failGet('_database_file', getFailed);
    indexFiles(['securevault-1700000000000.db', 'securevault-1700000000000.db-wal']);
    const put = jest.spyOn(vault, 'put');

    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'DATABASE_NAME_UNREADABLE' });
    expect(put).not.toHaveBeenCalled();
    expect(openEncrypted).not.toHaveBeenCalled();
  });

  it('creates a key next to files that are not an index', async () => {
    indexFiles(['other.db', 'securevault.db.bak']);

    await openDocumentStore();
    expect(await vault.get('_database_key')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('writes no key when the index folder cannot be listed', async () => {
    jest.spyOn(Object.getPrototypeOf(Directory.prototype), 'exists', 'get').mockReturnValue(true);
    jest.spyOn(Directory.prototype, 'list').mockImplementation(() => {
      throw new Error('EACCES');
    });
    const put = jest.spyOn(vault, 'put');

    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'DATABASE_FILES_UNREADABLE' });
    expect(put).not.toHaveBeenCalled();
  });

  it('creates a key when only side files of a removed index are left', async () => {
    indexFiles([
      'securevault.db-wal',
      'securevault.db-shm',
      'securevault-1700000000000.db-journal',
    ]);

    await openDocumentStore();
    expect(await vault.get('_database_key')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('lets "Delete everything" clear a missing key, side files included', async () => {
    const files = new Set([
      'securevault.db',
      'securevault.db-wal',
      'securevault.db-shm',
      'securevault-1700000000000.db',
    ]);
    jest
      .spyOn(Object.getPrototypeOf(Directory.prototype), 'exists', 'get')
      .mockImplementation(() => true);
    jest
      .spyOn(Directory.prototype, 'list')
      .mockImplementation(() =>
        [...files].map((name) => ({ name, delete: () => files.delete(name) }) as never),
      );
    // Like expo-sqlite, the delete removes the main file only.
    (deleteEncryptedDatabase as jest.Mock).mockImplementationOnce(async (name: string) => {
      files.delete(name);
    });

    // A restored index without a stored name keeps the open closed first.
    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'DATABASE_NAME_UNREADABLE' });
    await deleteDocumentStore(async () => {});
    expect([...files]).toEqual([]);

    await openDocumentStore();
    const created = await vault.get('_database_key');
    expect(created).toMatch(/^[0-9a-f]{64}$/);
    expect(openEncrypted).toHaveBeenCalledWith('securevault.db', created);
  });

  it('opens an existing index with its stored key and leaves the key alone', async () => {
    await vault.put('_database_key', storedKey);
    indexFiles(['securevault.db']);
    const put = jest.spyOn(vault, 'put');

    await openDocumentStore();
    expect(openEncrypted).toHaveBeenCalledWith('securevault.db', storedKey);
    expect(put).not.toHaveBeenCalledWith('_database_key', expect.anything());
  });

  it('opens with the stored key once a locked key is unlocked again', async () => {
    await vault.put('_database_key', storedKey);
    const get = failGet('_database_key', keyLocked);

    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'KEY_LOCKED' });
    get.mockRestore();
    await openDocumentStore();
    expect(openEncrypted).toHaveBeenCalledWith('securevault.db', storedKey);
  });
});

describe('index name, erase and legacy import', () => {
  const restored = 'securevault-1700000000000.db';
  const getFailed = () => Object.assign(new Error('Input/output error'), { code: 'GET_FAILED' });
  const keyInvalidated = () =>
    Object.assign(new Error('Key permanently invalidated'), { code: 'KEY_INVALIDATED' });
  let files: Set<string>;

  async function removeEntries() {
    for (const key of await vault.getAllKeys()) await vault.delete(key);
  }

  function failGet(entry: string, error: () => Error) {
    const get = vault.get.bind(vault);
    return jest
      .spyOn(vault, 'get')
      .mockImplementation((key) => (key === entry ? Promise.reject(error()) : get(key)));
  }

  beforeEach(async () => {
    vaultMock.reset();
    await vault.put('_database_key', 'ab'.repeat(32));
    await vault.put('_legacy_index_imported', 'yes');
    await closeDocumentStore();
    openEncrypted.mockClear();
    files = new Set();
    jest
      .spyOn(Object.getPrototypeOf(Directory.prototype), 'exists', 'get')
      .mockImplementation(() => true);
    jest
      .spyOn(Directory.prototype, 'list')
      .mockImplementation(() =>
        [...files].map((name) => ({ name, delete: () => files.delete(name) }) as never),
      );
    (deleteEncryptedDatabase as jest.Mock).mockImplementation(async (name: string) => {
      files.delete(name);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    (deleteEncryptedDatabase as jest.Mock).mockReset();
  });

  it('keeps a restored index closed when its name cannot be read', async () => {
    await vault.put('_database_file', restored);
    failGet('_database_file', getFailed);
    files = new Set([restored, `${restored}-wal`, 'securevault.db']);

    await expect(openDocumentStore()).rejects.toMatchObject({
      code: 'DATABASE_NAME_UNREADABLE',
      message: expect.stringMatching(/^The document index could not be found/),
    });
    expect(openEncrypted).not.toHaveBeenCalled();
    expect([...files]).toEqual([restored, `${restored}-wal`, 'securevault.db']);
  });

  it('keeps a restored index closed when the stored name is not an index name', async () => {
    await vault.put('_database_file', '../elsewhere.db');
    files = new Set([restored]);

    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'DATABASE_NAME_UNREADABLE' });
    expect(openEncrypted).not.toHaveBeenCalled();
    expect([...files]).toEqual([restored]);
  });

  it('reports an invalidated key when the name of a restored index cannot be read', async () => {
    await vault.put('_database_file', restored);
    failGet('_database_file', keyInvalidated);
    files = new Set([restored]);

    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'KEY_INVALIDATED' });
    expect([...files]).toEqual([restored]);
  });

  it('keeps the index closed when the name is unreadable and the folder cannot be listed', async () => {
    await vault.put('_database_file', restored);
    failGet('_database_file', getFailed);
    jest.spyOn(Directory.prototype, 'list').mockImplementation(() => {
      throw new Error('EACCES');
    });

    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'DATABASE_FILES_UNREADABLE' });
    expect(openEncrypted).not.toHaveBeenCalled();
  });

  it('opens the default index without sweeping when an unreadable name leaves no other index', async () => {
    await vault.put('_database_file', 'securevault.db');
    failGet('_database_file', getFailed);
    files = new Set(['securevault.db', `${restored}-wal`]);

    await openDocumentStore();
    expect(openEncrypted).toHaveBeenCalledWith('securevault.db', 'ab'.repeat(32));
    expect([...files]).toEqual(['securevault.db', `${restored}-wal`]);
  });

  it('still opens the default index and sweeps leftovers when the vault was never restored', async () => {
    files = new Set(['securevault.db', `${restored}-wal`]);

    await openDocumentStore();
    expect(openEncrypted).toHaveBeenCalledWith('securevault.db', 'ab'.repeat(32));
    expect([...files]).toEqual(['securevault.db']);
  });

  it('keeps a restored index closed when no name was ever stored for it', async () => {
    // A first restore moved the file, then failed to record its name.
    files = new Set(['securevault.db', restored]);

    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'DATABASE_NAME_UNREADABLE' });
    expect(openEncrypted).not.toHaveBeenCalled();
    expect([...files]).toEqual(['securevault.db', restored]);
  });

  it('keeps a restored index closed when the stored name points at a missing file', async () => {
    // A backup of a restored vault brings that vault's name along.
    await vault.put('_database_file', 'securevault-1600000000000.db');
    files = new Set([restored]);

    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'DATABASE_NAME_UNREADABLE' });
    expect(openEncrypted).not.toHaveBeenCalled();
    expect([...files]).toEqual([restored]);
  });

  it('creates the named index when no index file exists yet', async () => {
    await vault.put('_database_file', restored);

    await openDocumentStore();
    expect(openEncrypted).toHaveBeenCalledWith(restored, 'ab'.repeat(32));
  });

  it('moves a restored index back when its name cannot be recorded', async () => {
    files = new Set(['securevault.db']);
    const moves: string[][] = [];
    jest.spyOn(File.prototype, 'move').mockImplementation(async function (this: File, target) {
      const from = this.uri.split('/').pop()!;
      const to = (target as File).uri.split('/').pop()!;
      moves.push([this.uri, (target as File).uri]);
      files.delete(from);
      if ((target as File).uri.includes('/data/SQLite/')) files.add(to);
    });
    const put = vault.put.bind(vault);
    jest
      .spyOn(vault, 'put')
      .mockImplementation((key, value) =>
        key === '_database_file' ? Promise.reject(keyLocked()) : put(key, value),
      );

    await expect(replaceDatabaseFile('/cache/backup/restore/database')).rejects.toMatchObject({
      code: 'KEY_LOCKED',
    });
    expect(moves).toHaveLength(2);
    expect(moves[1]).toEqual([moves[0][1], moves[0][0]]);
    expect([...files]).toEqual(['securevault.db']);
  });

  it('lets "Delete everything" remove a restored index whose name cannot be read', async () => {
    await vault.put('_database_file', restored);
    failGet('_database_file', getFailed);
    files = new Set([restored, `${restored}-wal`, 'securevault.db']);

    await deleteDocumentStore(removeEntries);
    expect([...files]).toEqual([]);
    await openDocumentStore();
  });

  it('turns away an open while "Delete everything" removes the index files', async () => {
    files = new Set(['securevault.db', 'securevault.db-wal']);
    let finishDelete: () => void = () => {};
    (deleteEncryptedDatabase as jest.Mock).mockImplementationOnce(
      (name: string) =>
        new Promise<void>((resolve) => {
          finishDelete = () => {
            files.delete(name);
            resolve();
          };
        }),
    );

    const erasing = deleteDocumentStore(removeEntries);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'INDEX_ERASING' });
    expect(openEncrypted).not.toHaveBeenCalled();

    finishDelete();
    await erasing;
    expect([...files]).toEqual([]);
    await openDocumentStore();
  });

  it('turns away an open until the erase also removed the index entries', async () => {
    files = new Set(['securevault.db']);
    let finishEntries: () => void = () => {};
    const erasing = deleteDocumentStore(
      () =>
        new Promise<void>((resolve) => {
          finishEntries = () => void removeEntries().then(resolve);
        }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    // The old key is still listed until the erase deletes the vault entries.
    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'INDEX_ERASING' });
    expect(openEncrypted).not.toHaveBeenCalled();
    expect([...files]).toEqual([]);

    finishEntries();
    await erasing;
    await openDocumentStore();
    const created = await vault.get('_database_key');
    expect(created).toMatch(/^[0-9a-f]{64}$/);
    expect(openEncrypted).toHaveBeenCalledWith('securevault.db', created);
  });

  it('reports an erase that left the index entries behind and lets it be retried', async () => {
    files = new Set(['securevault.db']);

    // Each entry delete failed and was swallowed.
    await expect(deleteDocumentStore(async () => {})).rejects.toMatchObject({
      code: 'ERASE_INCOMPLETE',
      message: expect.stringMatching(/^"Delete everything" did not finish/),
    });
    await expect(openDocumentStore()).resolves.toBeDefined();
    await closeDocumentStore();

    await deleteDocumentStore(removeEntries);
    expect(await vault.getAllKeys()).toEqual([]);
  });

  it('clears the gate when removing the entries fails', async () => {
    files = new Set(['securevault.db']);

    await expect(
      deleteDocumentStore(async () => {
        throw new Error('EIO');
      }),
    ).rejects.toThrow('EIO');
    await expect(openDocumentStore()).resolves.toBeDefined();
  });

  it('does not hold opens back after an erase that could not start', async () => {
    await vault.put('_database_file', restored);
    files = new Set([restored]);
    const get = failGet('_database_file', keyLocked);

    await expect(deleteDocumentStore(async () => {})).rejects.toMatchObject({ code: 'KEY_LOCKED' });
    expect([...files]).toEqual([restored]);
    get.mockRestore();
    await openDocumentStore();
    expect(openEncrypted).toHaveBeenCalledWith(restored, 'ab'.repeat(32));
  });

  it('deletes nothing while the index fails to close, and erases once it closes', async () => {
    files = new Set(['securevault.db', 'securevault.db-wal']);
    const close = jest
      .fn()
      .mockRejectedValue(new Error('unable to close due to unfinalized statements'));
    openEncrypted.mockResolvedValueOnce({ exec: jest.fn(async () => {}), close });
    await openDocumentStore();

    await expect(deleteDocumentStore(removeEntries)).rejects.toMatchObject({
      code: 'ERASE_INCOMPLETE',
      message: expect.stringMatching(/^"Delete everything" did not finish/),
    });
    expect(deleteEncryptedDatabase).not.toHaveBeenCalled();
    expect([...files]).toEqual(['securevault.db', 'securevault.db-wal']);
    expect(await vault.getAllKeys()).toContain('_database_key');
    await expect(openDocumentStore()).resolves.toBeDefined();

    // The connection that stayed open is tried again, not forgotten.
    await expect(deleteDocumentStore(removeEntries)).rejects.toMatchObject({
      code: 'ERASE_INCOMPLETE',
    });
    expect(close).toHaveBeenCalledTimes(2);
    expect([...files]).toEqual(['securevault.db', 'securevault.db-wal']);

    close.mockResolvedValue(undefined);
    await deleteDocumentStore(removeEntries);
    expect([...files]).toEqual([]);
    expect(await vault.getAllKeys()).toEqual([]);
  });

  it('closes the connection a restore replaced before erasing its files', async () => {
    files = new Set(['securevault.db']);
    const replacedClose = jest.fn(async () => {});
    openEncrypted.mockResolvedValueOnce({ exec: jest.fn(async () => {}), close: replacedClose });
    await openDocumentStore();
    jest.spyOn(File.prototype, 'move').mockImplementation(async function (this: File, target) {
      files.add((target as File).uri.split('/').pop()!);
    });

    await replaceDatabaseFile('/cache/backup/restore/database');
    await openDocumentStore();
    expect(replacedClose).not.toHaveBeenCalled();

    await deleteDocumentStore(removeEntries);
    expect(replacedClose).toHaveBeenCalledTimes(1);
    expect([...files]).toEqual([]);
  });

  it('reports a locked key while checking the legacy import instead of skipping it', async () => {
    vaultMock.reset();
    await vault.put('_database_key', 'ab'.repeat(32));
    await vault.put('_legacy_index_imported', 'yes');
    failGet('_legacy_index_imported', keyLocked);
    const put = jest.spyOn(vault, 'put');

    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'KEY_LOCKED' });
    expect(openEncrypted).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it('reports a locked key while reading the legacy index', async () => {
    await vault.delete('_legacy_index_imported');
    await vault.put('_documents_metadata', JSON.stringify({ documents: {} }));
    failGet('_documents_metadata', keyLocked);
    const put = jest.spyOn(vault, 'put');

    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'KEY_LOCKED' });
    expect(put).not.toHaveBeenCalled();
  });
});
