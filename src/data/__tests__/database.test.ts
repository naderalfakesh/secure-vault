import { Directory, File } from 'expo-file-system';

import vault from '../../../modules/expo-vault';
import {
  closeDocumentStore,
  exportDatabaseFile,
  openDocumentStore,
  replaceDatabaseFile,
} from '../database';
import { openEncryptedDatabase } from '../expoSqlite';

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
