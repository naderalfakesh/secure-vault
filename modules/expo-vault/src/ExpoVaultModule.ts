import { requireNativeModule } from 'expo';

import type { SecureVault } from './types';

export type {
  BackupFile,
  BackupImportResult,
  BackupInfo,
  BackupProgress,
  BackupSummary,
  BiometryType,
  KeyProtection,
  RenderedPage,
  SecureVault,
} from './types';

// Loads the native module object from JSI (or falls back to the bridge module).
const ExpoVaultModule = requireNativeModule<SecureVault>('ExpoVault');

export default ExpoVaultModule;
