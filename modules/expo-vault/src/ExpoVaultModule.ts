import { requireNativeModule } from 'expo-modules-core';

// It loads the native module object from the JSI or falls back to
// the bridge module (from NativeModulesProxy) if the remote debugger is on.
const ExpoVaultModule = requireNativeModule('ExpoVault');

export interface SecureVault {
  // Vault management
  createVault(): Promise<void>;
  unlockWithBiometrics(): Promise<boolean>;

  // String-based storage (for metadata, JSON, etc.)
  put(key: string, value: string): Promise<void>;
  get(key: string): Promise<string>;
  delete(key: string): Promise<void>;
  getAllKeys(): Promise<string[]>;

  // File-based storage (for images, PDFs, binary data)
  putFile(key: string, sourcePath: string): Promise<void>;
  getFile(key: string, destPath: string): Promise<string>;
  deleteFile(key: string): Promise<void>;
  getFileSize(key: string): Promise<number>;

  // Backup & restore
  exportEncrypted(): Promise<string>;
  importEncrypted(jsonString: string): Promise<void>;
}

export default ExpoVaultModule as SecureVault;