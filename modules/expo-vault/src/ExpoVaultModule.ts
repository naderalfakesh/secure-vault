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

export interface BackupProgress {
  phase: 'export' | 'import';
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

  // Backup & restore
  /**
   * Writes every vault entry plus `extraFiles` into a passphrase-protected
   * container at `destPath`. Emits `backupProgress` while it works.
   */
  exportBackup(
    destPath: string,
    passphrase: string,
    extraFiles: BackupFile[],
  ): Promise<BackupSummary>;
  /** Reads the container header without a passphrase; rejects with BACKUP_INVALID otherwise. */
  inspectBackup(sourcePath: string): Promise<BackupInfo>;
  /**
   * Replaces the vault with the container's entries. Rejects with
   * BACKUP_PASSPHRASE before touching anything when the passphrase is wrong.
   * Extra files land in `extraDir` and are listed in the result.
   */
  importBackup(
    sourcePath: string,
    passphrase: string,
    extraDir: string,
  ): Promise<BackupImportResult>;
  addListener(
    event: 'backupProgress',
    listener: (progress: BackupProgress) => void,
  ): { remove(): void };
  /** @deprecated Prototype clipboard export under the device key; replaced by exportBackup. */
  exportEncrypted(): Promise<string>;
  /** @deprecated See exportEncrypted. */
  importEncrypted(jsonString: string): Promise<void>;
}

export default ExpoVaultModule as SecureVault;
