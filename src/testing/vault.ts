import vault from '@modules/expo-vault';
import type { VaultMock } from '@modules/expo-vault/src/ExpoVaultModule.mock';

// Jest swaps the native vault for the in-memory mock (jest.setup.js), but the
// module's public type is the native surface, so the test-only members
// (`reset`, `plantLink`, `emitProgress`, ...) need this one cast.
export const vaultMock = vault as unknown as VaultMock;
