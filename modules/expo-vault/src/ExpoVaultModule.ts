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

const ExpoVaultModule = requireNativeModule<SecureVault>('ExpoVault');

export default ExpoVaultModule;
