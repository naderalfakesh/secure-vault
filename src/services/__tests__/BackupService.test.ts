import { Directory, File, Paths } from 'expo-file-system';

import vault from '../../../modules/expo-vault';
import type { VaultMockExport } from '../../../modules/expo-vault/src/ExpoVaultModule.mock';
import { DocumentCategory } from '../../types';
import {
  BACKUP_DIRECTORY,
  BACKUP_STAGING_DIRECTORY,
  backupService,
  describeBackupError,
  describeBackupErrorPlainly,
  PICKER_DIRECTORY,
  passphraseProblem,
} from '../BackupService';
import { documentService } from '../DocumentService';

const vaultMock = vault as unknown as { reset(): void; lastExport: VaultMockExport | null };

const picked = { uri: '/tmp/passport.jpg', name: 'passport.jpg', type: 'image/jpeg', size: 2048 };

describe('passphrase policy', () => {
  it('rejects short, repeated, and mismatched passphrases', () => {
    expect(passphraseProblem('short')).toMatch(/at least 8/);
    expect(passphraseProblem('aaaaaaaa')).toMatch(/more than one character/);
    expect(passphraseProblem('correct horse', 'wrong horse')).toMatch(/do not match/);
    expect(passphraseProblem('correct horse', 'correct horse')).toBeNull();
  });

  it('turns native error codes into sentences', () => {
    expect(describeBackupError({ code: 'BACKUP_PASSPHRASE' })).toMatch(/does not match/);
    expect(describeBackupError({ code: 'BACKUP_INVALID' })).toMatch(/not a SecureVault backup/);
    expect(describeBackupError({ code: 'BACKUP_UNSUPPORTED' })).toMatch(/newer version/);
    expect(describeBackupError({ code: 'BACKUP_PARTIAL' })).toMatch(/previous vault was removed/);
    expect(describeBackupError({ code: 'BACKUP_RESOURCE' })).toMatch(/enough memory/);
    expect(describeBackupError({ code: 'BACKUP_INDEX' })).toMatch(/index could not be opened/);
    expect(describeBackupError({ code: 'BACKUP_STAGING_INVALID' })).toMatch(
      /temporary files could not be cleared/,
    );
    expect(describeBackupError({ code: 'BACKUP_BUSY' })).toMatch(/still running/);
    expect(describeBackupError(new Error('disk full'))).toBe('disk full');
    expect(describeBackupError(null)).toBe('Could not use this backup.');
    expect(describeBackupError(null, 'Could not create the backup.')).toBe(
      'Could not create the backup.',
    );
  });

  it('never passes on the platform message when describing plainly', () => {
    expect(describeBackupErrorPlainly({ code: 'BACKUP_PARTIAL' }, 'fallback')).toMatch(
      /previous vault was removed/,
    );
    expect(
      describeBackupErrorPlainly(new Error('/var/mobile/Caches/backup/restore: EIO'), 'fallback'),
    ).toBe('fallback');
    expect(describeBackupErrorPlainly({ code: 'SOMETHING_ELSE' }, 'fallback')).toBe('fallback');
  });
});

describe('BackupService', () => {
  beforeEach(async () => {
    vaultMock.reset();
    await documentService.reload();
  });

  it('refuses to write a backup behind a weak passphrase', async () => {
    await expect(backupService.createBackup('weak')).rejects.toThrow(/at least 8/);
  });

  it('round-trips the vault through a backup file and reports progress', async () => {
    await documentService.addDocument(picked, { title: 'Passport', category: DocumentCategory.ID });
    await vault.put('_database_key', 'ab'.repeat(32));
    const progress = jest.fn();

    const backup = await backupService.createBackup('correct horse battery', progress);
    expect(backup.name).toMatch(/^SecureVault backup \d{4}-\d{2}-\d{2}\.svbackup$/);
    expect(backup.entries).toBeGreaterThan(0);
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ phase: 'export' }));

    expect((await backupService.inspectBackup(backup.uri)).entries).toBe(backup.entries);

    // Wipe the vault, then restore.
    for (const key of await vault.getAllKeys()) {
      await vault.delete(key);
      await vault.deleteFile(key);
    }
    await expect(vault.get('_database_key')).rejects.toThrow();

    const restored = await backupService.restoreBackup(
      backup.uri,
      'correct horse battery',
      progress,
    );
    expect(restored).toBe(backup.entries);
    expect(await vault.get('_database_key')).toBe('ab'.repeat(32));
    const phases = progress.mock.calls.map(([event]) => (event as { phase: string }).phase);
    expect(phases.indexOf('verify')).toBeGreaterThan(phases.indexOf('export'));
    expect(phases.indexOf('import')).toBeGreaterThan(phases.indexOf('verify'));
  });

  it('names a restore whose index could not be opened after the vault was replaced', async () => {
    await vault.put('_database_key', 'ab'.repeat(32));
    const backup = await backupService.createBackup('correct horse battery');
    const reload = jest
      .spyOn(documentService, 'reload')
      .mockRejectedValueOnce(new Error('file is not a database'));
    try {
      await expect(
        backupService.restoreBackup(backup.uri, 'correct horse battery'),
      ).rejects.toMatchObject({ code: 'BACKUP_INDEX', message: 'file is not a database' });
    } finally {
      reload.mockRestore();
    }
  });

  it('rejects a wrong passphrase without touching the vault', async () => {
    await vault.put('_database_key', 'cd'.repeat(32));
    const backup = await backupService.createBackup('correct horse battery');
    await vault.put('_database_key', 'ef'.repeat(32));

    await expect(
      backupService.restoreBackup(backup.uri, 'wrong passphrase!'),
    ).rejects.toMatchObject({
      code: 'BACKUP_PASSPHRASE',
    });
    expect(await vault.get('_database_key')).toBe('ef'.repeat(32));
  });

  describe('export staging', () => {
    const staging = () => new Directory(Paths.cache, BACKUP_STAGING_DIRECTORY);

    // What an export killed mid-entry would leave behind.
    const plantResidue = () => {
      const directory = staging();
      if (!directory.exists) directory.create({ intermediates: true });
      new File(directory, 'plain-left-behind').write('plaintext');
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
        await backupService.createBackup('correct horse battery');
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
        await expect(backupService.createBackup('correct horse battery')).rejects.toThrow(
          'disk full',
        );
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
        new File(`file://${destPath}`).write('SVB1 partial');
        throw Object.assign(new Error('disk full'), { code: 'BACKUP_EXPORT_FAILED' });
      });
      try {
        await expect(backupService.createBackup('correct horse battery')).rejects.toThrow(
          'disk full',
        );
      } finally {
        spy.mockRestore();
      }
      expect(containers()).toHaveLength(0);
    });

    it('keeps the container the module finished writing', async () => {
      const spy = jest.spyOn(vault, 'exportBackup').mockImplementationOnce(async (destPath) => {
        new File(`file://${destPath}`).write('SVB1 complete');
        return { entries: 1, bytes: 13 };
      });
      let backup;
      try {
        backup = await backupService.createBackup('correct horse battery');
      } finally {
        spy.mockRestore();
      }
      expect(containers().map((entry) => entry.name)).toEqual([backup.name]);
      backupService.discardBackup(backup.uri);
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
        new File(`file://${destPath}`).write('SVB1 partial');
        throw Object.assign(new Error('Key user not authenticated'), { code: 'KEY_LOCKED' });
      });
      const removal = failStagingRemoval(() => called);
      try {
        await expect(backupService.createBackup('correct horse battery')).rejects.toMatchObject({
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
    const writeIndexCopy = () => indexCopy().write('SQLite format 3');

    const finishedExport = (onCall: () => void) =>
      jest.spyOn(vault, 'exportBackup').mockImplementationOnce(async (destPath) => {
        onCall();
        writeIndexCopy();
        new File(`file://${destPath}`).write('SVB1 complete');
        return { entries: 1, bytes: 13 };
      });

    it('fails with a typed error and drops a finished container when the staging folder cannot be removed', async () => {
      let called = false;
      const spy = finishedExport(() => (called = true));
      const removal = failStagingRemoval(() => called);
      let caught: unknown;
      try {
        caught = await backupService.createBackup('correct horse battery').catch((e) => e);
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
        caught = await backupService.createBackup('correct horse battery').catch((e) => e);
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
        caught = await backupService.createBackup('correct horse battery').catch((e) => e);
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
        await expect(backupService.createBackup('correct horse battery')).rejects.toMatchObject({
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
      new File(finished, 'SecureVault backup 2026-10-13.svbackup').write('ciphertext');

      await documentService.clearCache();

      expect(staging().exists).toBe(false);
      // Finished backups are ciphertext; the backup sweep removes them, not this one.
      expect(finished.exists).toBe(true);
      finished.delete();
    });
  });

  describe('ciphertext sweep', () => {
    const finished = () => new Directory(Paths.cache, BACKUP_DIRECTORY);
    const pickerFolder = () => new Directory(Paths.cache, PICKER_DIRECTORY);

    const plantCiphertext = () => {
      for (const folder of [finished(), pickerFolder()]) {
        if (!folder.exists) folder.create({ intermediates: true });
      }
      new File(finished(), 'SecureVault backup 2026-10-16.svbackup').write('ciphertext');
      new File(finished(), 'index.db').write('ciphertext');
      const picked = new File(pickerFolder(), '839E8D63.svbackup');
      picked.write('ciphertext');
      return picked;
    };

    afterEach(() => {
      for (const folder of [finished(), pickerFolder()]) if (folder.exists) folder.delete();
    });

    it('removes finished containers, the index copy, and picked copies at lock and launch', () => {
      plantCiphertext();

      backupService.sweepCache();

      expect(finished().exists).toBe(false);
      expect(pickerFolder().exists).toBe(false);
    });

    it('leaves a restore in progress its picked file and extras, then lets the next sweep run', async () => {
      const picked = plantCiphertext();
      let finishImport: () => void = () => {};
      let extrasDuringImport = false;
      const spy = jest.spyOn(vault, 'importBackup').mockImplementationOnce(
        (_source, _passphrase, extraDir) =>
          new Promise((resolve) => {
            finishImport = () => {
              extrasDuringImport = new Directory(`file://${extraDir}`).exists;
              resolve({ entries: 1, extras: [{ key: 'database', path: `${extraDir}/database` }] });
            };
          }),
      );
      try {
        const restoring = backupService.restoreBackup(picked.uri, 'correct horse battery');
        await Promise.resolve();

        backupService.sweepCache();
        expect(picked.exists).toBe(true);
        expect(new Directory(finished(), 'restore').exists).toBe(true);

        finishImport();
        await restoring.catch(() => {});
        expect(extrasDuringImport).toBe(true);
      } finally {
        spy.mockRestore();
      }

      backupService.sweepCache();
      expect(picked.exists).toBe(false);
      expect(finished().exists).toBe(false);
    });

    it("removes the picker's copy after use and never a file outside the picker folder", () => {
      const picked = plantCiphertext();
      const own = new File(Paths.document, 'my.svbackup');
      own.write('ciphertext');
      const lookalike = new Directory(Paths.cache, `${PICKER_DIRECTORY}-other`);
      lookalike.create();
      const neighbour = new File(lookalike, 'other.svbackup');
      neighbour.write('ciphertext');

      backupService.discardPickedFile(picked.uri);
      backupService.discardPickedFile(own.uri);
      backupService.discardPickedFile(neighbour.uri);

      expect(picked.exists).toBe(false);
      expect(own.exists).toBe(true);
      expect(neighbour.exists).toBe(true);
      own.delete();
      lookalike.delete();
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
        new File(extras(), 'database').write('index');

        await expect(
          backupService.restoreBackup('file:///other.svbackup', 'correct horse battery'),
        ).rejects.toMatchObject(busy);
        await expect(backupService.createBackup('correct horse battery')).rejects.toMatchObject(
          busy,
        );
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
        const exporting = backupService.createBackup('correct horse battery');
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
          new File(backup.uri).write('ciphertext');
          throw new Error('share sheet failed');
        }),
      ).rejects.toThrow('share sheet failed');

      expect(during).toBe('export');
      expect(new File(handed).exists).toBe(false);
      expect(backupService.activity()).toBeNull();
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
});
