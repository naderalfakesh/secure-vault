import vault from '../../../modules/expo-vault';
import { DocumentCategory } from '../../types';
import { backupService, describeBackupError, passphraseProblem } from '../BackupService';
import { documentService } from '../DocumentService';

const vaultMock = vault as unknown as { reset(): void };

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
    expect(describeBackupError(new Error('disk full'))).toBe('disk full');
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
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ phase: 'import' }));
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
});
