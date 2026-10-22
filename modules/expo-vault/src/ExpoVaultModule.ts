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
  /**
   * iOS only (Android has none of the three; callers check the platform).
   * Whether this install has run before: a flag in UserDefaults, which is
   * deleted with the app, unlike Keychain items. Synchronous.
   */
  hasInstallMarker(): boolean;
  /**
   * A stamp that changes whenever anything is copied to the system clipboard,
   * read without reading the content, so it never shows iOS's paste prompt or
   * Android's "pasted from your clipboard" toast. iOS: `UIPasteboard`'s
   * `changeCount`. Android 8 and later: the primary clip's timestamp. Null
   * when it cannot be told (an empty clipboard, Android before 8, or a
   * clipboard the app cannot see from the background). Synchronous.
   */
  clipboardStamp(): string | null;
  /** iOS only: records that this install has run. Synchronous. */
  setInstallMarker(): void;
  /**
   * iOS only: deletes the device key's Keychain items (every item of the
   * vault's Keychain service), for a reinstall that found the previous
   * install's key without its files. Resolves when none is left.
   */
  deleteDeviceKey(): Promise<void>;

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
   * resolved, plus the documents folder's `restore-source` itself (never an
   * entry below it), where a picked backup waits for its restore; anything
   * else, or an entry left behind, throws. Synchronous.
   */
  removeTreeNoFollow(path: string): void;
  /**
   * iOS: sets `isExcludedFromBackup` on `path`, which must be one of the app's
   * own folders directly in Documents (`restore-source` or
   * `securevault-session`); anything else throws. A folder's flag covers what
   * it holds. Android does nothing: the app's backup rules include only
   * shared preferences, so the files folder is never backed up. Synchronous.
   */
  excludeFromBackup(path: string): void;

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
   * `runId` names this restore for `cancelRestore`; a retry of the same
   * restore passes the same one.
   */
  importBackup(
    sourcePath: string,
    passphrase: string,
    extraDir: string,
    stagingDir: string,
    runId: string,
  ): Promise<BackupImportResult>;
  /**
   * Asks the running restore to stop before it removes anything; returns at
   * once. The restore checks the request between entries while it is still
   * checking (the `verify` phase), and once more before the wipe, then
   * rejects with BACKUP_CANCELLED with the vault, its staging folder and the
   * index untouched. A request during the key derivation takes effect when
   * that ends. True when the request will be honoured; false once the
   * restore has passed that last check, which it does in the same atomic
   * step that refuses later requests. The request names its restore by
   * `runId`: it acts only on the restore running with that id, or is kept
   * for the next one to start when no restore is running, and only that
   * restore honours it. A request for any other id (one that already ended,
   * or while a different one runs) is ignored and answers false, and a kept
   * request for another id is discarded when a restore starts.
   */
  cancelRestore(runId: string): boolean;

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
  /**
   * Android: when an activity of the app was last stopped (Home, Recents,
   * another app opened over it), in epoch milliseconds; 0 before any. The
   * share chooser is translucent and only pauses the activity, so a stop while
   * it is up means the user left the app. iOS always returns 0. Synchronous.
   */
  lastStoppedAt(): number;
  addListener(
    event: 'backupProgress',
    listener: (progress: BackupProgress) => void,
  ): { remove(): void };
}

export default ExpoVaultModule as SecureVault;
