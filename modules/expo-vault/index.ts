import { AppState } from 'react-native';

import ExpoVaultModule from './src/ExpoVaultModule';
import { withKeyRecovery } from './src/withKeyRecovery';

export default withKeyRecovery(ExpoVaultModule, () => AppState.currentState === 'active');
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
} from './src/ExpoVaultModule';
export { isKeyLocked, withKeyRecovery } from './src/withKeyRecovery';
