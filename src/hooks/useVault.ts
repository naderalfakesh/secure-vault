import ExpoVaultModule from '../../modules/expo-vault';
import type { SecureVault } from '../../modules/expo-vault/src/ExpoVaultModule';

export const useVault = (): SecureVault => {
  return ExpoVaultModule;
};
