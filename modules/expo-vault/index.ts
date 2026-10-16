// The native module, wrapped so a lapsed Android key window re-prompts and
// retries instead of surfacing "User not authenticated" to a screen.
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
  RenderedPage,
  SecureVault,
} from './src/ExpoVaultModule';
export { isKeyLocked, withKeyRecovery } from './src/withKeyRecovery';
