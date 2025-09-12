import ExpoVaultModule from '../../modules/expo-vault';
import { CryptoVault } from '../../modules/expo-vault/src/ExpoVaultModule';

export const useCryptoVault = (): CryptoVault => {
  return ExpoVaultModule;
};
