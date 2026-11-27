import { Directory, File } from 'expo-file-system';

import { failVaultGet, getFailed, keyInvalidated, keyLocked } from '@/testing/database';
import { at } from '@/testing/lists';
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
const openDocumentStore = () => database.open();
const replaceDatabaseFile = (sourcePath: string) => database.replaceWith(sourcePath);

describe('index name and legacy import', () => {
  const restored = 'securevault-1700000000000.db';
  let files: Set<string>;

  beforeEach(async () => {
    vaultMock.reset();
    await vault.put('_database_key', 'ab'.repeat(32));
    await vault.put('_legacy_index_imported', 'yes');
    await closeDocumentStore();
    allowDocumentStore();
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps a restored index closed when its name cannot be read', async () => {
    await vault.put('_database_file', restored);
    failVaultGet('_database_file', getFailed);
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
    failVaultGet('_database_file', keyInvalidated);
    files = new Set([restored]);

    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'KEY_INVALIDATED' });
    expect([...files]).toEqual([restored]);
  });

  it('keeps the index closed when the name is unreadable and the folder cannot be listed', async () => {
    await vault.put('_database_file', restored);
    failVaultGet('_database_file', getFailed);
    jest.spyOn(Directory.prototype, 'list').mockImplementation(() => {
      throw new Error('EACCES');
    });

    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'DATABASE_FILES_UNREADABLE' });
    expect(openEncrypted).not.toHaveBeenCalled();
  });

  it('opens the default index without sweeping when an unreadable name leaves no other index', async () => {
    await vault.put('_database_file', 'securevault.db');
    failVaultGet('_database_file', getFailed);
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
    expect(at(moves, 1)).toEqual([at(at(moves, 0), 1), at(at(moves, 0), 0)]);
    expect([...files]).toEqual(['securevault.db']);
  });

  it('reports a locked key while checking the legacy import instead of skipping it', async () => {
    vaultMock.reset();
    await vault.put('_database_key', 'ab'.repeat(32));
    await vault.put('_legacy_index_imported', 'yes');
    failVaultGet('_legacy_index_imported', keyLocked);
    const put = jest.spyOn(vault, 'put');

    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'KEY_LOCKED' });
    expect(openEncrypted).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it('reports a locked key while reading the legacy index', async () => {
    await vault.delete('_legacy_index_imported');
    await vault.put('_documents_metadata', JSON.stringify({ documents: {} }));
    failVaultGet('_documents_metadata', keyLocked);
    const put = jest.spyOn(vault, 'put');

    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'KEY_LOCKED' });
    expect(put).not.toHaveBeenCalled();
  });
});
