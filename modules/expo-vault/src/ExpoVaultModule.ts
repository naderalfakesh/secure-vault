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
   * BACKUP_RESOURCE when the device cannot hold the declared header, and
   * BACKUP_INVALID for anything else that is not a version-1 header.
   */
  inspectBackup(sourcePath: string): Promise<BackupInfo>;
  /**
   * Replaces the vault with the container's entries. Before the key is
   * derived the header settings must be the exporter's (BACKUP_UNSUPPORTED)
   * and the structure a version-1 exporter writes (BACKUP_INVALID: check
   * entry first, known kinds, unique keys, exactly one `database` extra, a
   * `_database_key` string, no trailing bytes). Every entry is then decrypted
   * once, and the device must have the memory for the largest string entry
   * (BACKUP_RESOURCE, which also covers a header or entry name too large to
   * read) and the disk for the restored vault (BACKUP_NO_SPACE). A wrong
   * passphrase (BACKUP_PASSPHRASE), a cancel (BACKUP_CANCELLED, see
   * `cancelRestore`) or any of these leaves the vault untouched. A failure
   * from the first removal on rejects with
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
  /**
   * Asks the running restore to stop before it removes anything; returns at
   * once. The restore checks the request between entries while it is still
   * checking (the `verify` phase), and once more before the wipe, then
   * rejects with BACKUP_CANCELLED with the vault, its staging folder and the
   * index untouched. A request during the key derivation takes effect when
   * that ends; one after the checking pass is ignored. `importBackup` clears
   * the request when it starts, so a caller that may have asked before the
   * native call began asks again on the first progress event.
   */
  cancelRestore(): void;

  // Sharing
  /**
   * iOS: dismisses a share sheet (UIActivityViewController) the app is
   * presenting, with anything it presented in turn, so it never stays up over
   * the lock screen. Resolves true when one was dismissed. Android resolves
   * false: its chooser is an activity of its own the app cannot close.
   */
  dismissShareSheet(): Promise<boolean>;
  /**
   * Android: deletes the share copy folder at `path` (directly inside the
   * app cache's `share` folder; anything else throws) after `delayMs`, on the
   * main looper, which keeps running while the share chooser pauses the app
   * and its JavaScript timers. One at a time; a new call replaces the last.
   * iOS does nothing: the app is suspended instead, and the lock dismisses the
   * sheet. Synchronous.
   */
  scheduleShareExpiry(path: string, delayMs: number): void;
  /** Cancels the expiry scheduled for `path`; one for another path is kept. Synchronous. */
  cancelShareExpiry(path: string): void;
  addListener(
    event: 'backupProgress',
    listener: (progress: BackupProgress) => void,
  ): { remove(): void };
}

export default ExpoVaultModule as SecureVault;
