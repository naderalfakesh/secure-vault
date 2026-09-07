import { requireNativeModule } from 'expo';

// It loads the native module object from the JSI or falls back to
// the bridge module (from NativeModulesProxy) if the remote debugger is on.
const ExpoVaultModule = requireNativeModule('ExpoVault');

export type BiometryType = 'faceId' | 'touchId' | 'biometrics' | 'none';

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
  deleteFile(key: string): Promise<void>;
  getFileSize(key: string): Promise<number>;

  // Backup & restore
  exportEncrypted(): Promise<string>;
  importEncrypted(jsonString: string): Promise<void>;
}

export default ExpoVaultModule as SecureVault;
