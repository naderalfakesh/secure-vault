import { jest } from '@jest/globals';
import { Directory, File, Paths } from 'expo-file-system';

import type { BackupFile, BackupProgress, SecureVault } from './ExpoVaultModule';

const trimSlashes = (path: string) => path.replace(/\/+$/, '');
const pathOf = (uri: string) => trimSlashes(decodeURIComponent(uri.replace(/^file:\/\//, '')));
const isBelow = (path: string, folder: string) => path.startsWith(`${folder}/`);
// The native roots: the app cache, and on iOS tmp (the mock container's `/mock/tmp`).
const removalRoots = () => [pathOf(Paths.cache.uri), '/mock/tmp'];

/**
 * In-memory stand-in for the native vault, used by Jest. It keeps the same
 * promise-based surface so services and hooks run unchanged in tests.
 */
export interface VaultMockExport {
  destPath: string;
  stagingDir: string;
}

export interface VaultMockImport {
  sourcePath: string;
  extraDir: string;
  stagingDir: string;
}

export function createVaultMock(): SecureVault & {
  reset(): void;
  /** Paths the last `importBackup` call was given. */
  lastImport: VaultMockImport | null;
  /** Paths the last `exportBackup` call was given, for tests of the staging contract. */
  lastExport: VaultMockExport | null;
  /**
   * Marks the folder at `path` as a symbolic link to `target`. The mock file
   * system has no links, so it stands in as an empty folder; see
   * `followLinksOnDelete` for what the file system API does with it.
   */
  plantLink(path: string, target: string): void;
  linkTarget(path: string): string | null;
  links(): string[];
  /** Sends a progress event to the listeners, as the native module does mid-call. */
  emitProgress(progress: BackupProgress): void;
} {
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
  const links = new Map<string, string>();
  // The native flag: cleared when an import starts, read after its checking pass.
  let cancelRequested = false;
  const emit = (progress: BackupProgress) => listeners.forEach((listener) => listener(progress));

  return {
    lastExport: null,
    lastImport: null,
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
    async exportBackup(destPath, passphrase, extraFiles, stagingDir) {
      this.lastExport = { destPath, stagingDir };
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
    async importBackup(sourcePath, passphrase, extraDir, stagingDir) {
      cancelRequested = false;
      this.lastImport = { sourcePath, extraDir, stagingDir };
      const backup = backups.get(sourcePath);
      if (!backup)
        throw Object.assign(new Error('The backup file is not valid'), { code: 'BACKUP_INVALID' });
      if (backup.passphrase !== passphrase) {
        throw Object.assign(new Error('That passphrase does not match this backup.'), {
          code: 'BACKUP_PASSPHRASE',
        });
      }
      const total = backup.strings.size + backup.files.size + backup.extras.length + 1;
      emit({ phase: 'verify', done: total, total });
      // Natively the request is read between entries; here once, after the checking pass.
      await Promise.resolve();
      if (cancelRequested) {
        throw Object.assign(new Error('The restore was cancelled before anything was changed.'), {
          code: 'BACKUP_CANCELLED',
        });
      }
      strings = new Map(backup.strings);
      files = new Map(backup.files);
      const extras = backup.extras.map((file) => ({
        key: file.key,
        path: `${extraDir}/${file.key}`,
      }));
      emit({ phase: 'import', done: total, total });
      return { entries: total - 1, extras };
    },
    emitProgress(progress) {
      emit(progress);
    },
    cancelRestore() {
      cancelRequested = true;
    },
    async dismissShareSheet() {
      return false;
    },
    removeTreeNoFollow(path) {
      if (!path.startsWith('/'))
        throw new Error('The cache entry cannot be removed: not an absolute path');
      const key = trimSlashes(path);
      const parent = key.slice(0, key.lastIndexOf('/'));
      const name = key.slice(parent.length + 1);
      // The mock never resolves links in the parent, so `.` and `..` segments are refused outright.
      if (
        !name ||
        key.split('/').some((segment) => segment === '.' || segment === '..') ||
        !removalRoots().some((root) => parent === root || isBelow(parent, root))
      ) {
        throw new Error("The cache entry cannot be removed: not inside the app's cache");
      }
      // A link is unlinked, never followed, here or anywhere below.
      for (const link of [...links.keys()]) {
        if (link === key || isBelow(link, key)) links.delete(link);
      }
      const directory = new Directory(`file://${key}/`);
      if (directory.exists) {
        directory.delete();
        return;
      }
      const file = new File(`file://${key}`);
      if (file.exists) file.delete();
    },
    plantLink(path, target) {
      const key = trimSlashes(path);
      links.set(key, trimSlashes(target));
      const standIn = new Directory(`file://${key}/`);
      if (!standIn.exists) standIn.create({ intermediates: true });
    },
    linkTarget(path) {
      return links.get(trimSlashes(path)) ?? null;
    },
    links() {
      return [...links.keys()];
    },
    addListener(_event, listener) {
      listeners.add(listener);
      return {
        remove() {
          listeners.delete(listener);
        },
      };
    },
    reset() {
      strings = new Map();
      files = new Map();
      created = false;
      links.clear();
    },
  };
}

const vaultMock = createVaultMock();

/**
 * Makes `Directory.delete` behave as expo-file-system does on Android for a
 * planted link, at the folder itself or anywhere below it: it empties the
 * link's target before removing the link.
 */
export function followLinksOnDelete(
  mock: { links(): string[]; linkTarget(path: string): string | null } = vaultMock,
) {
  const remove = Directory.prototype.delete;
  return jest.spyOn(Directory.prototype, 'delete').mockImplementation(function (this: Directory) {
    const self = pathOf(this.uri);
    for (const link of mock.links()) {
      const target = mock.linkTarget(link);
      if (target && (link === self || isBelow(link, self))) {
        for (const entry of new Directory(`file://${target}/`).list()) entry.delete();
      }
    }
    return remove.call(this);
  });
}

export default vaultMock;
