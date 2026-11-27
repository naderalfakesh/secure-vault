export type BiometryType = 'faceId' | 'touchId' | 'biometrics' | 'none';

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

export interface BackupProgress {
  phase: 'export' | 'verify' | 'import';
  done: number;
  total: number;
}

export interface SecureVault {
  hasVault(): Promise<boolean>;
  biometryType(): Promise<BiometryType>;
  keyProtection(): Promise<KeyProtection>;
  createVault(): Promise<void>;
  unlockWithBiometrics(): Promise<boolean>;
  /** iOS only: UserDefaults flag cleared on uninstall (unlike Keychain). */
  hasInstallMarker(): boolean;
  /** Changes on clipboard writes without reading content (avoids iOS paste prompt / Android toast). */
  clipboardStamp(): string | null;
  setInstallMarker(): void;
  deleteDeviceKey(): Promise<void>;

  put(key: string, value: string): Promise<void>;
  get(key: string): Promise<string>;
  delete(key: string): Promise<void>;
  getAllKeys(): Promise<string[]>;

  putFile(key: string, sourcePath: string): Promise<void>;
  putThumbnail(key: string, sourcePath: string, maxPixelSize: number): Promise<void>;
  getFile(key: string, destPath: string): Promise<string>;
  renderPdfPages(
    sourcePath: string,
    maxPixelSize: number,
    destDir: string,
  ): Promise<RenderedPage[]>;
  deleteFile(key: string): Promise<void>;
  getFileSize(key: string): Promise<number>;
  removeTreeNoFollow(path: string): void;
  /** iOS only: sets isExcludedFromBackup on a Documents subfolder. */
  excludeFromBackup(path: string): void;

  exportBackup(
    destPath: string,
    passphrase: string,
    extraFiles: BackupFile[],
    stagingDir: string,
  ): Promise<BackupSummary>;
  inspectBackup(sourcePath: string): Promise<BackupInfo>;
  importBackup(
    sourcePath: string,
    passphrase: string,
    extraDir: string,
    stagingDir: string,
    runId: string,
  ): Promise<BackupImportResult>;
  cancelRestore(runId: string): boolean;

  dismissShareSheet(): Promise<boolean>;
  scheduleShareExpiry(path: string, delayMs: number): void;
  cancelShareExpiry(path: string): void;
  /** Android: epoch ms of last Activity.onStop; 0 on iOS. */
  lastStoppedAt(): number;
  endKeySession(): void;
  addListener(
    event: 'backupProgress',
    listener: (progress: BackupProgress) => void,
  ): { remove(): void };
}
