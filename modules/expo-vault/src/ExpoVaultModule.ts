import { requireNativeModule } from 'expo';

// It loads the native module object from the JSI or falls back to
// the bridge module (from NativeModulesProxy) if the remote debugger is on.
const ExpoVaultModule = requireNativeModule('ExpoVault');

export type BiometryType = 'faceId' | 'touchId' | 'biometrics' | 'none';

export interface RenderedPage {
  uri: string;
  width: number;
  height: number;
}

export interface BackupFile {
  key: string;
  path: string;
}

export interface BackupSummary {
  entries: number;
  bytes: number;
}

export interface BackupInfo {
  version: number;
  app: string;
  created: string;
  entries: number;
}

export interface BackupImportResult {
  entries: number;
  extras: BackupFile[];
}

/** A restore reports every entry twice: once while verifying, once while importing. */
export interface BackupProgress {
  phase: 'export' | 'verify' | 'import';
  done: number;
  total: number;
}

export interface SecureVault {
  // Vault management
  /** True once a device key exists, even while it is still locked. */
  hasVault(): Promise<boolean>;
  /** Which biometric the device offers, so copy can say Face ID rather than "biometrics". */
  biometryType(): Promise<BiometryType>;
  createVault(): Promise<void>;
  unlockWithBiometrics(): Promise<boolean>;

  // String-based storage (for metadata, JSON, etc.)
  put(key: string, value: string): Promise<void>;
  get(key: string): Promise<string>;
  delete(key: string): Promise<void>;
  getAllKeys(): Promise<string[]>;

  // File-based storage (for images, PDFs, binary data)
  putFile(key: string, sourcePath: string): Promise<void>;
  /** Downsamples an image to `maxPixelSize` on its longest side and stores it encrypted. */
  putThumbnail(key: string, sourcePath: string, maxPixelSize: number): Promise<void>;
  getFile(key: string, destPath: string): Promise<string>;
  /**
   * Rasterises every page of a PDF at `sourcePath` into JPEGs inside `destDir`,
   * longest side `maxPixelSize`. The viewer and thumbnails only handle images.
   */
  renderPdfPages(
    sourcePath: string,
    maxPixelSize: number,
    destDir: string,
  ): Promise<RenderedPage[]>;
  deleteFile(key: string): Promise<void>;
  getFileSize(key: string): Promise<number>;
  /**
   * Removes the file, folder, or link at `path` without following symbolic
   * links: a link is unlinked, never recursed into, at the top or anywhere
   * below. A missing entry is fine. Only an entry inside the app's cache
   * (and, on iOS, its tmp folder) qualifies once its parent's links are
   * resolved; anything else, or an entry left behind, throws. Synchronous.
   */
  removeTreeNoFollow(path: string): void;

  // Backup & restore
  /**
   * Writes every vault entry plus `extraFiles` into a passphrase-protected
   * container at `destPath`. Entries are decrypted one at a time into
   * `stagingDir`, which is emptied before and after; the caller sweeps it on
   * lock and launch as well. The module accepts only the app cache's own
   * `backup-staging` folder there and rejects anything else with
   * BACKUP_STAGING_INVALID before touching the disk. Emits `backupProgress`
   * while it works.
   */
  exportBackup(
    destPath: string,
    passphrase: string,
    extraFiles: BackupFile[],
    stagingDir: string,
  ): Promise<BackupSummary>;
  /**
   * Reads the container header without a passphrase. Rejects with
   * BACKUP_UNSUPPORTED for a newer format or KDF and cipher settings no
   * committed exporter wrote (iterations other than 600 000 included),
   * BACKUP_RESOURCE when the device cannot hold a declared length (Android
   * only), and BACKUP_INVALID for anything else that is not a version-1
   * header.
   */
  inspectBackup(sourcePath: string): Promise<BackupInfo>;
  /**
   * Replaces the vault with the container's entries. Before the key is
   * derived the header settings must be the exporter's (BACKUP_UNSUPPORTED).
   * Every entry is then decrypted once, so a wrong passphrase
   * (BACKUP_PASSPHRASE), a damaged file or one without its document index
   * (BACKUP_INVALID), or a
   * declared length the device cannot hold (BACKUP_RESOURCE, Android only)
   * leaves the vault untouched. A failure from the first removal on rejects with
   * BACKUP_PARTIAL. Extra files land in `extraDir` and are listed in the
   * result. Payload copies and decrypted entries live only in `stagingDir`,
   * which must be the app cache's own `restore-staging` folder
   * (BACKUP_RESTORE_STAGING_INVALID otherwise, before anything is touched) and
   * is emptied before and after; the caller sweeps it on launch as well.
   */
  importBackup(
    sourcePath: string,
    passphrase: string,
    extraDir: string,
    stagingDir: string,
  ): Promise<BackupImportResult>;
  addListener(
    event: 'backupProgress',
    listener: (progress: BackupProgress) => void,
  ): { remove(): void };
}

export default ExpoVaultModule as SecureVault;
