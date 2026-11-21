import { Directory, File, Paths } from 'expo-file-system';

import { documentDatabase } from '@/data/database';
import { createBackup } from '@/testing/backup';
import { vaultMock } from '@/testing/vault';
import vault from '@modules/expo-vault';

import { BACKUP_STAGING_DIRECTORY, backupService, describeBackupError } from '../BackupService';
import { documentService } from '../DocumentService';

describe('BackupService', () => {
  beforeEach(async () => {
    vaultMock.reset();
    await documentDatabase.close();
  });

  describe('export staging', () => {
    const staging = () => new Directory(Paths.cache, BACKUP_STAGING_DIRECTORY);

    // What an export killed mid-entry would leave behind.
    const plantResidue = () => {
      const directory = staging();
      if (!directory.exists) directory.create({ intermediates: true });
      new File(directory, 'plain-left-behind').writeSync('plaintext');
    };

    it('hands the module an empty staging folder in the cache and removes it afterwards', async () => {
      plantResidue();
      let seen: { exists: boolean; entries: number } | null = null;
      const spy = jest
        .spyOn(vault, 'exportBackup')
        .mockImplementationOnce(async (destPath, passphrase, extraFiles, stagingDir) => {
          const directory = staging();
          seen = { exists: directory.exists, entries: directory.list().length };
          vaultMock.lastExport = { destPath, stagingDir };
          return { entries: extraFiles.length, bytes: 1 };
        });
      try {
        await createBackup('correct horse battery');
      } finally {
        spy.mockRestore();
      }

      expect(seen).toEqual({ exists: true, entries: 0 });
      const { destPath, stagingDir } = vaultMock.lastExport!;
      expect(stagingDir).toBe(`/mock/cache/${BACKUP_STAGING_DIRECTORY}`);
      expect(destPath.startsWith(`${stagingDir}/`)).toBe(false);
      expect(staging().exists).toBe(false);
    });

    it('removes the staging folder when the module fails', async () => {
      const spy = jest
        .spyOn(vault, 'exportBackup')
        .mockRejectedValueOnce(
          Object.assign(new Error('disk full'), { code: 'BACKUP_EXPORT_FAILED' }),
        );
      try {
        await expect(createBackup('correct horse battery')).rejects.toThrow('disk full');
      } finally {
        spy.mockRestore();
      }
      expect(staging().exists).toBe(false);
    });

    const containers = () =>
      new Directory(Paths.cache, 'backup')
        .list()
        .filter((entry) => entry.name.endsWith('.svbackup'));

    it('removes a half-written container when the module fails mid-write', async () => {
      const spy = jest.spyOn(vault, 'exportBackup').mockImplementationOnce(async (destPath) => {
        new File(`file://${destPath}`).writeSync('SVB1 partial');
        throw Object.assign(new Error('disk full'), { code: 'BACKUP_EXPORT_FAILED' });
      });
      try {
        await expect(createBackup('correct horse battery')).rejects.toThrow('disk full');
      } finally {
        spy.mockRestore();
      }
      expect(containers()).toHaveLength(0);
    });

    it('keeps the container the module finished writing', async () => {
      const spy = jest.spyOn(vault, 'exportBackup').mockImplementationOnce(async (destPath) => {
        new File(`file://${destPath}`).writeSync('SVB1 complete');
        return { entries: 1, bytes: 13 };
      });
      let backup;
      try {
        backup = await createBackup('correct horse battery');
      } finally {
        spy.mockRestore();
      }
      expect(containers().map((entry) => entry.name)).toEqual([backup.name]);
      backupService.discardBackup(backup.uri);
      expect(containers()).toHaveLength(0);
    });

    it('discards a finished container without following links', async () => {
      const spy = jest.spyOn(vault, 'exportBackup').mockImplementation(async (destPath) => {
        new File(`file://${destPath}`).writeSync('SVB1 complete');
        return { entries: 1, bytes: 13 };
      });
      let backup;
      try {
        backup = await createBackup('correct horse battery');
      } finally {
        spy.mockRestore();
      }
      const remove = jest.spyOn(vault, 'removeTreeNoFollow');

      backupService.discardBackup(backup.uri);

      expect(remove).toHaveBeenCalledWith(decodeURIComponent(backup.uri.replace(/^file:\/\//, '')));
      expect(containers()).toHaveLength(0);
    });

    // Makes removing the staging folder fail once the module has been called.
    const failStagingRemoval = (called: () => boolean) => {
      const remove = Directory.prototype.delete;
      return jest.spyOn(Directory.prototype, 'delete').mockImplementation(function (
        this: Directory,
      ) {
        if (called() && this.name === BACKUP_STAGING_DIRECTORY) throw new Error('busy');
        return remove.call(this);
      });
    };

    it("keeps the module's own error when the staging folder cannot be removed", async () => {
      let called = false;
      const spy = jest.spyOn(vault, 'exportBackup').mockImplementationOnce(async (destPath) => {
        called = true;
        new File(`file://${destPath}`).writeSync('SVB1 partial');
        throw Object.assign(new Error('Key user not authenticated'), { code: 'KEY_LOCKED' });
      });
      const removal = failStagingRemoval(() => called);
      try {
        await expect(createBackup('correct horse battery')).rejects.toMatchObject({
          code: 'KEY_LOCKED',
        });
      } finally {
        removal.mockRestore();
        spy.mockRestore();
      }
      expect(containers()).toHaveLength(0);
      staging().delete();
    });

    // Makes removing the index copy fail once the module has been called.
    const failIndexRemoval = (called: () => boolean) => {
      const remove = File.prototype.delete;
      return jest.spyOn(File.prototype, 'delete').mockImplementation(function (this: File) {
        if (called() && this.name === 'index.db') {
          throw new Error('"index.db" couldn\'t be removed: /private/var/mobile/Caches/backup');
        }
        return remove.call(this);
      });
    };

    const indexCopy = () => new File(new Directory(Paths.cache, 'backup'), 'index.db');
    // The Jest database double writes no copy; the real one does before the module runs.
    const writeIndexCopy = () => indexCopy().writeSync('SQLite format 3');

    const finishedExport = (onCall: () => void) =>
      jest.spyOn(vault, 'exportBackup').mockImplementationOnce(async (destPath) => {
        onCall();
        writeIndexCopy();
        new File(`file://${destPath}`).writeSync('SVB1 complete');
        return { entries: 1, bytes: 13 };
      });

    it('fails with a typed error and drops a finished container when the staging folder cannot be removed', async () => {
      let called = false;
      const spy = finishedExport(() => (called = true));
      const removal = failStagingRemoval(() => called);
      let caught: unknown;
      try {
        caught = await createBackup('correct horse battery').catch((e) => e);
      } finally {
        removal.mockRestore();
        spy.mockRestore();
      }
      expect(caught).toMatchObject({ code: 'BACKUP_STAGING_INVALID' });
      expect((caught as Error).cause).toEqual(new Error('busy'));
      expect(containers()).toHaveLength(0);
      // The index copy is removed even though the staging folder was not.
      expect(indexCopy().exists).toBe(false);
      staging().delete();
    });

    it('still removes the staging folder and drops the container when the index copy cannot be removed', async () => {
      let called = false;
      const spy = finishedExport(() => (called = true));
      const removal = failIndexRemoval(() => called);
      let caught: unknown;
      try {
        caught = await createBackup('correct horse battery').catch((e) => e);
      } finally {
        removal.mockRestore();
        spy.mockRestore();
      }
      expect(caught).toMatchObject({ code: 'BACKUP_STAGING_INVALID' });
      expect(String((caught as Error).cause)).toMatch(/index\.db/);
      expect(containers()).toHaveLength(0);
      expect(staging().exists).toBe(false);
      // The sentence the export sheet shows names no path and no platform error.
      const shown = describeBackupError(caught, 'Could not create the backup.');
      expect(shown).toBe(
        "The backup's temporary files could not be cleared, so no backup was made. Try again.",
      );
      expect(shown).not.toMatch(/index\.db|\/private|Caches|Exception/);
      indexCopy().delete();
    });

    it('reports the first cleanup failure when both the index copy and the staging folder remain', async () => {
      let called = false;
      const spy = finishedExport(() => (called = true));
      const indexRemoval = failIndexRemoval(() => called);
      const stagingRemoval = failStagingRemoval(() => called);
      let caught: unknown;
      try {
        caught = await createBackup('correct horse battery').catch((e) => e);
      } finally {
        stagingRemoval.mockRestore();
        indexRemoval.mockRestore();
        spy.mockRestore();
      }
      expect(caught).toMatchObject({ code: 'BACKUP_STAGING_INVALID' });
      expect(String((caught as Error).cause)).toMatch(/index\.db/);
      expect(containers()).toHaveLength(0);
      indexCopy().delete();
      staging().delete();
    });

    it("keeps the module's own error when the index copy cannot be removed after a failed export", async () => {
      let called = false;
      const spy = jest.spyOn(vault, 'exportBackup').mockImplementationOnce(async () => {
        called = true;
        writeIndexCopy();
        throw Object.assign(new Error('Key user not authenticated'), { code: 'KEY_LOCKED' });
      });
      const removal = failIndexRemoval(() => called);
      try {
        await expect(createBackup('correct horse battery')).rejects.toMatchObject({
          code: 'KEY_LOCKED',
          message: 'Key user not authenticated',
        });
      } finally {
        removal.mockRestore();
        spy.mockRestore();
      }
      expect(staging().exists).toBe(false);
      indexCopy().delete();
    });

    it('is swept with the rest of the cache when the vault locks', async () => {
      plantResidue();
      const finished = new Directory(Paths.cache, 'backup');
      if (!finished.exists) finished.create();
      new File(finished, 'SecureVault backup 2026-10-13.svbackup').writeSync('ciphertext');

      await documentService.clearCache();

      expect(staging().exists).toBe(false);
      // Finished backups are ciphertext; the backup sweep removes them, not this one.
      expect(finished.exists).toBe(true);
      finished.delete();
    });
  });
});
