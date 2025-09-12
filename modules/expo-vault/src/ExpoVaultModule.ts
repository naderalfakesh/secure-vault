import { requireNativeModule } from 'expo-modules-core';

// It loads the native module object from the JSI or falls back to
// the bridge module (from NativeModulesProxy) if the remote debugger is on.
const ExpoVaultModule = requireNativeModule('ExpoVault');

export interface CryptoVault {
  createVault(): Promise<void>;
  unlockWithBiometrics(): Promise<boolean>;
  put(key: string, value: string): Promise<void>;
  get(key: string): Promise<string>;
  exportEncrypted(): Promise<string>;
  importEncrypted(jsonString: string): Promise<void>;
  getAllKeys(): Promise<string[]>;
  delete(key: string): Promise<void>;
}

export default ExpoVaultModule as CryptoVault;