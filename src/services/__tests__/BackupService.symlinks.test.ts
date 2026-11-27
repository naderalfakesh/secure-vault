import { Directory, File, Paths } from 'expo-file-system';

import { documentDatabase } from '@/data/database';
import { createBackup } from '@/testing/backup';
import { vaultMock } from '@/testing/vault';
import vault from '@modules/expo-vault';
import { followLinksOnDelete } from '@modules/expo-vault/src/ExpoVaultModule.mock';

import {
  BACKUP_DIRECTORY,
  BACKUP_STAGING_DIRECTORY,
  backupService,
  describeBackupError,
  RESTORE_STAGING_DIRECTORY,
} from '../BackupService';
import { documentService, PICKER_DIRECTORY } from '../DocumentService';

describe('BackupService symlink safety', () => {
  const sentinel = () => new Directory(Paths.document, 'sentinel');
  const toPath = (directory: Directory) =>
    decodeURIComponent(directory.uri.slice('file://'.length));
  let follow: jest.SpyInstance;

  // A link at `name` in the cache pointing at a folder of the user's own files.
  const plantLinkedFolder = (name: string) => {
    const target = sentinel();
    if (!target.exists) target.create({ intermediates: true });
    const kept = new File(target, 'keep.txt');
    kept.writeSync('not ours');
    const link = new Directory(Paths.cache, name);
    vaultMock.plantLink(toPath(link), toPath(target));
    return { link, kept };
  };

  beforeEach(async () => {
    vaultMock.reset();
    await documentDatabase.close();
    follow = followLinksOnDelete();
  });

  afterEach(() => {
    follow.mockRestore();
    jest.restoreAllMocks();
    if (sentinel().exists) sentinel().delete();
  });

  it.each([BACKUP_DIRECTORY, PICKER_DIRECTORY, RESTORE_STAGING_DIRECTORY])(
    'unlinks %s at lock and launch without emptying its target',
    (name) => {
      const { link, kept } = plantLinkedFolder(name);

      backupService.sweepCache();

      expect(kept.exists).toBe(true);
      expect(vaultMock.linkTarget(toPath(link))).toBeNull();
      expect(link.exists).toBe(false);
    },
  );

  it('unlinks backup-staging in the cache sweep without emptying its target', async () => {
    const { link, kept } = plantLinkedFolder(BACKUP_STAGING_DIRECTORY);

    await documentService.clearCache();

    expect(kept.exists).toBe(true);
    expect(vaultMock.linkTarget(toPath(link))).toBeNull();
  });

  it('unlinks a linked staging folder before an export or a restore stages into it', async () => {
    await vault.put('_database_key', 'ab'.repeat(32));
    const exportLink = plantLinkedFolder(BACKUP_STAGING_DIRECTORY);
    const backup = await createBackup('correct horse battery');
    expect(exportLink.kept.exists).toBe(true);

    const restoreLink = plantLinkedFolder(RESTORE_STAGING_DIRECTORY);
    const extras = toPath(new Directory(new Directory(Paths.cache, BACKUP_DIRECTORY), 'restore'));
    vaultMock.plantLink(extras, toPath(sentinel()));
    await backupService.restoreBackup(backup.uri, 'correct horse battery');

    expect(restoreLink.kept.exists).toBe(true);
    expect(vaultMock.linkTarget(toPath(restoreLink.link))).toBeNull();
    expect(vaultMock.linkTarget(extras)).toBeNull();
  });

  it('unlinks a linked backup folder before an export writes its index copy or container', async () => {
    await vault.put('_database_key', 'ab'.repeat(32));
    const { link, kept } = plantLinkedFolder(BACKUP_DIRECTORY);
    let linkedWhenWritten: string | null = 'not called';
    const exportBackup = vault.exportBackup.bind(vault);
    jest.spyOn(vault, 'exportBackup').mockImplementation((...args) => {
      linkedWhenWritten = vaultMock.linkTarget(toPath(link));
      return exportBackup(...args);
    });

    const backup = await createBackup('correct horse battery');

    expect(linkedWhenWritten).toBeNull();
    expect(kept.exists).toBe(true);
    backupService.discardBackup(backup.uri);
  });

  it('refuses an export with a typed error when the backup folder cannot be cleared', async () => {
    await vault.put('_database_key', 'ab'.repeat(32));
    const backupFolder = toPath(new Directory(Paths.cache, BACKUP_DIRECTORY));
    const remove = vault.removeTreeNoFollow.bind(vault);
    jest.spyOn(vault, 'removeTreeNoFollow').mockImplementation((path) => {
      if (path.replace(/\/$/, '') === backupFolder.replace(/\/$/, '')) {
        throw Object.assign(new Error("removeTreeNoFollow: not inside the app's cache"), {
          code: 'ERR_UNEXPECTED',
        });
      }
      return remove(path);
    });
    const exportBackup = jest.spyOn(vault, 'exportBackup');

    await expect(createBackup('correct horse battery')).rejects.toMatchObject({
      code: 'BACKUP_STAGING_INVALID',
    });
    expect(exportBackup).not.toHaveBeenCalled();
  });

  it('fails a restore whose extras folder cannot be cleared with a typed error and a plain sentence', async () => {
    await vault.put('_database_key', 'ab'.repeat(32));
    const backup = await createBackup('correct horse battery');
    const extras = toPath(new Directory(new Directory(Paths.cache, BACKUP_DIRECTORY), 'restore'));
    const remove = vault.removeTreeNoFollow.bind(vault);
    jest.spyOn(vault, 'removeTreeNoFollow').mockImplementation((path) => {
      if (path.replace(/\/$/, '') === extras.replace(/\/$/, '')) {
        throw Object.assign(new Error(`removeTreeNoFollow ${extras}: not inside the app's cache`), {
          code: 'ERR_UNEXPECTED',
        });
      }
      return remove(path);
    });
    const importBackup = jest.spyOn(vault, 'importBackup');

    const failure = await backupService
      .restoreBackup(backup.uri, 'correct horse battery')
      .catch((error: unknown) => error);

    expect(failure).toMatchObject({ code: 'BACKUP_RESTORE_STAGING_INVALID' });
    expect(describeBackupError(failure)).toMatch(/nothing was changed/);
    expect(describeBackupError(failure)).not.toMatch(/removeTreeNoFollow|cache/);
    expect(importBackup).not.toHaveBeenCalled();
    backupService.discardBackup(backup.uri);
  });
});
