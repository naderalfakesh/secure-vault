import type { BackupFile, BackupProgress, SecureVault } from './ExpoVaultModule';

/**
 * In-memory stand-in for the native vault, used by Jest. It keeps the same
 * promise-based surface so services and hooks run unchanged in tests.
 */
export function createVaultMock(): SecureVault & { reset(): void } {
  let strings = new Map<string, string>();
  let files = new Map<string, string>();
  let created = false;
  // Backups are kept in memory keyed by their path, protected by the passphrase.
  const backups = new Map<
    string,
    {
      passphrase: string;
      strings: Map<string, string>;
      files: Map<string, string>;
      extras: BackupFile[];
    }
  >();
  const listeners = new Set<(progress: BackupProgress) => void>();
  const emit = (progress: BackupProgress) => listeners.forEach((listener) => listener(progress));

  return {
    async hasVault() {
      return created;
    },
    async biometryType() {
      return 'faceId' as const;
    },
    async createVault() {
      created = true;
    },
    async unlockWithBiometrics() {
      return true;
    },
    async put(key, value) {
      strings.set(key, value);
    },
    async get(key) {
      const value = strings.get(key);
      if (value === undefined) throw new Error(`GET_FAILED: ${key}`);
      return value;
    },
    async delete(key) {
      strings.delete(key);
    },
    async getAllKeys() {
      return [...strings.keys(), ...files.keys()];
    },
    async putFile(key, sourcePath) {
      files.set(key, sourcePath);
    },
    async putThumbnail(key, sourcePath) {
      files.set(key, sourcePath);
    },
    async getFile(key, destPath) {
      if (!files.has(key)) throw new Error(`GET_FILE_FAILED: ${key}`);
      return destPath;
    },
    async renderPdfPages(sourcePath, _maxPixelSize, destDir) {
      return [{ uri: `${destDir}/page_1.jpg`, width: 1240, height: 1754 }];
    },
    async deleteFile(key) {
      files.delete(key);
    },
    async getFileSize(key) {
      if (!files.has(key)) throw new Error(`FILE_NOT_FOUND: ${key}`);
      return 1024;
    },
    async exportBackup(destPath, passphrase, extraFiles) {
      backups.set(destPath, {
        passphrase,
        strings: new Map(strings),
        files: new Map(files),
        extras: extraFiles.map((file) => ({ ...file })),
      });
      const total = strings.size + files.size + extraFiles.length + 1;
      emit({ phase: 'export', done: total, total });
      return { entries: total - 1, bytes: 1024 * total };
    },
    async inspectBackup(sourcePath) {
      const backup = backups.get(sourcePath);
      if (!backup)
        throw Object.assign(new Error('The backup file is not valid'), { code: 'BACKUP_INVALID' });
      return {
        version: 1,
        app: 'SecureVault',
        created: '2026-09-07T00:00:00Z',
        entries: backup.strings.size + backup.files.size + backup.extras.length,
      };
    },
    async importBackup(sourcePath, passphrase, extraDir) {
      const backup = backups.get(sourcePath);
      if (!backup)
        throw Object.assign(new Error('The backup file is not valid'), { code: 'BACKUP_INVALID' });
      if (backup.passphrase !== passphrase) {
        throw Object.assign(new Error('That passphrase does not match this backup.'), {
          code: 'BACKUP_PASSPHRASE',
        });
      }
      strings = new Map(backup.strings);
      files = new Map(backup.files);
      const extras = backup.extras.map((file) => ({
        key: file.key,
        path: `${extraDir}/${file.key}`,
      }));
      const total = strings.size + files.size + extras.length + 1;
      emit({ phase: 'import', done: total, total });
      return { entries: total - 1, extras };
    },
    addListener(_event, listener) {
      listeners.add(listener);
      return {
        remove() {
          listeners.delete(listener);
        },
      };
    },
    async exportEncrypted() {
      return JSON.stringify(Object.fromEntries(strings));
    },
    async importEncrypted(json) {
      strings = new Map(Object.entries(JSON.parse(json) as Record<string, string>));
      files = new Map();
    },
    reset() {
      strings = new Map();
      files = new Map();
      created = false;
    },
  };
}

const vaultMock = createVaultMock();

export default vaultMock;
