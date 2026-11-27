import { Directory } from 'expo-file-system';

import { failVaultGet, getFailed, keyInvalidated, keyLocked } from '@/testing/database';
import { vaultMock } from '@/testing/vault';
import vault from '@modules/expo-vault';

import { DocumentDatabase } from '../DocumentDatabase';
import { deleteEncryptedDatabase, openEncryptedDatabase } from '../expoSqlite';

jest.mock('../expoSqlite', () => ({
  databaseFilePath: (name: string) => `/data/SQLite/${name}`,
  deleteEncryptedDatabase: jest.fn(async () => {}),
  openEncryptedDatabase: jest.fn(async () => ({ exec: jest.fn(async () => {}), close: jest.fn() })),
}));
jest.mock('../schema', () => ({ applyMigrations: jest.fn(async () => 0) }));

const openEncrypted = openEncryptedDatabase as jest.Mock;
const database = new DocumentDatabase({
  open: (name, key) => openEncryptedDatabase(name, key),
  remove: (name) => deleteEncryptedDatabase(name),
});
const allowDocumentStore = () => database.allow();
const closeDocumentStore = () => database.close();
const deleteDocumentStore = (removeEntries: () => Promise<void>) => database.erase(removeEntries);
const openDocumentStore = () => database.open();

describe('database key', () => {
  const storedKey = 'cd'.repeat(32);

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
    allowDocumentStore();
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
    failVaultGet('_database_key', error);
    const put = jest.spyOn(vault, 'put');

    await expect(openDocumentStore()).rejects.toMatchObject({ code });
    expect(put).not.toHaveBeenCalledWith('_database_key', expect.anything());
    expect(openEncrypted).not.toHaveBeenCalled();
    jest.restoreAllMocks();
    expect(await vault.get('_database_key')).toBe(storedKey);
  });

  it('keeps the stored key when reading it fails for another reason', async () => {
    await vault.put('_database_key', storedKey);
    failVaultGet('_database_key', getFailed);
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
    failVaultGet('_database_key', getFailed);
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
    failVaultGet('_database_file', getFailed);
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
    await deleteDocumentStore(async () => {
      for (const key of await vault.getAllKeys()) await vault.delete(key);
    });
    expect([...files]).toEqual([]);

    allowDocumentStore();
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
    const get = failVaultGet('_database_key', keyLocked);

    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'KEY_LOCKED' });
    get.mockRestore();
    await openDocumentStore();
    expect(openEncrypted).toHaveBeenCalledWith('securevault.db', storedKey);
  });
});
