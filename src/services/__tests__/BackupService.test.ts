import { Directory, File, Paths } from 'expo-file-system';

import { closeDocumentStore } from '@/data/database';

import vault, { type BackupProgress } from '../../../modules/expo-vault';
import {
  followLinksOnDelete,
  type VaultMockExport,
  type VaultMockImport,
} from '../../../modules/expo-vault/src/ExpoVaultModule.mock';
import { withKeyRecovery } from '../../../modules/expo-vault/src/withKeyRecovery';
import { DocumentCategory } from '../../types';
import {
  BACKUP_DIRECTORY,
  BACKUP_STAGING_DIRECTORY,
  backupService,
  describeBackupError,
  describeBackupErrorPlainly,
  passphraseProblem,
  RESTORE_STAGING_DIRECTORY,
} from '../BackupService';
import { documentService, PICKER_DIRECTORY } from '../DocumentService';

const vaultMock = vault as unknown as {
  reset(): void;
  plantLink(path: string, target: string): void;
  linkTarget(path: string): string | null;
  lastExport: VaultMockExport | null;
  lastImport: VaultMockImport | null;
};

/** A progress event as the native restore sends it, for a stubbed import. */
const emitProgress = (event: BackupProgress) =>
  (vault as unknown as { emitProgress(event: BackupProgress): void }).emitProgress(event);

const picked = { uri: '/tmp/passport.jpg', name: 'passport.jpg', type: 'image/jpeg', size: 2048 };

describe('passphrase policy', () => {
  it('rejects short, repeated, and mismatched passphrases', () => {
    expect(passphraseProblem('short')).toMatch(/at least 8/);
    expect(passphraseProblem('aaaaaaaa')).toMatch(/more than one character/);
    expect(passphraseProblem('correct horse', 'wrong horse')).toMatch(/do not match/);
    expect(passphraseProblem('correct horse', 'correct horse')).toBeNull();
  });

  it('turns native error codes into sentences', () => {
    expect(describeBackupError({ code: 'BACKUP_PASSPHRASE' })).toBe(
      'That passphrase does not match this backup. Nothing was changed.',
    );
    expect(describeBackupError({ code: 'BACKUP_INVALID' })).toBe(
      'This file is not a SecureVault backup, or it is damaged. Nothing was changed.',
    );
    expect(describeBackupError({ code: 'BACKUP_UNSUPPORTED' })).toBe(
      "This backup uses settings this version of the app doesn't support. Nothing was changed.",
    );
    expect(describeBackupError({ code: 'BACKUP_PARTIAL' })).toMatch(/previous vault was removed/);
    expect(describeBackupError({ code: 'BACKUP_PARTIAL' })).not.toMatch(/Nothing was changed/);
    expect(describeBackupError({ code: 'BACKUP_RESOURCE' })).toBe(
      "This device doesn't have enough free space or memory to restore this backup. Nothing was changed.",
    );
    expect(describeBackupError({ code: 'BACKUP_NO_SPACE' })).toBe(
      "This device doesn't have enough free space to restore this backup. Nothing was changed. Free up some space and try again.",
    );
    expect(describeBackupError({ code: 'BACKUP_INDEX' })).toBe(
      'Your documents were restored but the index could not be opened. Restore the backup again.',
    );
    expect(describeBackupError({ code: 'BACKUP_CANCELLED' })).toBe(
      'Restore cancelled. Nothing was changed.',
    );
    expect(describeBackupError({ code: 'KEY_LOCKED', message: 'User not authenticated' })).toBe(
      'The device key was not unlocked, so nothing was changed. Try again.',
    );
    expect(describeBackupError({ code: 'BACKUP_STAGING_INVALID' })).toMatch(
      /temporary files could not be cleared/,
    );
    expect(describeBackupError({ code: 'BACKUP_RESTORE_STAGING_INVALID' })).toMatch(
      /restore's temporary files could not be cleared, so nothing was changed/,
    );
    expect(describeBackupError({ code: 'BACKUP_BUSY' })).toMatch(/still running/);
    expect(
      describeBackupError({ code: 'BACKUP_EXPORT_FAILED', message: 'Could not list files' }),
    ).toMatch(/backup could not be written/);
    expect(describeBackupError({ code: 'BACKUP_IMPORT_FAILED' })).toMatch(/nothing was changed/);
    expect(describeBackupError({ code: 'GET_ALL_KEYS_FAILED' })).toMatch(/files could not be read/);
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
    expect(
      describeBackupErrorPlainly({ code: 'BACKUP_RESTORE_STAGING_INVALID' }, 'fallback'),
    ).toMatch(/nothing was changed/);
    for (const code of ['BACKUP_UNSUPPORTED', 'BACKUP_RESOURCE', 'BACKUP_NO_SPACE']) {
      expect(describeBackupErrorPlainly({ code, message: '/var/mobile/x' }, 'fallback')).toMatch(
        /Nothing was changed/,
      );
    }
  });
});

describe('BackupService', () => {
  beforeEach(async () => {
    vaultMock.reset();
    await closeDocumentStore();
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

  describe('when the restore extras cannot be removed afterwards', () => {
    // Fails only the removal in the restore's cleanup, not the one before the import.
    const failExtrasCleanup = () => {
      const remove = vault.removeTreeNoFollow.bind(vault);
      let calls = 0;
      return jest.spyOn(vault, 'removeTreeNoFollow').mockImplementation((path) => {
        if (path.replace(/\/+$/, '').endsWith(`/${BACKUP_DIRECTORY}/restore`)) {
          calls += 1;
          if (calls > 1) throw new Error('busy: /mock/cache/backup/restore');
        }
        remove(path);
      });
    };

    it('still reports a finished restore', async () => {
      await vault.put('_database_key', 'ab'.repeat(32));
      const backup = await backupService.createBackup('correct horse battery');
      const removal = failExtrasCleanup();
      try {
        await expect(
          backupService.restoreBackup(backup.uri, 'correct horse battery'),
        ).resolves.toBe(backup.entries);
      } finally {
        removal.mockRestore();
      }
    });

    it('still reports an index that could not be opened', async () => {
      await vault.put('_database_key', 'ab'.repeat(32));
      const backup = await backupService.createBackup('correct horse battery');
      const reload = jest
        .spyOn(documentService, 'reload')
        .mockRejectedValueOnce(new Error('file is not a database'));
      const removal = failExtrasCleanup();
      try {
        await expect(
          backupService.restoreBackup(backup.uri, 'correct horse battery'),
        ).rejects.toMatchObject({ code: 'BACKUP_INDEX', message: 'file is not a database' });
      } finally {
        removal.mockRestore();
        reload.mockRestore();
      }
    });
  });

  describe('refusals the module makes before the vault is cleared', () => {
    // Each code is one the native restore raises before its first removal:
    // header settings, structure, memory for the largest string entry, disk.
    const refusals = [
      [
        'BACKUP_UNSUPPORTED',
        'This backup uses settings this version of the app does not support: 1200000 iterations.',
      ],
      ['BACKUP_INVALID', 'The backup file is not valid: trailing data'],
      [
        'BACKUP_RESOURCE',
        'This device does not have enough memory to restore this backup: an entry of 40000000 bytes.',
      ],
      [
        'BACKUP_NO_SPACE',
        'This device does not have enough free space to restore this backup (needs 9 bytes, has 1).',
      ],
    ] as const;

    it.each(refusals)(
      'passes %s on unchanged, keeps the vault and the index, and clears its staging',
      async (code, message) => {
        await vault.put('_database_key', 'cd'.repeat(32));
        const backup = await backupService.createBackup('correct horse battery');
        await vault.put('_database_key', 'ef'.repeat(32));
        const keys = await vault.getAllKeys();
        jest
          .spyOn(vault, 'importBackup')
          .mockRejectedValueOnce(Object.assign(new Error(message), { code }));
        const reload = jest.spyOn(documentService, 'reload');
        try {
          await expect(
            backupService.restoreBackup(backup.uri, 'correct horse battery'),
          ).rejects.toMatchObject({ code, message });
          expect(reload).not.toHaveBeenCalled();
          expect(await vault.get('_database_key')).toBe('ef'.repeat(32));
          expect(await vault.getAllKeys()).toEqual(keys);
          expect(new Directory(Paths.cache, RESTORE_STAGING_DIRECTORY).exists).toBe(false);
          expect(backupService.activity()).toBeNull();
          expect(describeBackupError({ code, message })).toMatch(/Nothing was changed/);
        } finally {
          jest.restoreAllMocks();
        }
      },
    );

    it.each(['BACKUP_UNSUPPORTED', 'BACKUP_RESOURCE', 'BACKUP_INVALID'])(
      'passes a %s header refusal from inspect on unchanged',
      async (code) => {
        jest
          .spyOn(vault, 'inspectBackup')
          .mockRejectedValueOnce(Object.assign(new Error('native text'), { code }));
        try {
          await expect(
            backupService.inspectBackup('file:///mock/cache/DocumentPicker/a.svbackup'),
          ).rejects.toMatchObject({ code });
        } finally {
          jest.restoreAllMocks();
        }
      },
    );
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

  describe('cancelling a restore', () => {
    const keyLocked = () =>
      Object.assign(new Error('User not authenticated'), { code: 'KEY_LOCKED' });

    async function vaultWithBackup() {
      await vault.put('_database_key', 'cd'.repeat(32));
      const backup = await backupService.createBackup('correct horse battery');
      await vault.put('_database_key', 'ef'.repeat(32));
      return { backup, keys: await vault.getAllKeys() };
    }

    afterEach(() => jest.restoreAllMocks());

    it('stops a restore that is still checking and leaves the vault, index and staging untouched', async () => {
      const { backup, keys } = await vaultWithBackup();
      const reload = jest.spyOn(documentService, 'reload');
      const events: unknown[] = [];

      await expect(
        backupService.restoreBackup(backup.uri, 'correct horse battery', (event) => {
          events.push(event);
          if (event.phase === 'verify') expect(backupService.cancelRestore()).toBe(true);
        }),
      ).rejects.toMatchObject({ code: 'BACKUP_CANCELLED' });

      expect(events).toEqual([expect.objectContaining({ phase: 'verify', wiped: false })]);
      expect(reload).not.toHaveBeenCalled();
      expect(await vault.get('_database_key')).toBe('ef'.repeat(32));
      expect(await vault.getAllKeys()).toEqual(keys);
      expect(new Directory(Paths.cache, RESTORE_STAGING_DIRECTORY).exists).toBe(false);
      expect(new Directory(Paths.cache, BACKUP_DIRECTORY, 'restore').exists).toBe(false);
      expect(backupService.activity()).toBeNull();
    });

    it('asks again on the first progress event when the cancel came before the native restore began', async () => {
      const { backup, keys } = await vaultWithBackup();
      const importBackup = vault.importBackup.bind(vault);
      jest.spyOn(vault, 'importBackup').mockImplementationOnce(async (...args) => {
        // The native call starts on its own queue, after the cancel from the JS thread.
        await new Promise((resolve) => setTimeout(resolve, 0));
        return importBackup(...args);
      });
      const cancel = jest.spyOn(vault, 'cancelRestore');

      const restore = backupService.restoreBackup(backup.uri, 'correct horse battery');
      expect(backupService.cancelRestore()).toBe(true);

      await expect(restore).rejects.toMatchObject({ code: 'BACKUP_CANCELLED' });
      expect(cancel).toHaveBeenCalledTimes(2);
      expect(await vault.getAllKeys()).toEqual(keys);
    });

    it('cannot cancel once the first Restoring event has passed, or with no restore running', async () => {
      const { backup } = await vaultWithBackup();
      expect(backupService.cancelRestore()).toBe(false);
      const answers: boolean[] = [];
      const wiped: boolean[] = [];

      await expect(
        backupService.restoreBackup(backup.uri, 'correct horse battery', (event) => {
          wiped.push(event.wiped);
          if (event.phase === 'import') answers.push(backupService.cancelRestore());
        }),
      ).resolves.toBe(backup.entries);

      expect(answers).toEqual([false]);
      expect(wiped).toEqual([false, true]);
      expect(backupService.cancelRestore()).toBe(false);
    });

    it('names any failure after the first Restoring event a partial restore, with where it stopped', async () => {
      const { backup } = await vaultWithBackup();
      jest.spyOn(vault, 'importBackup').mockImplementationOnce(async () => {
        // Natively: the first entry restored, then the prompt for the key was cancelled.
        emitProgress({ phase: 'verify', done: 5, total: 5 });
        emitProgress({ phase: 'import', done: 2, total: 5 });
        throw keyLocked();
      });

      await expect(
        backupService.restoreBackup(backup.uri, 'correct horse battery'),
      ).rejects.toMatchObject({ code: 'BACKUP_PARTIAL', stoppedAt: { entry: 3, total: 5 } });
      expect(describeBackupError({ code: 'BACKUP_PARTIAL' })).not.toMatch(/Nothing was changed/);
    });

    it('keeps a retried restore partial after the wipe, even when the retry is cancelled while checking', async () => {
      const { backup } = await vaultWithBackup();
      jest.spyOn(vault, 'importBackup').mockImplementationOnce(async () => {
        emitProgress({ phase: 'verify', done: 5, total: 5 });
        emitProgress({ phase: 'import', done: 1, total: 5 });
        // The key recovery wrapper re-ran the whole restore after a new prompt.
        emitProgress({ phase: 'verify', done: 3, total: 5 });
        throw Object.assign(new Error('cancelled'), { code: 'BACKUP_CANCELLED' });
      });
      const events: { wiped: boolean }[] = [];

      await expect(
        backupService.restoreBackup(backup.uri, 'correct horse battery', (event) => {
          events.push(event);
        }),
      ).rejects.toMatchObject({ code: 'BACKUP_PARTIAL' });
      expect(events.map((event) => event.wiped)).toEqual([false, true, true]);
    });

    it('passes a key prompt cancelled before the wipe on as unchanged', async () => {
      const { backup, keys } = await vaultWithBackup();
      jest.spyOn(vault, 'importBackup').mockRejectedValueOnce(keyLocked());

      await expect(
        backupService.restoreBackup(backup.uri, 'correct horse battery'),
      ).rejects.toMatchObject({ code: 'KEY_LOCKED' });
      expect(await vault.getAllKeys()).toEqual(keys);
    });
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
        new File(`file://${destPath}`).writeSync('SVB1 partial');
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
        new File(`file://${destPath}`).writeSync('SVB1 complete');
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
        new File(`file://${destPath}`).writeSync('SVB1 partial');
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
      new File(finished, 'SecureVault backup 2026-10-13.svbackup').writeSync('ciphertext');

      await documentService.clearCache();

      expect(staging().exists).toBe(false);
      // Finished backups are ciphertext; the backup sweep removes them, not this one.
      expect(finished.exists).toBe(true);
      finished.delete();
    });
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
      return backupService.createBackup('correct horse battery');
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
        .mockImplementationOnce(async (source, passphrase, extraDir, stagingDir) => {
          const directory = staging();
          seen = { exists: directory.exists, entries: directory.list().length };
          return original(source, passphrase, extraDir, stagingDir);
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
        (source, passphrase, extraDir, stagingDir) =>
          new Promise((resolve, reject) => {
            entry = new File(`file://${stagingDir}/backup-entry`);
            entry.writeSync('plaintext');
            finishImport = () => {
              entry!.delete();
              original(source, passphrase, extraDir, stagingDir).then(resolve, reject);
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
        new File(extras(), 'database').writeSync('index');

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
      const backup = await backupService.createBackup('correct horse battery');
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
      const backup = await backupService.createBackup('correct horse battery');
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

      const backup = await backupService.createBackup('correct horse battery');

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

      await expect(backupService.createBackup('correct horse battery')).rejects.toMatchObject({
        code: 'BACKUP_STAGING_INVALID',
      });
      expect(exportBackup).not.toHaveBeenCalled();
    });

    it('fails a restore whose extras folder cannot be cleared with a typed error and a plain sentence', async () => {
      await vault.put('_database_key', 'ab'.repeat(32));
      const backup = await backupService.createBackup('correct horse battery');
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
