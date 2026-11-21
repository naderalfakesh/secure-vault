import { Directory, Paths } from 'expo-file-system';

import { documentDatabase } from '@/data/database';
import { createBackup } from '@/testing/backup';
import { emitProgress } from '@/testing/backupService';
import { at } from '@/testing/lists';
import { vaultMock } from '@/testing/vault';
import vault from '@modules/expo-vault';

import {
  BACKUP_DIRECTORY,
  backupService,
  describeBackupError,
  RESTORE_STAGING_DIRECTORY,
} from '../BackupService';
import { documentService } from '../DocumentService';

describe('BackupService', () => {
  beforeEach(async () => {
    vaultMock.reset();
    await documentDatabase.close();
  });

  describe('cancelling a restore', () => {
    const keyLocked = () =>
      Object.assign(new Error('User not authenticated'), { code: 'KEY_LOCKED' });

    async function vaultWithBackup() {
      await vault.put('_database_key', 'cd'.repeat(32));
      const backup = await createBackup('correct horse battery');
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

    it('says false once the module has passed its last cancel point, before the first Restoring event arrives', async () => {
      const { backup } = await vaultWithBackup();
      let settle: () => void = () => {};
      const importing = new Promise<void>((resolve) => {
        settle = resolve;
      });
      jest
        .spyOn(vault, 'importBackup')
        .mockImplementation(async (_source, _passphrase, extraDir) => {
          emitProgress({ phase: 'verify', done: 20, total: 20 });
          await importing;
          return { entries: 19, extras: [{ key: 'database', path: `${extraDir}/database` }] };
        });
      // The module is wiping already; its Restoring event has not reached JavaScript yet.
      const cancel = jest.spyOn(vault, 'cancelRestore').mockReturnValue(false);

      const restore = backupService.restoreBackup(backup.uri, 'correct horse battery');
      await Promise.resolve();

      expect(backupService.cancelRestore()).toBe(false);
      expect(cancel).toHaveBeenCalledTimes(1);
      settle();
      await restore.catch(() => {});
    });

    it('lets the mock module refuse a cancel after its last cancel point, like the native one', async () => {
      const { backup } = await vaultWithBackup();
      const importBackup = jest.spyOn(vault, 'importBackup');
      const answers: boolean[] = [];

      await backupService.restoreBackup(backup.uri, 'correct horse battery', (event) => {
        const runId = at(at(importBackup.mock.calls, 0), 4);
        if (event.phase === 'import') answers.push(vault.cancelRestore(runId));
      });

      expect(answers).toEqual([false]);
    });

    it('drops the cancel when the re-ask on the first progress event is refused', async () => {
      const { backup } = await vaultWithBackup();
      const importBackup = vault.importBackup.bind(vault);
      jest.spyOn(vault, 'importBackup').mockImplementationOnce(async (...args) => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        return importBackup(...args);
      });
      // Accepted before the native call began, refused once it is past its cancel point.
      jest.spyOn(vault, 'cancelRestore').mockReturnValueOnce(true).mockReturnValue(false);
      const events: { phase: string; cancelling: boolean }[] = [];

      const restore = backupService.restoreBackup(backup.uri, 'correct horse battery', (event) =>
        events.push({ phase: event.phase, cancelling: event.cancelling }),
      );
      expect(backupService.cancelRestore()).toBe(true);

      await expect(restore).resolves.toBe(backup.entries);
      expect(events).toEqual([
        { phase: 'verify', cancelling: false },
        { phase: 'import', cancelling: false },
      ]);
    });

    it('reports a cancel that is still honoured as cancelling', async () => {
      const { backup } = await vaultWithBackup();
      const events: boolean[] = [];

      await expect(
        backupService.restoreBackup(backup.uri, 'correct horse battery', (event) => {
          if (event.phase === 'verify' && events.length === 0) backupService.cancelRestore();
          events.push(event.cancelling);
        }),
      ).rejects.toMatchObject({ code: 'BACKUP_CANCELLED' });
      expect(events).toEqual([false]);
    });

    const sourceOf = (uri: string) => decodeURIComponent(uri.replace(/^file:\/\//, ''));

    it('lets the module honour a cancel for the same run that arrived before it started', async () => {
      const { backup, keys } = await vaultWithBackup();

      expect(vault.cancelRestore('run-b')).toBe(true);

      await expect(
        vault.importBackup(sourceOf(backup.uri), 'correct horse battery', '/x', '/y', 'run-b'),
      ).rejects.toMatchObject({ code: 'BACKUP_CANCELLED' });
      expect(await vault.getAllKeys()).toEqual(keys);
    });

    it('ignores a cancel that lands after run A ended, so run B goes ahead', async () => {
      const { backup } = await vaultWithBackup();
      await vault.importBackup(sourceOf(backup.uri), 'correct horse battery', '/x', '/y', 'run-a');

      expect(vault.cancelRestore('run-a')).toBe(false);

      await expect(
        vault.importBackup(sourceOf(backup.uri), 'correct horse battery', '/x', '/y', 'run-b'),
      ).resolves.toMatchObject({ entries: expect.any(Number) });
    });

    it('discards a pending cancel for another run when a new run starts', async () => {
      const { backup } = await vaultWithBackup();

      expect(vault.cancelRestore('run-x')).toBe(true);

      await expect(
        vault.importBackup(sourceOf(backup.uri), 'correct horse battery', '/x', '/y', 'run-b'),
      ).resolves.toMatchObject({ entries: expect.any(Number) });
      // Discarded, not kept for later.
      await expect(
        vault.importBackup(sourceOf(backup.uri), 'correct horse battery', '/x', '/y', 'run-x'),
      ).resolves.toMatchObject({ entries: expect.any(Number) });
    });

    it('refuses a cancel for a different run while one is running', async () => {
      const { backup } = await vaultWithBackup();
      const answers: boolean[] = [];

      await backupService.restoreBackup(backup.uri, 'correct horse battery', (event) => {
        if (event.phase === 'verify') answers.push(vault.cancelRestore('someone-else'));
      });

      expect(answers).toEqual([false]);
    });

    it('gives each restore its own run id, for the native call and every cancel', async () => {
      const { backup } = await vaultWithBackup();
      const importBackup = jest.spyOn(vault, 'importBackup');
      const cancel = jest.spyOn(vault, 'cancelRestore');

      await expect(
        backupService.restoreBackup(backup.uri, 'correct horse battery', (event) => {
          if (event.phase === 'verify') backupService.cancelRestore();
        }),
      ).rejects.toMatchObject({ code: 'BACKUP_CANCELLED' });
      await backupService.restoreBackup(backup.uri, 'correct horse battery');

      const [first, second] = importBackup.mock.calls.map((call) => call[4]);
      expect(typeof first).toBe('string');
      expect(second).not.toBe(first);
      expect(cancel.mock.calls.every(([runId]) => runId === first)).toBe(true);
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
});
