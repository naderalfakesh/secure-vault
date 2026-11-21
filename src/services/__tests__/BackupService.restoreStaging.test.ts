import { Directory, File, Paths } from 'expo-file-system';

import { documentDatabase } from '@/data/database';
import { createBackup } from '@/testing/backup';
import { vaultMock } from '@/testing/vault';
import vault from '@modules/expo-vault';

import {
  BACKUP_DIRECTORY,
  BACKUP_STAGING_DIRECTORY,
  backupService,
  describeBackupError,
  RESTORE_STAGING_DIRECTORY,
} from '../BackupService';
import { documentService, PICKER_DIRECTORY } from '../DocumentService';

describe('BackupService', () => {
  beforeEach(async () => {
    vaultMock.reset();
    await documentDatabase.close();
  });

  describe('restore staging', () => {
    const staging = () => new Directory(Paths.cache, RESTORE_STAGING_DIRECTORY);

    // What a restore killed mid-entry would leave behind.
    const plantResidue = () => {
      const directory = staging();
      if (!directory.exists) directory.create({ intermediates: true });
      const leftover = new File(directory, 'backup-left-behind');
      leftover.writeSync('plaintext');
      return leftover;
    };

    const backupOf = async () => {
      await vault.put('_database_key', 'ab'.repeat(32));
      return createBackup('correct horse battery');
    };

    afterEach(() => {
      if (staging().exists) staging().delete();
    });

    it('hands the module an empty restore staging folder in the cache and removes it afterwards', async () => {
      const backup = await backupOf();
      plantResidue();
      let seen: { exists: boolean; entries: number } | null = null;
      const original = vault.importBackup.bind(vault);
      const spy = jest
        .spyOn(vault, 'importBackup')
        .mockImplementationOnce(async (source, passphrase, extraDir, stagingDir, runId) => {
          const directory = staging();
          seen = { exists: directory.exists, entries: directory.list().length };
          return original(source, passphrase, extraDir, stagingDir, runId);
        });
      try {
        await backupService.restoreBackup(backup.uri, 'correct horse battery');
      } finally {
        spy.mockRestore();
      }

      expect(seen).toEqual({ exists: true, entries: 0 });
      const { extraDir, stagingDir } = vaultMock.lastImport!;
      expect(stagingDir).toBe(`/mock/cache/${RESTORE_STAGING_DIRECTORY}`);
      // Extras are moved out to the backup folder; staging is never inside it or the export's.
      expect(extraDir.startsWith(`${stagingDir}/`)).toBe(false);
      expect(stagingDir).not.toBe(`/mock/cache/${BACKUP_STAGING_DIRECTORY}`);
      expect(staging().exists).toBe(false);
    });

    it('removes the restore staging folder when the module fails, keeping its error', async () => {
      const backup = await backupOf();
      const spy = jest
        .spyOn(vault, 'importBackup')
        .mockImplementationOnce(async (_source, _passphrase, _extraDir, stagingDir) => {
          new File(`file://${stagingDir}/backup-entry`).writeSync('plaintext');
          throw Object.assign(new Error('disk full'), { code: 'BACKUP_PARTIAL' });
        });
      try {
        await expect(
          backupService.restoreBackup(backup.uri, 'correct horse battery'),
        ).rejects.toMatchObject({ code: 'BACKUP_PARTIAL' });
      } finally {
        spy.mockRestore();
      }
      expect(staging().exists).toBe(false);
    });

    it("passes on the module's typed refusal of the staging folder", async () => {
      const backup = await backupOf();
      const spy = jest.spyOn(vault, 'importBackup').mockRejectedValueOnce(
        Object.assign(new Error('The backup staging folder is not allowed: not a directory'), {
          code: 'BACKUP_RESTORE_STAGING_INVALID',
        }),
      );
      try {
        const failure = await backupService
          .restoreBackup(backup.uri, 'correct horse battery')
          .catch((error: unknown) => error);
        expect(failure).toMatchObject({ code: 'BACKUP_RESTORE_STAGING_INVALID' });
        expect(describeBackupError(failure)).toMatch(/nothing was changed/);
      } finally {
        spy.mockRestore();
      }
    });

    it("removes a killed restore's plaintext at launch", () => {
      const leftover = plantResidue();

      backupService.sweepCache();

      expect(leftover.exists).toBe(false);
      expect(staging().exists).toBe(false);
    });

    it('is left to a restore that runs through a lock, which removes it when it ends', async () => {
      const backup = await backupOf();
      let finishImport: () => void = () => {};
      let entry: File | null = null;
      const original = vault.importBackup.bind(vault);
      const spy = jest.spyOn(vault, 'importBackup').mockImplementationOnce(
        (source, passphrase, extraDir, stagingDir, runId) =>
          new Promise((resolve, reject) => {
            entry = new File(`file://${stagingDir}/backup-entry`);
            entry.writeSync('plaintext');
            finishImport = () => {
              entry!.delete();
              original(source, passphrase, extraDir, stagingDir, runId).then(resolve, reject);
            };
          }),
      );
      try {
        const restoring = backupService.restoreBackup(backup.uri, 'correct horse battery');
        await Promise.resolve();
        await Promise.resolve();

        // The lock's two sweeps.
        await documentService.clearCache();
        backupService.sweepCache();
        expect(entry!.exists).toBe(true);

        finishImport();
        await restoring;
      } finally {
        spy.mockRestore();
      }
      expect(staging().exists).toBe(false);
    });
  });

  describe('ciphertext sweep', () => {
    const finished = () => new Directory(Paths.cache, BACKUP_DIRECTORY);
    const pickerFolder = () => new Directory(Paths.cache, PICKER_DIRECTORY);

    const plantCiphertext = () => {
      for (const folder of [finished(), pickerFolder()]) {
        if (!folder.exists) folder.create({ intermediates: true });
      }
      new File(finished(), 'SecureVault backup 2026-10-16.svbackup').writeSync('ciphertext');
      new File(finished(), 'index.db').writeSync('ciphertext');
      const picked = new File(pickerFolder(), '839E8D63.svbackup');
      picked.writeSync('ciphertext');
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
      own.writeSync('ciphertext');
      const lookalike = new Directory(Paths.cache, `${PICKER_DIRECTORY}-other`);
      lookalike.create();
      const neighbour = new File(lookalike, 'other.svbackup');
      neighbour.writeSync('ciphertext');

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
});
