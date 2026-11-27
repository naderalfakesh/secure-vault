import { Directory, File } from 'expo-file-system';

import { failVaultGet, getFailed, keyInvalidated, keyLocked } from '@/testing/database';
import { vaultMock } from '@/testing/vault';
import vault from '@modules/expo-vault';

import { DocumentDatabase } from '../DocumentDatabase';
import { deleteEncryptedDatabase, openEncryptedDatabase } from '../expoSqlite';
import { applyMigrations } from '../schema';

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
const exportDatabaseFile = (destPath: string) => database.exportTo(destPath);
const openDocumentStore = () => database.open();
const replaceDatabaseFile = (sourcePath: string) => database.replaceWith(sourcePath);

describe('database erase and connection cleanup', () => {
  const restored = 'securevault-1700000000000.db';
  let files: Set<string>;

  async function removeEntries() {
    for (const key of await vault.getAllKeys()) await vault.delete(key);
  }

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
    (deleteEncryptedDatabase as jest.Mock).mockImplementation(async (name: string) => {
      files.delete(name);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    (deleteEncryptedDatabase as jest.Mock).mockReset();
  });

  it('lets "Delete everything" remove a restored index whose name cannot be read', async () => {
    await vault.put('_database_file', restored);
    failVaultGet('_database_file', getFailed);
    files = new Set([restored, `${restored}-wal`, 'securevault.db']);

    await deleteDocumentStore(removeEntries);
    expect([...files]).toEqual([]);
    allowDocumentStore();
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
    allowDocumentStore();
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
    allowDocumentStore();
    await openDocumentStore();
    const created = await vault.get('_database_key');
    expect(created).toMatch(/^[0-9a-f]{64}$/);
    expect(openEncrypted).toHaveBeenCalledWith('securevault.db', created);
  });

  it('keeps the index closed after "Delete everything", writing no key or file, until setup allows it', async () => {
    files = new Set(['securevault.db', 'securevault.db-wal']);
    await openDocumentStore();
    await deleteDocumentStore(removeEntries);
    openEncrypted.mockClear();
    const put = jest.spyOn(vault, 'put');
    const get = jest.spyOn(vault, 'get');

    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'VAULT_EMPTIED' });
    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'VAULT_EMPTIED' });
    await expect(exportDatabaseFile('/cache/backup/index.db')).rejects.toMatchObject({
      code: 'VAULT_EMPTIED',
    });
    expect(openEncrypted).not.toHaveBeenCalled();
    // Nothing that could need the device key, so no credential prompt either.
    expect(put).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
    expect(await vault.getAllKeys()).toEqual([]);
    expect([...files]).toEqual([]);

    allowDocumentStore();
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

  // The Delete everything toast describes KEY_LOCKED and KEY_INVALIDATED as
  // "nothing was changed", which holds only while the key is never used once
  // anything has been removed.
  it('uses the device key only before the first removal of an erase', async () => {
    await vault.put('_database_file', restored);
    files = new Set([restored, `${restored}-wal`]);
    const calls: string[] = [];
    for (const name of ['get', 'put', 'getFile', 'putFile', 'delete', 'deleteFile'] as const) {
      const original = (vault[name] as (...args: unknown[]) => Promise<unknown>).bind(vault);
      jest.spyOn(vault, name).mockImplementation(((...args: unknown[]) => {
        calls.push(name);
        return original(...args);
      }) as never);
    }
    (deleteEncryptedDatabase as jest.Mock).mockImplementation(async (name: string) => {
      calls.push('deleteEncryptedDatabase');
      files.delete(name);
    });

    await deleteDocumentStore(async () => {
      for (const key of await vault.getAllKeys()) {
        await vault.delete(key).catch(() => {});
        await vault.deleteFile(key).catch(() => {});
      }
    });

    const firstRemoval = calls.findIndex((name) => name.startsWith('delete'));
    expect(calls[firstRemoval]).toBe('deleteEncryptedDatabase');
    expect(calls.slice(0, firstRemoval)).toContain('get');
    expect(
      calls
        .slice(firstRemoval)
        .filter((name) => ['get', 'put', 'getFile', 'putFile'].includes(name)),
    ).toEqual([]);
    expect(await vault.getAllKeys()).toEqual([]);
  });

  it('finishes an erase whose index name read found the key invalidated', async () => {
    await vault.put('_database_file', 'securevault.db');
    files = new Set(['securevault.db']);
    failVaultGet('_database_file', keyInvalidated);

    await expect(deleteDocumentStore(removeEntries)).resolves.toBeUndefined();
    expect([...files]).toEqual([]);
    expect(await vault.getAllKeys()).toEqual([]);
  });

  it('does not hold opens back after an erase that could not start', async () => {
    await vault.put('_database_file', restored);
    files = new Set([restored]);
    const get = failVaultGet('_database_file', keyLocked);

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

  it('closes a connection whose setup failed after it opened, and keeps it for the erase when it stays open', async () => {
    files = new Set(['securevault.db']);
    const close = jest.fn(async () => {});
    openEncrypted.mockResolvedValueOnce({ exec: jest.fn(async () => {}), close });
    (applyMigrations as jest.Mock).mockRejectedValueOnce(keyLocked());

    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'KEY_LOCKED' });
    expect(close).toHaveBeenCalledTimes(1);

    const stuck = jest.fn().mockRejectedValue(new Error('database is locked'));
    openEncrypted.mockResolvedValueOnce({ exec: jest.fn(async () => {}), close: stuck });
    (applyMigrations as jest.Mock).mockRejectedValueOnce(keyLocked());
    await expect(openDocumentStore()).rejects.toMatchObject({ code: 'KEY_LOCKED' });

    await expect(deleteDocumentStore(removeEntries)).rejects.toMatchObject({
      code: 'ERASE_INCOMPLETE',
    });
    expect([...files]).toEqual(['securevault.db']);
    stuck.mockResolvedValue(undefined);
    await deleteDocumentStore(removeEntries);
    expect([...files]).toEqual([]);
  });

  it('closes a connection whose setup failed and stayed open before the next open retries', async () => {
    files = new Set(['securevault.db']);
    const stuck = jest.fn().mockRejectedValueOnce(new Error('database is locked'));
    openEncrypted.mockResolvedValueOnce({ exec: jest.fn(async () => {}), close: stuck });
    (applyMigrations as jest.Mock).mockRejectedValueOnce(new Error('disk I/O error'));
    await expect(openDocumentStore()).rejects.toThrow('disk I/O error');
    expect(stuck).toHaveBeenCalledTimes(1);

    // "Try again": the stuck connection is released first, so the retry opens afresh.
    stuck.mockResolvedValue(undefined);
    let closedBeforeOpen = false;
    openEncrypted.mockImplementationOnce(async () => {
      closedBeforeOpen = stuck.mock.calls.length === 2;
      return { exec: jest.fn(async () => {}), close: jest.fn() };
    });
    await expect(openDocumentStore()).resolves.toBeDefined();
    expect(closedBeforeOpen).toBe(true);
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
});
