import { Directory, File, Paths } from 'expo-file-system';

import { documentDatabase } from '@/data/database';
import { createBackup } from '@/testing/backup';
import { at } from '@/testing/lists';
import { vaultMock } from '@/testing/vault';
import vault from '@modules/expo-vault';
import { followLinksOnDelete } from '@modules/expo-vault/src/ExpoVaultModule.mock';
import { withKeyRecovery } from '@modules/expo-vault/src/withKeyRecovery';

import {
  BACKUP_DIRECTORY,
  BACKUP_STAGING_DIRECTORY,
  backupService,
  describeBackupError,
  RESTORE_SOURCE_DIRECTORY,
  RESTORE_STAGING_DIRECTORY,
} from '../BackupService';
import { documentService, PICKER_DIRECTORY } from '../DocumentService';

describe('BackupService', () => {
  beforeEach(async () => {
    vaultMock.reset();
    await documentDatabase.close();
  });

  describe('picked backup kept out of the purgeable cache (M2)', () => {
    const pickerFolder = () => new Directory(Paths.cache, PICKER_DIRECTORY);
    const source = () => new Directory(Paths.document, RESTORE_SOURCE_DIRECTORY);
    const pathOf = (uri: string) => decodeURIComponent(uri.slice('file://'.length));

    const pickCopy = (content = 'ciphertext') => {
      if (!pickerFolder().exists) pickerFolder().create({ intermediates: true });
      const copy = new File(pickerFolder(), '839E8D63.svbackup');
      copy.writeSync(content);
      return copy;
    };

    afterEach(() => {
      jest.restoreAllMocks();
      for (const folder of [pickerFolder(), source()]) if (folder.exists) folder.delete();
    });

    it("moves the picker's copy into the documents folder and leaves none in the cache", async () => {
      const copy = pickCopy('container bytes');

      const kept = await backupService.keepPickedFile(copy.uri);

      expect(pathOf(kept)).toBe(`${pathOf(source().uri).replace(/\/$/, '')}/picked.svbackup`);
      expect(new File(copy.uri).exists).toBe(false);
      expect(new File(kept).textSync()).toBe('container bytes');
      expect(pathOf(kept).startsWith(pathOf(Paths.cache.uri))).toBe(false);
    });

    it('inspects and restores from the kept copy, never from the cache', async () => {
      const inspect = jest
        .spyOn(vault, 'inspectBackup')
        .mockResolvedValue({ version: 1, app: 'SecureVault', created: '2026-10-22', entries: 3 });
      const importBackup = jest
        .spyOn(vault, 'importBackup')
        .mockImplementation(async (_source, _passphrase, extraDir) => ({
          entries: 3,
          extras: [{ key: 'database', path: `${extraDir}/database` }],
        }));

      const kept = await backupService.keepPickedFile(pickCopy().uri);
      await backupService.inspectBackup(kept);
      await backupService.restoreBackup(kept, 'correct horse battery').catch(() => {});

      expect(inspect).toHaveBeenCalledWith(pathOf(kept));
      expect(at(at(importBackup.mock.calls, 0), 0)).toBe(pathOf(kept));
      expect(pathOf(kept).startsWith(pathOf(Paths.cache.uri))).toBe(false);
    });

    it('keeps the folder out of device backups (iOS)', async () => {
      await backupService.keepPickedFile(pickCopy().uri);

      expect(vaultMock.excludedFromBackup()).toContain(pathOf(source().uri).replace(/\/$/, ''));
    });

    it('replaces the copy an earlier pick left behind', async () => {
      await backupService.keepPickedFile(pickCopy('first').uri);

      const kept = await backupService.keepPickedFile(pickCopy('second').uri);

      expect(new File(kept).textSync()).toBe('second');
      expect(source().list()).toHaveLength(1);
    });

    it('is removed at lock and launch with the cache folders', async () => {
      const kept = await backupService.keepPickedFile(pickCopy().uri);

      backupService.sweepCache();

      expect(new File(kept).exists).toBe(false);
      expect(source().exists).toBe(false);
    });

    it('is left to a restore in progress, then swept once it ends', async () => {
      const kept = await backupService.keepPickedFile(pickCopy().uri);
      let finishImport: () => void = () => {};
      jest.spyOn(vault, 'importBackup').mockImplementationOnce(
        (_source, _passphrase, extraDir) =>
          new Promise((resolve) => {
            finishImport = () =>
              resolve({ entries: 1, extras: [{ key: 'database', path: `${extraDir}/database` }] });
          }),
      );
      const restoring = backupService.restoreBackup(kept, 'correct horse battery');
      await Promise.resolve();

      backupService.sweepCache();
      expect(new File(kept).exists).toBe(true);
      // A second pick cannot take its place while it is being read.
      await expect(backupService.keepPickedFile(pickCopy().uri)).rejects.toMatchObject({
        code: 'BACKUP_BUSY',
      });
      expect(new File(kept).exists).toBe(true);

      finishImport();
      await restoring.catch(() => {});
      backupService.sweepCache();
      expect(source().exists).toBe(false);
    });

    it('is removed by discardPickedFile with its folder', async () => {
      const kept = await backupService.keepPickedFile(pickCopy().uri);

      backupService.discardPickedFile(kept);

      expect(source().exists).toBe(false);
    });

    it('leaves a file outside the picker folder where it is', async () => {
      const own = new File(Paths.document, 'my.svbackup');
      own.writeSync('ciphertext');

      expect(await backupService.keepPickedFile(own.uri)).toBe(own.uri);
      expect(own.exists).toBe(true);
      expect(source().exists).toBe(false);
      own.delete();
    });

    it('cleans up the cache copy and the folder when the move fails, with a typed error', async () => {
      const copy = pickCopy();
      jest.spyOn(File.prototype, 'move').mockImplementation(() => {
        throw new Error('/data/user/0/com.naderalfakesh.securevault/files: ENOSPC');
      });

      await expect(backupService.keepPickedFile(copy.uri)).rejects.toMatchObject({
        code: 'BACKUP_RESTORE_STAGING_INVALID',
      });
      expect(new File(copy.uri).exists).toBe(false);
      expect(source().exists).toBe(false);
    });

    it('unlinks a link planted in place of the folder without emptying its target', async () => {
      const follow = followLinksOnDelete();
      const target = new Directory(Paths.document, 'sentinel');
      target.create({ intermediates: true });
      const keep = new File(target, 'keep.txt');
      keep.writeSync('not ours');
      vaultMock.plantLink(pathOf(source().uri), pathOf(target.uri));
      try {
        const kept = await backupService.keepPickedFile(pickCopy().uri);

        expect(keep.exists).toBe(true);
        expect(vaultMock.linkTarget(pathOf(source().uri))).toBeNull();
        expect(new File(kept).exists).toBe(true);
      } finally {
        follow.mockRestore();
        target.delete();
      }
    });

    it('lets the module remove only the folder itself in the documents folder, nothing below or beside it', async () => {
      const kept = await backupService.keepPickedFile(pickCopy().uri);
      const entry = new File(Paths.document, 'file_entry');
      entry.writeSync('vault entry');

      expect(() => vault.removeTreeNoFollow(pathOf(kept))).toThrow(/not inside/);
      expect(() => vault.removeTreeNoFollow(pathOf(entry.uri))).toThrow(/not inside/);
      expect(entry.exists).toBe(true);
      entry.delete();
    });
  });

  describe('one operation at a time', () => {
    const extras = () => new Directory(Paths.cache, BACKUP_DIRECTORY, 'restore');
    const busy = { code: 'BACKUP_BUSY' };

    afterEach(() => {
      const folder = new Directory(Paths.cache, BACKUP_DIRECTORY);
      if (folder.exists) folder.delete();
    });

    it('refuses a second restore, an export, and an erase while a restore runs, and leaves its extras alone', async () => {
      let finishImport: () => void = () => {};
      // The stubbed import restores no entries, so the index key must already be there.
      await vault.put('_database_key', 'ab'.repeat(32));
      const spy = jest.spyOn(vault, 'importBackup').mockImplementationOnce(
        (_source, _passphrase, extraDir) =>
          new Promise((resolve) => {
            finishImport = () => {
              resolve({ entries: 1, extras: [{ key: 'database', path: `${extraDir}/database` }] });
            };
          }),
      );
      const erase = jest.fn(async () => {});
      try {
        const first = backupService.restoreBackup(
          'file:///picked.svbackup',
          'correct horse battery',
        );
        await Promise.resolve();
        expect(backupService.activity()).toBe('restore');
        new File(extras(), 'database').writeSync('index');

        await expect(
          backupService.restoreBackup('file:///other.svbackup', 'correct horse battery'),
        ).rejects.toMatchObject(busy);
        await expect(createBackup('correct horse battery')).rejects.toMatchObject(busy);
        await expect(
          backupService.exportBackup('correct horse battery', async () => {}),
        ).rejects.toMatchObject(busy);
        await expect(backupService.exclusive('erase', erase)).rejects.toMatchObject(busy);

        expect(erase).not.toHaveBeenCalled();
        expect(vault.importBackup).toHaveBeenCalledTimes(1);
        expect(new File(extras(), 'database').exists).toBe(true);

        finishImport();
        await expect(first).resolves.toBe(1);
      } finally {
        spy.mockRestore();
      }
      expect(backupService.activity()).toBeNull();
      await backupService.exclusive('erase', erase);
      expect(erase).toHaveBeenCalledTimes(1);
    });

    it('refuses a restore while an export runs', async () => {
      let finishExport: () => void = () => {};
      const spy = jest.spyOn(vault, 'exportBackup').mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishExport = () => resolve({ entries: 1, bytes: 1024 });
          }),
      );
      try {
        const exporting = createBackup('correct horse battery');
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(backupService.activity()).toBe('export');

        await expect(
          backupService.restoreBackup('file:///picked.svbackup', 'correct horse battery'),
        ).rejects.toMatchObject(busy);

        finishExport();
        backupService.discardBackup((await exporting).uri);
      } finally {
        spy.mockRestore();
      }
      expect(backupService.activity()).toBeNull();
    });

    it('holds an export until its container is removed, also when the hand-off fails', async () => {
      let during: string | null = null;
      let handed = '';
      await expect(
        backupService.exportBackup('correct horse battery', async (backup) => {
          handed = backup.uri;
          during = backupService.activity();
          new File(backup.uri).writeSync('ciphertext');
          throw new Error('share sheet failed');
        }),
      ).rejects.toThrow('share sheet failed');

      expect(during).toBe('export');
      expect(new File(handed).exists).toBe(false);
      expect(backupService.activity()).toBeNull();
    });

    it('releases the slot when the key window lapsed while the app was in the background', async () => {
      const keyLocked = Object.assign(new Error('User not authenticated'), { code: 'KEY_LOCKED' });
      // A prompt requested from the background is never shown and never answers.
      const unlockWithBiometrics = jest.fn(() => new Promise<boolean>(() => {}));
      const backgrounded = withKeyRecovery(
        {
          unlockWithBiometrics,
          exportBackup: async (): Promise<{ entries: number; bytes: number }> => {
            throw keyLocked;
          },
        },
        () => false,
      );
      const spy = jest
        .spyOn(vault, 'exportBackup')
        .mockImplementationOnce(() => backgrounded.exportBackup());
      try {
        await expect(
          backupService.exportBackup('correct horse battery', async () => {}),
        ).rejects.toMatchObject({ code: 'KEY_LOCKED' });
      } finally {
        spy.mockRestore();
      }
      expect(unlockWithBiometrics).not.toHaveBeenCalled();
      expect(backupService.activity()).toBeNull();
      const backup = await createBackup('correct horse battery');
      backupService.discardBackup(backup.uri);
    });

    it('tells listeners when an operation starts and ends, also when it fails', async () => {
      const seen: (string | null)[] = [];
      const stop = backupService.onActivity(() => seen.push(backupService.activity()));
      try {
        await expect(
          backupService.exclusive('erase', async () => {
            throw new Error('erase failed');
          }),
        ).rejects.toThrow('erase failed');
      } finally {
        stop();
      }
      expect(seen).toEqual(['erase', null]);
    });
  });

  describe('folders planted as symbolic links', () => {
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

    beforeEach(() => {
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
          throw Object.assign(
            new Error(`removeTreeNoFollow ${extras}: not inside the app's cache`),
            { code: 'ERR_UNEXPECTED' },
          );
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
});
