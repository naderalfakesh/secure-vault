import { Directory, File, Paths } from 'expo-file-system';

import { documentDatabase } from '@/data/database';
import { createBackup } from '@/testing/backup';
import { picked } from '@/testing/backupService';
import { vaultMock } from '@/testing/vault';
import vault from '@modules/expo-vault';

import { DocumentCategory } from '../../types';
import {
  BACKUP_DIRECTORY,
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

  it('refuses to write a backup behind a weak passphrase', async () => {
    await expect(createBackup('weak')).rejects.toThrow(/at least 8/);
  });

  it('round-trips the vault through a backup file and reports progress', async () => {
    await documentService.addDocument(picked, { title: 'Passport', category: DocumentCategory.ID });
    await vault.put('_database_key', 'ab'.repeat(32));
    const progress = jest.fn();

    const backup = await createBackup('correct horse battery', progress);
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
    const backup = await createBackup('correct horse battery');
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
      const backup = await createBackup('correct horse battery');
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
      const backup = await createBackup('correct horse battery');
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
        const backup = await createBackup('correct horse battery');
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

    it('leaves no empty backup folder behind a refusal of a picked file', async () => {
      const pickerFolder = new Directory(Paths.cache, PICKER_DIRECTORY);
      if (!pickerFolder.exists) pickerFolder.create({ intermediates: true });
      const picked = new File(pickerFolder, 'picked.svbackup');
      picked.writeSync('not a backup');
      const folder = new Directory(Paths.cache, BACKUP_DIRECTORY);
      if (folder.exists) folder.delete();
      jest
        .spyOn(vault, 'importBackup')
        .mockRejectedValueOnce(
          Object.assign(new Error('The backup file is not valid'), { code: 'BACKUP_INVALID' }),
        );
      try {
        await expect(
          backupService.restoreBackup(picked.uri, 'correct horse battery'),
        ).rejects.toMatchObject({ code: 'BACKUP_INVALID' });
        expect(new Directory(Paths.cache, BACKUP_DIRECTORY).exists).toBe(false);
      } finally {
        jest.restoreAllMocks();
        if (picked.exists) picked.delete();
      }
    });

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
    const backup = await createBackup('correct horse battery');
    await vault.put('_database_key', 'ef'.repeat(32));

    await expect(
      backupService.restoreBackup(backup.uri, 'wrong passphrase!'),
    ).rejects.toMatchObject({
      code: 'BACKUP_PASSPHRASE',
    });
    expect(await vault.get('_database_key')).toBe('ef'.repeat(32));
  });
});
