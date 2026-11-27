export type BiometryType = 'faceId' | 'touchId' | 'biometrics' | 'none';

/**
 * Where the device key lives (ADR 0009).
 * - `secure-enclave` (iOS): sealed to a key in the Secure Enclave.
 * - `keychain` (iOS): a Keychain item, on devices without an enclave (the simulator).
 * - `strongbox`, `trusted-environment` (Android): the Keystore's secure hardware.
 * - `software` (Android): a Keystore without secure hardware.
 * - `none`: no vault yet.
 */
export type KeyProtection =
  'secure-enclave' | 'keychain' | 'strongbox' | 'trusted-environment' | 'software' | 'none';

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
  /** Where the device key is kept. Reads no key material, so it never prompts. */
  keyProtection(): Promise<KeyProtection>;
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
   * Android's "pasted from your clipboard" toast. Synchronous.
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
  /** Removes the file, folder, or link at `path` without following symbolic links. Synchronous. */
  removeTreeNoFollow(path: string): void;
  /** iOS: sets `isExcludedFromBackup` on one of the app's own Documents folders. Synchronous. */
  excludeFromBackup(path: string): void;

  // Backup & restore
  /** Writes every vault entry plus `extraFiles` into a passphrase-protected container. */
  exportBackup(
    destPath: string,
    passphrase: string,
    extraFiles: BackupFile[],
    stagingDir: string,
  ): Promise<BackupSummary>;
  /** Reads the container header without a passphrase. */
  inspectBackup(sourcePath: string): Promise<BackupInfo>;
  /** Replaces the vault with the container's entries after full verification and preflight checks. */
  importBackup(
    sourcePath: string,
    passphrase: string,
    extraDir: string,
    stagingDir: string,
    runId: string,
  ): Promise<BackupImportResult>;
  /** Cooperatively requests the running restore with `runId` to stop before wiping the vault. */
  cancelRestore(runId: string): boolean;

  // Sharing & key session
  /** iOS: dismisses a presented share sheet so it never stays over the lock screen. */
  dismissShareSheet(): Promise<boolean>;
  /** Android: deletes the share copy folder after `delayMs` on the main looper. Synchronous. */
  scheduleShareExpiry(path: string, delayMs: number): void;
  /** Cancels the expiry scheduled for `path`. Synchronous. */
  cancelShareExpiry(path: string): void;
  /** Android: epoch ms when an activity of the app was last stopped; 0 on iOS. Synchronous. */
  lastStoppedAt(): number;
  /** Ends the authenticated key session once the vault locks. Synchronous. */
  endKeySession(): void;
  addListener(
    event: 'backupProgress',
    listener: (progress: BackupProgress) => void,
  ): { remove(): void };
}
